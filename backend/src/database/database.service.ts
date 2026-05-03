import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
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
    const poolDefaults = {
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'minigrab',
      connectionTimeoutMillis: 3000, // Fail fast khi node down
      idleTimeoutMillis: 30000,
      max: 5,
    };

    this.northPrimary = new Pool({
      ...poolDefaults,
      host: process.env.DB_NORTH_PRIMARY_HOST || 'localhost',
      port: Number(process.env.DB_NORTH_PRIMARY_PORT || 5432),
    });

    this.northReplica = new Pool({
      ...poolDefaults,
      host: process.env.DB_NORTH_REPLICA_HOST || 'localhost',
      port: Number(process.env.DB_NORTH_REPLICA_PORT || 5433),
    });

    this.southPrimary = new Pool({
      ...poolDefaults,
      host: process.env.DB_SOUTH_PRIMARY_HOST || 'localhost',
      port: Number(process.env.DB_SOUTH_PRIMARY_PORT || 5434),
    });

    this.southReplica = new Pool({
      ...poolDefaults,
      host: process.env.DB_SOUTH_REPLICA_HOST || 'localhost',
      port: Number(process.env.DB_SOUTH_REPLICA_PORT || 5435),
    });

    // ▶ Quan trọng: Bắt lỗi "error" trên mỗi pool để TRÁNH crash process
    // Khi 1 node bị dừng đột ngột, idle connections bắn error event.
    // Nếu không có handler, Node.js coi đây là unhandled error → crash toàn bộ backend.
    this.northPrimary.on('error', (err) => {
      this.logger.warn(
        `[Pool Error] North Primary idle client error: ${err.message}`,
      );
    });
    this.northReplica.on('error', (err) => {
      this.logger.warn(
        `[Pool Error] North Replica idle client error: ${err.message}`,
      );
    });
    this.southPrimary.on('error', (err) => {
      this.logger.warn(
        `[Pool Error] South Primary idle client error: ${err.message}`,
      );
    });
    this.southReplica.on('error', (err) => {
      this.logger.warn(
        `[Pool Error] South Replica idle client error: ${err.message}`,
      );
    });

    // Tích hợp hệ thống Pool Failover của Người 4 dựa trên kết nối của Người 1
    this.pools = {
      [Region.NORTH]: {
        primary: this.northPrimary,
        replica: this.northReplica,
      },
      [Region.SOUTH]: {
        primary: this.southPrimary,
        replica: this.southReplica,
      },
    };
  }

  async queryWithFailover<T extends QueryResultRow = any>(
    region: Region,
    queryText: string,
    values?: any[],
    isWriteRequest = false,
  ): Promise<{ result: QueryResult<T>; isReadOnly: boolean }> {
    const regionPools = this.pools[region];
    try {
      const result = await regionPools.primary.query<T>(queryText, values);
      return { result, isReadOnly: false };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (isWriteRequest) {
        this.logger.error(`[${region} Primary Down] GHI LỖI: ${errMsg}`);
        throw new Error(`DATABASE_PRIMARY_DOWN_${region}`);
      }
      this.logger.warn(
        `[${region} Primary Down] Chuyển Read-Only: ${errMsg}`,
      );
      try {
        const result = await regionPools.replica.query<T>(queryText, values);
        return { result, isReadOnly: true };
      } catch (replicaError: unknown) {
        const repErrMsg = replicaError instanceof Error ? replicaError.message : String(replicaError);
        this.logger.error(
          `[${region} Replica Down] Toàn cụm sập: ${repErrMsg}`,
        );
        throw new Error(`DATABASE_CLUSTER_DOWN_${region}`);
      }
    }
  }

  onModuleInit() {
    this.logger.log(
      'Đã khởi tạo Database pools cho 4 nodes (Sẵn sàng Failover).',
    );
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
