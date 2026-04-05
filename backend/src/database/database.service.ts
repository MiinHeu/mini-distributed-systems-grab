import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { Region } from '../common/location.utils';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  northPrimary: Pool;
  northReplica: Pool;
  southPrimary: Pool;
  southReplica: Pool;

  // Connection pools quản lý 4 nodes cho Failover (Driver Module)
  private pools: Record<Region, { primary: Pool; replica: Pool }>;

  constructor() {
    this.northPrimary = new Pool({
      host: process.env.DB_NORTH_PRIMARY_HOST || 'localhost',
      port: Number(process.env.DB_NORTH_PRIMARY_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'minigrab',
    });

    this.northReplica = new Pool({
      host: process.env.DB_NORTH_REPLICA_HOST || 'localhost',
      port: Number(process.env.DB_NORTH_REPLICA_PORT || 5433),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'minigrab',
    });

    this.southPrimary = new Pool({
      host: process.env.DB_SOUTH_PRIMARY_HOST || 'localhost',
      port: Number(process.env.DB_SOUTH_PRIMARY_PORT || 5434),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'minigrab',
    });

    this.southReplica = new Pool({
      host: process.env.DB_SOUTH_REPLICA_HOST || 'localhost',
      port: Number(process.env.DB_SOUTH_REPLICA_PORT || 5435),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'minigrab',
    });

    // Tích hợp hệ thống Pool Failover của Người 4 dựa trên kết nối của Người 1
    this.pools = {
      [Region.NORTH]: { primary: this.northPrimary, replica: this.northReplica },
      [Region.SOUTH]: { primary: this.southPrimary, replica: this.southReplica },
    };
  }

  async queryWithFailover<T = any>(
    region: Region,
    queryText: string,
    values?: any[],
    isWriteRequest = false,
  ): Promise<{ result: QueryResult<T>; isReadOnly: boolean }> {
    const regionPools = this.pools[region];
    try {
      const result = await regionPools.primary.query<T>(queryText, values);
      return { result, isReadOnly: false };
    } catch (error) {
      if (isWriteRequest) {
        this.logger.error(`[${region} Primary Down] GHI LỖI: ${error.message}`);
        throw new Error(`DATABASE_PRIMARY_DOWN_${region}`);
      }
      this.logger.warn(`[${region} Primary Down] Chuyển Read-Only: ${error.message}`);
      try {
        const result = await regionPools.replica.query<T>(queryText, values);
        return { result, isReadOnly: true };
      } catch (replicaError) {
        this.logger.error(`[${region} Replica Down] Toàn cụm sập: ${replicaError.message}`);
        throw new Error(`DATABASE_CLUSTER_DOWN_${region}`);
      }
    }
  }

  async onModuleInit() {
    this.logger.log('Đã khởi tạo Database pools cho 4 nodes (Sẵn sàng Failover).');
  }

  async onModuleDestroy() {
    await Promise.all([
      this.northPrimary.end(),
      this.northReplica.end(),
      this.southPrimary.end(),
      this.southReplica.end(),
    ]);
  }
}
