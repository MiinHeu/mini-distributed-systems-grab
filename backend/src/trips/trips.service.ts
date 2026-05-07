import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';
import { Trip, TripStatus } from './entities/trip.entity';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { DbRoutingService } from '../db-routing/db-routing.service';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepository: Repository<Trip>,
    @InjectDataSource() private primaryDS: DataSource,
    @InjectDataSource('replica') private replicaDS: DataSource,
    private readonly database: DatabaseService,
    private readonly httpService: HttpService,
    private readonly dbRouting: DbRoutingService,
  ) {}

  async bookTripLegacy(data: Partial<Trip>) {
    const trip = this.tripRepository.create({
      ...data,
      status: TripStatus.PENDING,
    });
    return await this.tripRepository.save(trip);
  }

  async getTripById(id: number) {
    return await this.tripRepository.findOne({ where: { id } });
  }

  async cancelTrip(id: number) {
    const trip = await this.tripRepository.findOne({ where: { id } });
    if (!trip) return { message: 'Trip not found' };
    trip.status = TripStatus.CANCELLED;
    return await this.tripRepository.save(trip);
  }

  async getPendingTrips(regionRaw: string) {
    const region = this.normalizeRegion(regionRaw);
    const { result, isReadOnly } = await this.database.queryWithFailover<Trip>(
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

  async acceptTrip(tripId: number, userId: number) {
    const region = await this.findTripRegion(tripId);
    
    // Tìm driver_id (UUID) của user này trong vùng tương ứng
    const driverRes = await this.database.queryWithFailover(
      region,
      `SELECT id FROM drivers WHERE user_id = $1 AND region = $2 LIMIT 1`,
      [userId, region],
      false
    );

    if (driverRes.result.rowCount === 0) {
      throw new BadRequestException('Bạn chưa có hồ sơ tài xế trong vùng này.');
    }

    const driverId = driverRes.result.rows[0].id;

    try {
      const { result } = await this.database.queryWithFailover<Trip>(
        region,
        `UPDATE trips
         SET status = 'accepted', driver_id = $1, completed_at = NULL
         WHERE id = $2 AND status = 'pending'
         RETURNING *`,
        [driverId, tripId],
        true,
      );
      if (result.rowCount === 0) {
        throw new ConflictException('Trip was already accepted or is no longer pending');
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      throw new ConflictException('Primary database is read-only, cannot accept trip');
    }
  }

  async completeTrip(tripId: number, userId: number) {
    const region = await this.findTripRegion(tripId);
    
    // Tìm driver_id (UUID) của user này
    const driverRes = await this.database.queryWithFailover(
      region,
      `SELECT id FROM drivers WHERE user_id = $1 AND region = $2 LIMIT 1`,
      [userId, region],
      false
    );

    if (driverRes.result.rowCount === 0) {
      throw new BadRequestException('Bạn chưa có hồ sơ tài xế trong vùng này.');
    }

    const driverId = driverRes.result.rows[0].id;

    try {
      const { result } = await this.database.queryWithFailover<Trip>(
        region,
        `UPDATE trips
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1 AND status = 'accepted' AND driver_id = $2
         RETURNING *`,
        [tripId, driverId],
        true,
      );
      if (result.rowCount === 0) {
        throw new NotFoundException('No accepted trip found for this driver');
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new ConflictException('Primary database is read-only, cannot complete trip');
    }
  }

  rejectTrip(tripId: number, driverId: number) {
    return { message: 'Trip rejected', trip_id: tripId, driver_id: driverId };
  }

  async getTripHistory(userId: number) {
    // Để demo Tầng 1, ta sẽ lấy lịch sử từ cả 2 miền (North & South)
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

    const [northRes, southRes] = await Promise.all([
      this.database.queryWithFailover(Region.NORTH, query, [userId], false),
      this.database.queryWithFailover(Region.SOUTH, query, [userId], false),
    ]);

    const allTrips = [...northRes.result.rows, ...southRes.result.rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      readOnly: northRes.isReadOnly || southRes.isReadOnly,
      activeNode: northRes.isReadOnly ? 'replica' : 'primary',
      data: allTrips,
    };
  }

  async getTripHistoryAdmin(userId: number) {
    return this.getTripHistory(userId);
  }

  async bookTrip(body: any, userId: number) {
    const ctx = this.dbRouting.getWriteContext(body.pickup_lat);
    
    const result = await ctx.pool.query(
      `INSERT INTO trips (
        customer_id, status, pickup_address, dropoff_address, 
        pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, 
        fare, region
      )
      VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        body.pickup || 'Unknown',
        body.dropoff || 'Unknown',
        body.pickup_lat,
        body.pickup_lng,
        body.dropoff_lat,
        body.dropoff_lng,
        body.fare || 0,
        ctx.region.toUpperCase(),
      ],
    );
    
    const trip = result.rows[0];
    return { 
      message: 'Đặt chuyến thành công', 
      trip,
      region: ctx.region,
      activeNode: ctx.activeNode 
    };
  }

  private normalizeRegion(regionRaw: string): Region {
    return regionRaw === Region.NORTH ? Region.NORTH : Region.SOUTH;
  }

  private async findTripRegion(tripId: number): Promise<Region> {
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
   * Người 2 — Tầng 2: POST /trips/estimate
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
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Không thể kết nối đến dịch vụ tính đường đi');
    }
  }
}
