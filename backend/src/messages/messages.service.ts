import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';
import { SendMessageDto } from './dto/send-message.dto';

export interface Message {
  id: string;
  trip_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  type: 'text' | 'image';
  is_read: boolean;
  created_at: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Lấy region của trip để biết query vào DB nào
   */
  private async getTripRegion(tripId: number): Promise<Region> {
    // Thử NORTH trước, nếu không có thì SOUTH
    try {
      const res = await this.db.queryWithFailover(
        Region.NORTH,
        'SELECT region FROM trips WHERE id = $1 LIMIT 1',
        [tripId],
        false,
      );
      if (res.result.rowCount && res.result.rowCount > 0) {
        return (res.result.rows[0].region as Region) || Region.NORTH;
      }
    } catch {
      // NORTH không có, thử SOUTH
    }

    try {
      const res = await this.db.queryWithFailover(
        Region.SOUTH,
        'SELECT region FROM trips WHERE id = $1 LIMIT 1',
        [tripId],
        false,
      );
      if (res.result.rowCount && res.result.rowCount > 0) {
        return (res.result.rows[0].region as Region) || Region.SOUTH;
      }
    } catch {
      // cả 2 đều không có
    }

    // Default: lưu vào NORTH nếu không xác định được
    return Region.NORTH;
  }

  /**
   * Gửi tin nhắn mới — lưu vào DB theo region của trip
   */
  async sendMessage(senderId: number, dto: SendMessageDto): Promise<Message> {
    const region = await this.getTripRegion(dto.trip_id);

    const query = `
      INSERT INTO messages (trip_id, sender_id, receiver_id, content, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [dto.trip_id, senderId, dto.receiver_id, dto.content, dto.type ?? 'text'];

    const { result } = await this.db.queryWithFailover(region, query, values, true);
    return result.rows[0] as Message;
  }

  /**
   * Lấy lịch sử chat của 1 chuyến
   */
  async getMessagesByTrip(tripId: number): Promise<{
    data: Message[];
    total: number;
    readOnly: boolean;
  }> {
    const region = await this.getTripRegion(tripId);

    const query = `
      SELECT 
        m.*,
        u_sender.name AS sender_name,
        u_receiver.name AS receiver_name
      FROM messages m
      LEFT JOIN users u_sender ON m.sender_id = u_sender.id
      LEFT JOIN users u_receiver ON m.receiver_id = u_receiver.id
      WHERE m.trip_id = $1
      ORDER BY m.created_at ASC
    `;

    const { result, isReadOnly } = await this.db.queryWithFailover(region, query, [tripId], false);

    return {
      data: result.rows as Message[],
      total: result.rowCount ?? 0,
      readOnly: isReadOnly,
    };
  }

  /**
   * Đánh dấu tin nhắn đã đọc
   */
  async markAsRead(tripId: number, receiverId: number): Promise<{ updated: number }> {
    const region = await this.getTripRegion(tripId);

    const query = `
      UPDATE messages
      SET is_read = true
      WHERE trip_id = $1 AND receiver_id = $2 AND is_read = false
      RETURNING id
    `;

    const { result } = await this.db.queryWithFailover(region, query, [tripId, receiverId], true);

    return { updated: result.rowCount ?? 0 };
  }

  /**
   * Đếm tin nhắn chưa đọc của 1 user
   */
  async countUnread(userId: number): Promise<{ unread_count: number }> {
    // Query cả 2 region và cộng lại
    let total = 0;

    for (const region of [Region.NORTH, Region.SOUTH]) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          'SELECT COUNT(*) as cnt FROM messages WHERE receiver_id = $1 AND is_read = false',
          [userId],
          false,
        );
        total += parseInt(result.rows[0]?.cnt ?? '0', 10);
      } catch (err) {
        this.logger.warn(`[${region}] Không đếm được unread: ${(err as Error).message}`);
      }
    }

    return { unread_count: total };
  }
}
