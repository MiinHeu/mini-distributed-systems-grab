import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';
import { Trip } from './entities/trip.entity';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepository: Repository<Trip>,
    @InjectDataSource() private primaryDS: DataSource,
    @InjectDataSource('replica') private replicaDS: DataSource,
    private readonly database: DatabaseService,
  ) {}

  async bookTripLegacy(data: Partial<Trip>) {
    const trip = this.tripRepository.create({
      ...data,
      status: 'pending',
    });
    return await this.tripRepository.save(trip);
  }

  async getTripById(id: number) {
    return await this.tripRepository.findOne({ where: { id } });
  }

  async cancelTrip(id: number) {
    const trip = await this.tripRepository.findOne({ where: { id } });
    if (!trip) return { message: 'Trip not found' };
    trip.status = 'cancelled';
    return await this.tripRepository.save(trip);
  }

  async getPendingTrips(regionRaw: string) {
    const region = this.normalizeRegion(regionRaw);
    const { result, isReadOnly } = await this.database.queryWithFailover<Trip>(
      region,
      `SELECT
         id,
         customer_id,
         driver_id,
         pickup_address,
         dropoff_address,
         pickup_lat,
         pickup_lng,
         dropoff_lat,
         dropoff_lng,
         distance_km,
         fare,
         region,
         status,
         created_at,
         completed_at
       FROM trips
       WHERE status = 'pending'
         AND region = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [region],
    );

    return { trips: result.rows, isReadOnly };
  }

  async acceptTrip(tripId: number, driverId: number) {
    const region = await this.findTripRegion(tripId);

    try {
      const { result } = await this.database.queryWithFailover<Trip>(
        region,
        `UPDATE trips
         SET status = 'accepted', driver_id = $1, completed_at = NULL
         WHERE id = $2
           AND status = 'pending'
         RETURNING *`,
        [driverId, tripId],
        true,
      );

      if (result.rowCount === 0) {
        throw new ConflictException('Trip was already accepted or is no longer pending');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException('Primary database is read-only, cannot accept trip');
    }
  }

  async completeTrip(tripId: number, driverId: number) {
    const region = await this.findTripRegion(tripId);

    try {
      const { result } = await this.database.queryWithFailover<Trip>(
        region,
        `UPDATE trips
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1
           AND status = 'accepted'
           AND driver_id = $2
         RETURNING *`,
        [tripId, driverId],
        true,
      );

      if (result.rowCount === 0) {
        throw new NotFoundException('No accepted trip found for this driver');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException('Primary database is read-only, cannot complete trip');
    }
  }

  rejectTrip(tripId: number, driverId: number) {
    return {
      message: 'Trip rejected',
      trip_id: tripId,
      driver_id: driverId,
    };
  }

  async getTripHistory(userId: number) {
    let ds: DataSource;
    let readOnly = false;
    let activeNode: string;
    let warning: string | null = null;

    try {
      await this.primaryDS.query('SELECT 1');
      ds = this.primaryDS;
      activeNode = 'southPrimary';
    } catch {
      ds = this.replicaDS;
      readOnly = true;
      activeNode = 'southReplica';
      warning = 'He thong dang trong che do chi doc. Khong the dat chuyen moi.';
    }

    const trips = await ds.query(
      `SELECT
         t.id, t.status, t.pickup_address, t.dropoff_address, t.fare, t.created_at,
         u.name AS customer_name, d.name AS driver_name
       FROM trips t
       LEFT JOIN users u ON t.customer_id = u.id
       LEFT JOIN users d ON t.driver_id = d.id
       WHERE t.customer_id = $1
       ORDER BY t.created_at DESC`,
      [userId],
    );

    return { readOnly, warning, activeNode, data: trips };
  }

  async getTripHistoryAdmin(userId: number) {
    return this.primaryDS.query(
      `SELECT t.*, u.name AS customer_name, d.name AS driver_name
       FROM trips t
       LEFT JOIN users u ON t.customer_id = u.id
       LEFT JOIN users d ON t.driver_id = d.id
       WHERE t.customer_id = $1
       ORDER BY t.created_at DESC`,
      [userId],
    );
  }

  async bookTrip(body: any, userId: number) {
    try {
      await this.primaryDS.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Khong the dat chuyen khi he thong dang o che do chi doc');
    }

    const result = await this.primaryDS.query(
      `INSERT INTO trips (customer_id, driver_id, status, pickup_address, dropoff_address, fare)
       VALUES ($1, 1, 'pending', $2, $3, 0)
       RETURNING *`,
      [userId, body.pickup, body.dropoff],
    );

    return { message: 'Dat chuyen thanh cong', trip: result[0] };
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
}
