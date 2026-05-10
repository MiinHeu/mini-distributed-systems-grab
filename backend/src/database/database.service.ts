import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { Region } from '../common/location.utils';
import { getSnowflake, Snowflake } from '../common/snowflake';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  northPrimary: Pool;
  northReplica: Pool;
  southPrimary: Pool;
  southReplica: Pool;

  private pools: Record<Region, { primary: Pool; replica: Pool }>;
  private snowflake: Snowflake;

  constructor() {
    const user = process.env.POSTGRES_USER || 'postgres';
    const password = process.env.POSTGRES_PASSWORD || 'postgres';
    const database = process.env.POSTGRES_DB || 'minigrab';

    const poolDefaults = {
      user,
      password,
      database,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      max: 10,
    };

    this.logger.log(`[DB Init] Khởi tạo các kết nối tới Database với user: ${user}`);

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

    this.northPrimary.on('error', (err) => this.logger.error(`[NORTH_PRIMARY] Error: ${err.message}`));
    this.northReplica.on('error', (err) => this.logger.error(`[NORTH_REPLICA] Error: ${err.message}`));
    this.southPrimary.on('error', (err) => this.logger.error(`[SOUTH_PRIMARY] Error: ${err.message}`));
    this.southReplica.on('error', (err) => this.logger.error(`[SOUTH_REPLICA] Error: ${err.message}`));

    this.pools = {
      [Region.NORTH]: { primary: this.northPrimary, replica: this.northReplica },
      [Region.SOUTH]: { primary: this.southPrimary, replica: this.southReplica },
    };

    const nodeId = Number(process.env.NODE_ID || 1);
    this.snowflake = getSnowflake(nodeId);
    this.logger.log(`[Snowflake Init] Khởi tạo bộ sinh ID với Node ID: ${nodeId}`);
  }

  public generateId(): string {
    return this.snowflake.nextId();
  }

  async queryWithFailover<T extends QueryResultRow = any>(
    region: Region,
    queryText: string,
    values?: any[],
    isWriteRequest = false,
  ): Promise<{ result: QueryResult<T>; isReadOnly: boolean }> {
    const regionPools = this.pools[region];
    const regionName = region === Region.NORTH ? 'Miền Bắc' : 'Miền Nam';

    try {
      const result = await regionPools.primary.query<T>(queryText, values);
      return { result, isReadOnly: false };
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      this.logger.warn(`[${region} Primary Down] Lỗi: ${errMsg}`);

      if (isWriteRequest) {
        throw new ServiceUnavailableException({
          readOnly: true,
          warning: `Hệ thống ${regionName} đang bảo trì (Primary DOWN). Chi tiết: ${errMsg}`,
          data: null,
        });
      }

      try {
        console.warn(`[Failover] ${region} Primary lỗi. Đang tự động chuyển hướng truy vấn sang REPLICA...`);
        const result = await regionPools.replica.query<T>(queryText, values);
        return { result, isReadOnly: true };
      } catch (replicaError: any) {
        const repErrMsg = replicaError?.message || String(replicaError);
        this.logger.error(`[${region} Replica Down] Toàn cụm sập: ${repErrMsg}`);
        throw new ServiceUnavailableException({
          readOnly: true,
          warning: `Toàn bộ cụm CSDL ${regionName} đang ngoại tuyến. Lỗi: ${repErrMsg}`,
          data: null,
        });
      }
    }
  }

  onModuleInit() {
    this.logger.log('🚀 Hệ thống Database đa vùng đã sẵn sàng.');
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
