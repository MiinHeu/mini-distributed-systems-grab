import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';
import { TripStatus } from './entities/trip.entity';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { DbRoutingService } from '../db-routing/db-routing.service';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly httpService: HttpService,
    private readonly dbRouting: DbRoutingService,
  ) {}

  async bookTripLegacy(data: any) {
    // Legacy: dùng raw pg thay vì TypeORM
    const region = this.normalizeRegion(data.region || 'SOUTH');
    const result = await this.database.queryWithFailover(
      region,
      `INSERT INTO trips (customer_id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare, region)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.customer_id || 1, data.pickup_address || 'Unknown', data.dropoff_address || 'Unknown',
       data.pickup_lat || 0, data.pickup_lng || 0, data.dropoff_lat || 0, data.dropoff_lng || 0,
       data.fare || 0, region],
      true,
    );
    return result.result.rows[0];
  }

  async getTripById(id: string) {
    // Thử cả 2 region
    for (const region of [Region.SOUTH, Region.NORTH]) {
      try {
        const { result } = await this.database.queryWithFailover(
          region,
          'SELECT * FROM trips WHERE id = $1 LIMIT 1',
          [id],
          false,
        );
        if (result.rows[0]) return result.rows[0];
      } catch {}
    }
    return null;
  }

  async cancelTrip(id: string, userId?: string) {
    const region = await this.findTripRegion(id);

    // 1. Cập nhật trạng thái trip
    const query = userId !== undefined
      ? `UPDATE trips SET status = 'cancelled' WHERE id = $1 AND customer_id = $2 AND status IN ('pending', 'accepted') RETURNING *`
      : `UPDATE trips SET status = 'cancelled' WHERE id = $1 RETURNING *`;
    const params = userId !== undefined ? [id, userId] : [id];

    const { result } = await this.database.queryWithFailover<any>(region, query, params, true);

    if (result.rowCount === 0) {
      if (userId !== undefined) throw new NotFoundException('Không tìm thấy chuyến hoặc bạn không có quyền hủy');
      return { message: 'Trip not found' };
    }

    const trip = result.rows[0];

    // 2. Nếu chuyến đã có tài xế nhận, giải phóng tài xế
    if (trip.driver_id) {
      await this.database.queryWithFailover(
        region,
        `UPDATE drivers SET is_available = true WHERE id = $1`,
        [trip.driver_id],
        true,
      );
    }

    return trip;
  }

  async getPendingTrips(regionRaw: string) {
    const region = this.normalizeRegion(regionRaw);
    const { result, isReadOnly } = await this.database.queryWithFailover<any>(
      region,
      `SELECT
         id, customer_id, driver_id,
         pickup_address, dropoff_address,
         pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
         distance_km, fare, region, status, created_at, completed_at
       FROM trips
       WHERE status = 'pending' AND region = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [region],
    );
    return { trips: result.rows, isReadOnly };
  }

  async acceptTrip(tripId: string, userId: string) {
    const region = await this.findTripRegion(tripId);

    // 1. Tìm và Khóa tài xế (Atomic Update)
    // Dùng UPDATE ... WHERE is_available = true để đảm bảo không bị race condition
    const driverRes = await this.database.queryWithFailover(
      region,
      `UPDATE drivers 
       SET is_available = false 
       WHERE user_id = $1 AND region = $2 AND is_available = true 
       RETURNING id`,
      [userId, region],
      true,
    );

    if (driverRes.result.rowCount === 0) {
      throw new ConflictException('Bạn đang bận hoặc không có hồ sơ tài xế trong vùng này.');
    }

    const driverId = driverRes.result.rows[0].id;

    try {
      // 2. Cập nhật chuyến xe
      const { result } = await this.database.queryWithFailover<any>(
        region,
        `UPDATE trips
         SET status = 'accepted', driver_id = $1, completed_at = NULL
         WHERE id = $2 AND status = 'pending'
         RETURNING *`,
        [driverId, tripId],
        true,
      );

      if (result.rowCount === 0) {
        // Giải phóng tài xế nếu trip đã bị người khác nhận trước đó
        const allRegions = [Region.NORTH, Region.SOUTH];
        for (const r of allRegions) {
          try {
            await this.database.queryWithFailover(
              r,
              `UPDATE drivers SET is_available = true WHERE id = $1`,
              [driverId],
              true,
            );
          } catch (err) {}
        }
        throw new ConflictException('Chuyến đã được nhận bởi tài xế khác hoặc đã bị hủy.');
      }

      // 3. Khóa tài xế trên TOÀN HỆ THỐNG sau khi đã nhận trip thành công
      const allRegions = [Region.NORTH, Region.SOUTH];
      for (const r of allRegions) {
        try {
          await this.database.queryWithFailover(
            r,
            `UPDATE drivers SET is_available = false WHERE id = $1`,
            [driverId],
            true,
          );
        } catch (err) {}
      }

      return result.rows[0];
    } catch (error) {
      // Giải phóng tài xế nếu có lỗi xảy ra
      const allRegions = [Region.NORTH, Region.SOUTH];
      for (const r of allRegions) {
        try {
          await this.database.queryWithFailover(
            r,
            `UPDATE drivers SET is_available = true WHERE id = $1`,
            [driverId],
            true,
          );
        } catch (err) {}
      }
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      throw new ConflictException('Lỗi hệ thống khi nhận chuyến. Vui lòng thử lại.');
    }
  }

  async completeTrip(tripId: string, userId: string) {
    const region = await this.findTripRegion(tripId);

    // Tìm driver_id (UUID) của user này
    const driverRes = await this.database.queryWithFailover(
      region,
      `SELECT id FROM drivers WHERE user_id = $1 AND region = $2 LIMIT 1`,
      [userId, region],
      false,
    );

    if (driverRes.result.rowCount === 0) {
      throw new BadRequestException('Bạn chưa có hồ sơ tài xế trong vùng này.');
    }

    const driverId = driverRes.result.rows[0].id;

    try {
      // 1. Cập nhật chuyến xe
      const { result } = await this.database.queryWithFailover<any>(
        region,
        `UPDATE trips
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1 AND status = 'accepted' AND driver_id = $2
         RETURNING *`,
        [tripId, driverId],
        true,
      );
      if (result.rowCount === 0) {
        throw new NotFoundException('Không tìm thấy chuyến đang được nhận bởi tài xế này');
      }

      // 2. Cập nhật hồ sơ tài xế trên TOÀN HỆ THỐNG (Replication)
      // Giải phóng tài xế thành RẢNH và tăng tổng số chuyến xe đã hoàn thành
      const allRegions = [Region.NORTH, Region.SOUTH];
      for (const r of allRegions) {
        try {
          await this.database.queryWithFailover(
            r,
            `UPDATE drivers SET is_available = true, total_trips = COALESCE(total_trips, 0) + 1 WHERE id = $1`,
            [driverId],
            true,
          );
        } catch (err) {
          // Bỏ qua lỗi tại các vùng đang sập để đảm bảo tính sẵn sàng cao
        }
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new ConflictException('Hệ thống đang ở chế độ chỉ đọc, không thể hoàn thành chuyến');
    }
  }

  async rejectTrip(tripId: string, userId: string) {
    const region = await this.findTripRegion(tripId);

    const driverRes = await this.database.queryWithFailover(
      region,
      `SELECT id FROM drivers WHERE user_id = $1 AND region = $2 LIMIT 1`,
      [userId, region],
      false,
    );

    if (driverRes.result.rowCount === 0) {
      throw new BadRequestException('Bạn chưa có hồ sơ tài xế trong vùng này.');
    }

    const driverId = driverRes.result.rows[0].id;

    const { result } = await this.database.queryWithFailover<any>(
      region,
      `UPDATE trips
       SET status = 'pending', driver_id = NULL
       WHERE id = $1 AND status = 'accepted' AND driver_id = $2
       RETURNING *`,
      [tripId, driverId],
      true,
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Không tìm thấy chuyến đang được nhận bởi tài xế này');
    }

    // Giải phóng tài xế thành RẢNH
    const allRegions = [Region.NORTH, Region.SOUTH];
    for (const r of allRegions) {
      try {
        await this.database.queryWithFailover(
          r,
          `UPDATE drivers SET is_available = true WHERE id = $1`,
          [driverId],
          true,
        );
      } catch (err) {}
    }

    return {
      message: 'Đã từ chối chuyến. Chuyến sẽ được chuyển cho tài xế khác.',
      trip: result.rows[0],
    };
  }

  async getTripHistory(userId: string) {
    const query = `
      SELECT
        t.id, t.status, t.pickup_address, t.dropoff_address, t.fare, t.created_at, t.region,
        u.name AS customer_name, ud.name AS driver_name
      FROM trips t
      LEFT JOIN users u ON t.customer_id = u.id
      LEFT JOIN drivers dr ON t.driver_id = dr.id
      LEFT JOIN users ud ON dr.user_id = ud.id
      WHERE t.customer_id = $1 OR dr.user_id = $1
      ORDER BY t.created_at DESC
    `;

    // Query từng vùng độc lập — 1 vùng sập không ảnh hưởng vùng kia
    let northRes: { result: { rows: any[] }; isReadOnly: boolean } = { result: { rows: [] }, isReadOnly: false };
    let southRes: { result: { rows: any[] }; isReadOnly: boolean } = { result: { rows: [] }, isReadOnly: false };
    let northFailed = false;
    let southFailed = false;

    try {
      northRes = await this.database.queryWithFailover(Region.NORTH, query, [userId], false);
    } catch (e) {
      northFailed = true;
      this.logger.warn(`[getTripHistory] Không thể truy vấn Miền Bắc: ${e.message}`);
    }

    try {
      southRes = await this.database.queryWithFailover(Region.SOUTH, query, [userId], false);
    } catch (e) {
      southFailed = true;
      this.logger.warn(`[getTripHistory] Không thể truy vấn Miền Nam: ${e.message}`);
    }

    const allTrips = [...northRes.result.rows, ...southRes.result.rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    console.log(`[HistoryAudit] userId: ${userId}, north: ${northRes.result.rows.length}, south: ${southRes.result.rows.length}, total: ${allTrips.length}`);

    const isReadOnly = northRes.isReadOnly || southRes.isReadOnly || northFailed || southFailed;

    // Xác định node đang phục vụ
    let activeNode = 'primary';
    if ((northRes.isReadOnly || northFailed) && (southRes.isReadOnly || southFailed)) {
      activeNode = 'replica (both regions)';
    } else if (northRes.isReadOnly || northFailed) {
      activeNode = 'NORTH_REPLICA';
    } else if (southRes.isReadOnly || southFailed) {
      activeNode = 'SOUTH_REPLICA';
    }

    // Tạo warning message rõ ràng khi ở read-only mode hoặc vùng sập
    let warning: string | null = null;
    if (northFailed && southFailed) {
      warning = 'Cả hai vùng đều không khả dụng. Không thể truy vấn dữ liệu.';
    } else if (northFailed) {
      warning = 'Miền Bắc không khả dụng. Chỉ hiển thị dữ liệu Miền Nam.';
    } else if (southFailed) {
      warning = 'Miền Nam không khả dụng. Chỉ hiển thị dữ liệu Miền Bắc.';
    } else if (northRes.isReadOnly && southRes.isReadOnly) {
      warning = 'Cả hai vùng đang ở chế độ chỉ đọc. Dữ liệu có thể chưa được cập nhật mới nhất.';
    } else if (northRes.isReadOnly) {
      warning = 'Miền Bắc đang bảo trì. Dữ liệu Miền Bắc được lấy từ bản sao (read-only).';
    } else if (southRes.isReadOnly) {
      warning = 'Miền Nam đang bảo trì. Dữ liệu Miền Nam được lấy từ bản sao (read-only).';
    }

    return {
      readOnly: isReadOnly,
      warning,
      activeNode,
      data: allTrips,
    };
  }

  async getTripHistoryAdmin(userId: string) {
    return this.getTripHistory(userId);
  }

  async bookTrip(body: any, userId: string) {
    // Kiểm tra giới hạn fare để tránh numeric overflow (numeric(10,2) max ~99tr)
    if (body.fare && (body.fare < 0 || body.fare > 99000000)) {
      throw new BadRequestException('Giá tiền không hợp lệ hoặc vượt quá hạn mức cho phép (99.000.000 VND)');
    }

    const ctx = this.dbRouting.getWriteContext(body.pickup_lat);

    // 1. Kiểm tra xem khách hàng có đang trong một chuyến xe khác không
    // Phải kiểm tra cả 2 vùng để đảm bảo tính nhất quán toàn cục
    for (const r of [Region.NORTH, Region.SOUTH]) {
      const activeTrips = await this.database.queryWithFailover(
        r,
        `SELECT id FROM trips WHERE customer_id = $1 AND status IN ('pending', 'accepted') LIMIT 1`,
        [userId],
        false,
      );
      if (activeTrips.result.rowCount && activeTrips.result.rowCount > 0) {
        throw new ConflictException('Bạn đang có một chuyến xe chưa hoàn thành. Không thể đặt thêm.');
      }
    }

    const tripId = this.database.generateId();
    try {
      const { result } = await this.database.queryWithFailover<any>(
        ctx.region,
        `INSERT INTO trips (
          id, customer_id, status, pickup_address, dropoff_address, 
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, 
          fare, region
        )
        VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          tripId,
          userId,
          body.pickup_address || body.pickup || 'Unknown',
          body.dropoff_address || body.dropoff || 'Unknown',
          body.pickup_lat,
          body.pickup_lng,
          body.dropoff_lat || 0,
          body.dropoff_lng || 0,
          body.fare,
          ctx.region,
        ],
        true,
      );

      return {
        message: 'Đã đặt chuyến thành công',
        trip: result.rows[0],
      };
    } catch (e: any) {
      if (e.code === '23505') {
        throw new ConflictException('Bạn đang có một chuyến xe chưa hoàn thành. Vui lòng kiểm tra lại.');
      }
      throw e;
    }
  }

  private normalizeRegion(regionRaw: string): Region {
    return regionRaw === Region.NORTH ? Region.NORTH : Region.SOUTH;
  }

  private async findTripRegion(tripId: string): Promise<Region> {
    for (const region of [Region.SOUTH, Region.NORTH]) {
      const { result } = await this.database.queryWithFailover<{ region: Region }>(
        region,
        'SELECT region FROM trips WHERE id = $1 LIMIT 1',
        [tripId],
      );
      if (result.rows[0]) {
        return this.normalizeRegion(result.rows[0].region);
      }
    }
    throw new NotFoundException('Trip not found');
  }

  /**
   * Tính tiền ước tính dựa trên tọa độ — dùng OSRM (free, không cần API key)
   * POST /trips/estimate
   */
  async estimateTrip(body: EstimateTripDto) {
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = body;

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickup_lng},${pickup_lat};${dropoff_lng},${dropoff_lat}` +
      `?overview=full&geometries=geojson`;

    try {
      const response: any = await firstValueFrom(this.httpService.get(osrmUrl));
      const route = response.data?.routes?.[0];

      if (!route) {
        throw new BadRequestException('Không tính được quãng đường từ OSRM');
      }

      const distance_km = route.distance / 1000;
      const duration_minutes = route.duration / 60;
      const base_fare = 10000;
      const price_per_km = 5000;
      const estimated_fare = Math.round(base_fare + distance_km * price_per_km);

      return {
        distance_km: Number(distance_km.toFixed(2)),
        estimated_fare,
        duration_minutes: Number(duration_minutes.toFixed(1)),
        route: route.geometry,
      };
    } catch (error) {
      console.error('[Estimate] Lỗi OSRM, dùng dữ liệu MOCK dự phòng:', error.message);
      // Dữ liệu MOCK dự phòng khi dịch vụ bản đồ sập
      const distance_km = 5.5; 
      const duration_minutes = 15;
      const base_fare = 10000;
      const price_per_km = 5000;
      const estimated_fare = Math.round(base_fare + distance_km * price_per_km);

      return {
        distance_km,
        estimated_fare,
        duration_minutes,
        failover: true,
        route: {
          type: 'LineString',
          coordinates: [
            [pickup_lng, pickup_lat],
            [pickup_lng + (dropoff_lng - pickup_lng) * 0.3, pickup_lat + (dropoff_lat - pickup_lat) * 0.4],
            [pickup_lng + (dropoff_lng - pickup_lng) * 0.7, pickup_lat + (dropoff_lat - pickup_lat) * 0.6],
            [dropoff_lng, dropoff_lat]
          ]
        },
      };
    }
  }
}
