import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { Region } from '../common/location.utils';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  // Connection pools quản lý 4 nodes
  private pools: Record<Region, { primary: Pool; replica: Pool }> = {
    [Region.NORTH]: {
      primary: new Pool({
        host: process.env.DB_NORTH_PRIMARY_HOST || 'localhost',
        port: parseInt(process.env.DB_NORTH_PRIMARY_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'minigrab',
      }),
      replica: new Pool({
        host: process.env.DB_NORTH_REPLICA_HOST || 'localhost',
        port: parseInt(process.env.DB_NORTH_REPLICA_PORT || '5433', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'minigrab',
      }),
    },
    [Region.SOUTH]: {
      primary: new Pool({
        host: process.env.DB_SOUTH_PRIMARY_HOST || 'localhost',
        port: parseInt(process.env.DB_SOUTH_PRIMARY_PORT || '5434', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'minigrab',
      }),
      replica: new Pool({
        host: process.env.DB_SOUTH_REPLICA_HOST || 'localhost',
        port: parseInt(process.env.DB_SOUTH_REPLICA_PORT || '5435', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'minigrab',
      }),
    },
  };

  /**
   * Helper function logic Failover Router (Của Người 9, áp dụng cho API Người 4)
   * @param isWriteRequest Nếu là Ghi -> bắt buộc vào Primary (sập thì báo lỗi). Ngược lại -> ReadOnly từ Replica nếu Primary sập.
   */
  async queryWithFailover<T = any>(
    region: Region,
    queryText: string,
    values?: any[],
    isWriteRequest = false,
  ): Promise<{ result: QueryResult<T>; isReadOnly: boolean }> {
    const regionPools = this.pools[region];

    try {
      // Ưu tiên gọi Primary node (bất kể đọc/ghi để đảm bảo data fresh nhất)
      const result = await regionPools.primary.query<T>(queryText, values);
      return { result, isReadOnly: false };
    } catch (error) {
      if (isWriteRequest) {
        // Ghi (ví dụ cập nhật tọa độ) mà Primary down -> ném lỗi
        this.logger.error(`[${region} Primary Down] Không thể ghi dữ liệu: ${error.message}`);
        throw new Error(`DATABASE_PRIMARY_DOWN_${region}`);
      }

      // Nếu là query READ và Primary sập -> Fallback sang Replica (Read-Only Mode)
      this.logger.warn(`[${region} Primary Down] Đang chuyển sang chế độ Read-Only trên Replica: ${error.message}`);
      try {
        const result = await regionPools.replica.query<T>(queryText, values);
        return { result, isReadOnly: true };
      } catch (replicaError) {
        this.logger.error(`[${region} Replica Down] Toàn bộ cluster sập: ${replicaError.message}`);
        throw new Error(`DATABASE_CLUSTER_DOWN_${region}`);
      }
    }
  }

  async onModuleInit() {
    this.logger.log('Đã khởi tạo Database pools cho 4 nodes.');
  }

  async onModuleDestroy() {
    await Promise.all([
      this.pools.NORTH.primary.end(),
      this.pools.NORTH.replica.end(),
      this.pools.SOUTH.primary.end(),
      this.pools.SOUTH.replica.end(),
    ]);
  }
}
