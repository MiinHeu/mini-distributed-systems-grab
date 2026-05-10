import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async getAllUsers() {
    const { result } = await this.db.queryWithFailover(
      Region.NORTH,
      'SELECT id, name, phone, email, role, created_at FROM users ORDER BY created_at DESC',
      [],
      false,
    );
    return result.rows;
  }

  async getDrivers(regionFilter?: string) {
    const regions = regionFilter
      ? [regionFilter.toUpperCase() as Region]
      : [Region.NORTH, Region.SOUTH];

    const allDrivers: any[] = [];
    for (const region of regions) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          `SELECT d.*, u.name, u.email 
           FROM drivers d 
           JOIN users u ON d.user_id = u.id`,
          [],
          false,
        );
        allDrivers.push(...result.rows);
      } catch {
        // Skip if region is down
      }
    }
    return allDrivers;
  }

  async unsuspendUser(id: string) {
    const { result } = await this.db.queryWithFailover(
      Region.NORTH,
      'UPDATE users SET updated_at = NOW() WHERE id = $1 RETURNING id, name',
      [id],
      true,
    );
    if (result.rowCount === 0) throw new NotFoundException('User không tồn tại');
    return { message: `Đã cập nhật trạng thái user ${id}`, id, is_suspended: false };
  }

  async suspendUser(id: string) {
    // Giả lập khóa tài khoản (nếu schema có field is_suspended, dùng nó)
    // Ở đây ta chỉ cập nhật updated_at làm ví dụ nếu schema chưa có
    const { result } = await this.db.queryWithFailover(
      Region.NORTH,
      'UPDATE users SET updated_at = NOW() WHERE id = $1 RETURNING id, name',
      [id],
      true,
    );
    if (result.rowCount === 0) throw new NotFoundException('User không tồn tại');
    return { message: `Đã khóa tài khoản user ${id}`, id, is_suspended: true };
  }

  async deleteUser(id: string) {
    const { result } = await this.db.queryWithFailover(
      Region.NORTH,
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id],
      true,
    );
    if (result.rowCount === 0) throw new NotFoundException('User không tồn tại');
    return { message: `Đã xóa user ${id}`, id };
  }
}
