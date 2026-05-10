import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async getAllUsers() {
    const regions = [Region.NORTH, Region.SOUTH];
    const userMap = new Map<string, any>();
    
    for (const region of regions) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          "SELECT id, name, phone, email, role, created_at, '" + region + "' as region FROM users ORDER BY created_at DESC",
          [],
          false,
        );
        for (const row of result.rows) {
          if (!userMap.has(row.id)) {
            userMap.set(row.id, row);
          }
        }
      } catch (err) {
        console.error(`Lỗi khi lấy user từ vùng ${region}:`, err.message);
      }
    }
    
    const allUsers = Array.from(userMap.values());
    return allUsers.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getDrivers(regionFilter?: string) {
    const regions = regionFilter
      ? [regionFilter.toUpperCase() as Region]
      : [Region.NORTH, Region.SOUTH];

    const driverMap = new Map<string, any>();
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
        for (const row of result.rows) {
          if (!driverMap.has(row.id)) {
            driverMap.set(row.id, row);
          }
        }
      } catch {
        // Skip if region is down
      }
    }
    return Array.from(driverMap.values());
  }

  async unsuspendUser(id: string) {
    for (const region of [Region.NORTH, Region.SOUTH]) {
      const { result } = await this.db.queryWithFailover(
        region,
        'UPDATE users SET updated_at = NOW() WHERE id = $1 RETURNING id, name',
        [id],
        true,
      );
      if (result && (result.rowCount ?? 0) > 0) {
        return { message: `Đã mở khóa user ${id} tại ${region}`, id, is_suspended: false };
      }
    }
    throw new NotFoundException('User không tồn tại ở bất kỳ khu vực nào');
  }

  async suspendUser(id: string) {
    for (const region of [Region.NORTH, Region.SOUTH]) {
      const { result } = await this.db.queryWithFailover(
        region,
        'UPDATE users SET updated_at = NOW() WHERE id = $1 RETURNING id, name',
        [id],
        true,
      );
      if (result && (result.rowCount ?? 0) > 0) {
        return { message: `Đã khóa tài khoản user ${id} tại ${region}`, id, is_suspended: true };
      }
    }
    throw new NotFoundException('User không tồn tại ở bất kỳ khu vực nào');
  }

  async deleteUser(id: string) {
    for (const region of [Region.NORTH, Region.SOUTH]) {
      const { result } = await this.db.queryWithFailover(
        region,
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id],
        true,
      );
      if (result && (result.rowCount ?? 0) > 0) {
        return { message: `Đã xóa user ${id} tại ${region}`, id };
      }
    }
    throw new NotFoundException('User không tồn tại ở bất kỳ khu vực nào');
  }
}
