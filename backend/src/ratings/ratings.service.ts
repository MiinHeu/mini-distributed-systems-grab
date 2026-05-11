import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';

@Injectable()
export class RatingsService {
  constructor(private readonly db: DatabaseService) {}

  async createRating(body: any, customerId: number) {
    const { trip_id, score, comment } = body;

    if (!score || score < 1 || score > 5) {
      throw new BadRequestException('Score phải từ 1 đến 5');
    }

    // Tìm trip ở cả 2 region
    let trip: any = null;
    let tripRegion: Region = Region.SOUTH;
    for (const region of [Region.SOUTH, Region.NORTH]) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          `SELECT * FROM trips WHERE id = $1`,
          [trip_id],
          false,
        );
        if (result.rows.length > 0) {
          trip = result.rows[0];
          tripRegion = region;
          break;
        }
      } catch { /* thử region kia */ }
    }

    if (!trip) {
      throw new BadRequestException('Chuyến đi không tồn tại');
    }

    if (trip.status !== 'completed') {
      throw new BadRequestException('Chỉ có thể đánh giá chuyến đã hoàn thành');
    }

    // Kiểm tra đã đánh giá chưa
    const { result: existingResult } = await this.db.queryWithFailover(
      tripRegion,
      `SELECT id FROM ratings WHERE trip_id = $1 AND customer_id = $2`,
      [trip_id, customerId],
      false,
    );

    if (existingResult.rows.length > 0) {
      throw new ConflictException('Chuyến đi này đã được đánh giá');
    }

    // Tạo rating
    const ratingId = this.db.generateId();
    const { result } = await this.db.queryWithFailover(
      tripRegion,
      `INSERT INTO ratings (id, trip_id, customer_id, driver_id, score, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ratingId, trip_id, customerId, trip.driver_id, score, comment || null],
      true,
    );

    // Cập nhật điểm đánh giá trung bình của tài xế trên TOÀN HỆ THỐNG
    const allRegions = [Region.NORTH, Region.SOUTH];
    for (const r of allRegions) {
      try {
        const { result: avgRes } = await this.db.queryWithFailover(
          r,
          `SELECT AVG(score)::numeric(10,2) as avg_score FROM ratings WHERE driver_id = $1`,
          [trip.driver_id],
          false,
        );
        const newAvg = avgRes.rows[0].avg_score || score;

        await this.db.queryWithFailover(
          r,
          `UPDATE drivers SET rating = $1 WHERE id = $2`,
          [newAvg, trip.driver_id],
          true,
        );
      } catch (err) {
        // Bỏ qua nếu vùng kia sập
      }
    }

    return {
      message: 'Đánh giá thành công',
      rating: result.rows[0],
    };
  }

  async getDriverRatings(driverId: number) {
    // Query cả 2 region, gộp kết quả
    const allRatings: any[] = [];
    for (const region of [Region.NORTH, Region.SOUTH]) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          `SELECT r.*, u.name AS customer_name
           FROM ratings r
           JOIN users u ON r.customer_id = u.id
           WHERE r.driver_id = $1
           ORDER BY r.created_at DESC`,
          [driverId],
          false,
        );
        allRatings.push(...result.rows);
      } catch {
        // node down, bỏ qua
      }
    }

    const avg = allRatings.length
      ? allRatings.reduce((sum, r) => sum + Number(r.score), 0) / allRatings.length
      : 0;

    return {
      driver_id: driverId,
      average_score: Math.round(avg * 10) / 10,
      total_ratings: allRatings.length,
      ratings: allRatings,
    };
  }
}
