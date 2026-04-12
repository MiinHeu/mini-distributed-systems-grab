import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class RatingsService {
  constructor(
    @InjectDataSource('primary') private primaryDS: DataSource,
  ) {}

  async createRating(body: any, customerId: number) {
    const { trip_id, score, comment } = body;

    // Validate score 1-5
    if (!score || score < 1 || score > 5) {
      throw new BadRequestException('Score phải từ 1 đến 5');
    }

    // Kiểm tra chuyến đã completed chưa
    const trip = await this.primaryDS.query(
      `SELECT * FROM trips WHERE id = $1`,
      [trip_id],
    );

    if (!trip.length) {
      throw new BadRequestException('Chuyến đi không tồn tại');
    }

    if (trip[0].status !== 'completed') {
      throw new BadRequestException('Chỉ có thể đánh giá chuyến đã hoàn thành');
    }

    // Kiểm tra đã đánh giá chưa
    const existing = await this.primaryDS.query(
      `SELECT * FROM ratings WHERE trip_id = $1 AND customer_id = $2`,
      [trip_id, customerId],
    );

    if (existing.length) {
      throw new ConflictException('Chuyến đi này đã được đánh giá');
    }

    // Tạo rating
    const result = await this.primaryDS.query(
      `INSERT INTO ratings (trip_id, customer_id, driver_id, score, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [trip_id, customerId, trip[0].driver_id, score, comment || null],
    );

    return {
      message: 'Đánh giá thành công',
      rating: result[0],
    };
  }

  async getDriverRatings(driverId: number) {
    const ratings = await this.primaryDS.query(
      `SELECT r.*, u.name AS customer_name
       FROM ratings r
       JOIN users u ON r.customer_id = u.id
       WHERE r.driver_id = $1
       ORDER BY r.created_at DESC`,
      [driverId],
    );

    // Tính điểm trung bình
    const avg = ratings.length
      ? ratings.reduce((sum: number, r: any) => sum + r.score, 0) / ratings.length
      : 0;

    return {
      driver_id: driverId,
      average_score: Math.round(avg * 10) / 10,
      total_ratings: ratings.length,
      ratings,
    };
  }
}
