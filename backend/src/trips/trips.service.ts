import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class TripsService {
  constructor(
    @InjectDataSource('primary') private primaryDS: DataSource,
    @InjectDataSource('replica') private replicaDS: DataSource,
  ) {}

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
      warning = 'Hệ thống đang trong chế độ chỉ đọc. Không thể đặt chuyến mới.';
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
      throw new ServiceUnavailableException(
        'Không thể đặt chuyến khi hệ thống đang ở chế độ chỉ đọc',
      );
    }

    const result = await this.primaryDS.query(
      `INSERT INTO trips (customer_id, driver_id, status, pickup_address, dropoff_address, fare)
       VALUES ($1, 1, 'pending', $2, $3, 0)
       RETURNING *`,
      [userId, body.pickup, body.dropoff],
    );

    return { message: 'Đặt chuyến thành công', trip: result[0] };
  }
  async bookTripLegacy(data: any) {
    try {
      await this.primaryDS.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Hệ thống đang ở chế độ chỉ đọc');
    }
    const result = await this.primaryDS.query(
      `INSERT INTO trips (customer_id, driver_id, status, pickup_address, dropoff_address, fare, region)
       VALUES (1, 1, 'pending', $1, $2, 0, 'south')
       RETURNING *`,
      [data.pickup || '', data.dropoff || ''],
    );
    return result[0];
  }

  async getTripById(id: number) {
    const result = await this.primaryDS.query(
      `SELECT * FROM trips WHERE id = $1`,
      [id],
    );
    return result[0] || null;
  }

  async cancelTrip(id: number) {
    const trip = await this.getTripById(id);
    if (!trip) return { message: 'Trip not found' };
    await this.primaryDS.query(
      `UPDATE trips SET status = 'cancelled' WHERE id = $1`,
      [id],
    );
    return { message: 'Trip cancelled' };
  }
}
