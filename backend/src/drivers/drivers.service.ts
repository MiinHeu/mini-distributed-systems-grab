import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { determineRegionFromLocation, Region } from '../common/location.utils';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { GetNearbyDriversDto } from './dto/get-nearby.dto';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);
  constructor(private readonly db: DatabaseService) {}

  /**
   * Cập nhật vị trí GPS (10s 1 lần)
   */
  async updateLocation(dto: UpdateLocationDto) {
    const region = determineRegionFromLocation(dto.latitude);
    const allRegions = [Region.NORTH, Region.SOUTH];
    let updatedDriver: any = null;

    for (const r of allRegions) {
      try {
        const { result } = await this.db.queryWithFailover(
          r,
          `UPDATE drivers SET latitude = $1, longitude = $2, region = $3 WHERE id = $4 RETURNING *`,
          [dto.latitude, dto.longitude, region, dto.driver_id],
          true,
        );
        if (r === region && result.rowCount && result.rowCount > 0) {
          updatedDriver = result.rows[0];
        }
      } catch (err) {
        // Bỏ qua nếu vùng kia sập
      }
    }

    if (!updatedDriver) {
      throw new NotFoundException(`Không tìm thấy tài xế ${dto.driver_id} trong hệ thống.`);
    }

    return {
      message: 'Đã cập nhật vị trí trên toàn hệ thống',
      driver: updatedDriver,
      region_routed_to: region,
    };
  }

  /**
   * Tìm region của tài xế bằng cách thử cả 2 node
   * Dùng khi frontend không biết region (ví dụ lần đầu đăng nhập)
   */
  private async findDriverRegion(driverId: string): Promise<Region> {
    const query = `SELECT region FROM drivers WHERE id = $1 OR user_id = $1 LIMIT 1`;
    for (const region of [Region.NORTH, Region.SOUTH]) {
      try {
        const res = await this.db.queryWithFailover(region, query, [driverId], false);
        if (res.result.rowCount && res.result.rowCount > 0) {
          return (res.result.rows[0].region as Region) ?? region;
        }
      } catch {
        // node này không có, thử node kia
      }
    }
    return Region.NORTH; // fallback cuối cùng
  }

  /**
   * Cập nhật trạng thái rảnh/bận
   */
  async updateAvailability(dto: UpdateAvailabilityDto) {
    const driverId = dto.driver_id || '';
    const region: Region = dto.region
      ? (dto.region as Region)
      : await this.findDriverRegion(driverId);

    this.logger.log(`Đã xác định region cho driver ${driverId}: ${region}`);

    const query = `
      UPDATE drivers 
      SET is_available = $1 
      WHERE id = $2 OR user_id = $2
      RETURNING *;
    `;
    const values = [dto.is_available, driverId];

    const { result } = await this.db.queryWithFailover(
      region,
      query,
      values,
      true,
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Không tìm thấy tài xế ${dto.driver_id}`);
    }

    return {
      message: dto.is_available ? 'Đang sẵn sàng đón khách' : 'Đã nghỉ/bận',
      driver: result.rows[0],
      region_routed_to: region,
    };
  }

  /**
   * Tìm tài xế lân cận
   */
  async getNearbyDrivers(dto: GetNearbyDriversDto) {
    const region = determineRegionFromLocation(dto.lat);
    const radiusMeters = (dto.radius_km || 5) * 1000;

    const query = `
      SELECT id, user_id, vehicle_plate, vehicle_type, rating, latitude, longitude,
        (earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) / 1000)::numeric(10,2) AS distance_km
      FROM drivers
      WHERE is_available = true 
        AND vehicle_type = $3
        AND earth_box(ll_to_earth($1, $2), $4) @> ll_to_earth(latitude, longitude)
        AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) <= $4
      ORDER BY 
        distance_km ASC, rating DESC
      LIMIT 10;
    `;
    const values = [dto.lat, dto.lng, dto.vehicle_type, radiusMeters];

    // isWriteRequest = false -> Được phép Fallback Read-Only Mode bằng Replica nếu Primary sập
    const { result, isReadOnly } = await this.db.queryWithFailover(
      region,
      query,
      values,
      false,
    );

    return {
      metadata: {
        region_routed_to: region,
        is_read_only_fallback: isReadOnly,
        total_found: result.rowCount,
      },
      data: result.rows,
    };
  }

  /**
   * Truy xuất thông tin tài xế theo ID
   */
  async getDriverById(id: string, region: Region = Region.NORTH) {
    const query = `SELECT * FROM drivers WHERE id = $1`;
    try {
      let res = await this.db.queryWithFailover(region, query, [id], false);
      if (res.result.rowCount === 0) {
        const fallBackRegion =
          region === Region.NORTH ? Region.SOUTH : Region.NORTH;
        res = await this.db.queryWithFailover(
          fallBackRegion,
          query,
          [id],
          false,
        );
      }

      if (res.result.rowCount === 0) {
        throw new NotFoundException(
          'Không tìm thấy tài xế này trên bất kỳ CSDL nào.',
        );
      }

      return res.result.rows[0];
    } catch (e) {
      throw e;
    }
  }

  /**
   * Tìm tất cả driver records của 1 user_id trong 1 region
   * Dùng cho mobile: sau khi login, tìm driver_id của mình
   */
  async getDriversByUserId(userId: string, regionRaw?: string) {
    const query = `
      SELECT id, user_id, vehicle_plate, vehicle_type, is_available,
             latitude, longitude, region, rating, total_trips
      FROM drivers
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    // Nếu có region được chỉ định từ client (header/query), thử vùng đó trước
    const targetRegion = regionRaw === 'NORTH' ? Region.NORTH : Region.SOUTH;
    
    for (const r of [targetRegion, targetRegion === Region.NORTH ? Region.SOUTH : Region.NORTH]) {
      try {
        const { result } = await this.db.queryWithFailover(r, query, [userId], false);
        if (result.rowCount && result.rowCount > 0) return result.rows;
      } catch (e) {
        // Vùng này sập, thử vùng kia
      }
    }
    return [];
  }
}
