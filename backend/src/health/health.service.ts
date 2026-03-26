import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export type NodeStatus = 'online' | 'offline';
export type ServiceLevel = 'full' | 'readonly' | 'unavailable';

export interface HealthNodes {
  northPrimary: NodeStatus;
  northReplica: NodeStatus;
  southPrimary: NodeStatus;
  southReplica: NodeStatus;
}

export interface HealthServiceLevel {
  north: ServiceLevel;
  south: ServiceLevel;
}

export interface HealthResponse {
  nodes: HealthNodes;
  serviceLevel: HealthServiceLevel;
}

export type PartialNodes = Partial<HealthNodes>;

export interface NorthHealthResponse {
  nodes: Pick<HealthNodes, 'northPrimary' | 'northReplica'>;
  serviceLevel: { north: ServiceLevel };
}

export interface SouthHealthResponse {
  nodes: Pick<HealthNodes, 'southPrimary' | 'southReplica'>;
  serviceLevel: { south: ServiceLevel };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);

  private readonly pools: {
    northPrimary: Pool;
    northReplica: Pool;
    southPrimary: Pool;
    southReplica: Pool;
  };

  constructor() {
    const user = requireEnv('POSTGRES_USER');
    const password = requireEnv('POSTGRES_PASSWORD');
    const database = requireEnv('POSTGRES_DB');

    this.pools = {
      northPrimary: this.createPool({
        host: requireEnv('DB_NORTH_PRIMARY_HOST'),
        port: Number(process.env.DB_NORTH_PRIMARY_PORT ?? 5432),
        user,
        password,
        database,
      }),
      northReplica: this.createPool({
        host: requireEnv('DB_NORTH_REPLICA_HOST'),
        port: Number(process.env.DB_NORTH_REPLICA_PORT ?? 5433),
        user,
        password,
        database,
      }),
      southPrimary: this.createPool({
        host: requireEnv('DB_SOUTH_PRIMARY_HOST'),
        port: Number(process.env.DB_SOUTH_PRIMARY_PORT ?? 5434),
        user,
        password,
        database,
      }),
      southReplica: this.createPool({
        host: requireEnv('DB_SOUTH_REPLICA_HOST'),
        port: Number(process.env.DB_SOUTH_REPLICA_PORT ?? 5435),
        user,
        password,
        database,
      }),
    };
  }

  private createPool(cfg: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Pool {
    // max: 1 để giảm tài nguyên trong health check.
    const pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      max: 1,
      // Nếu bạn dùng SSL, có thể bật thêm ssl: { rejectUnauthorized: false }
      // theo môi trường của bạn.
    });

    // Quan trọng: khi container PostgreSQL bị stop, `pg` có thể phát sinh event `error`.
    // Nếu không attach handler thì Node sẽ crash vì unhandled 'error' event.
    pool.on('error', (err: Error) => {
      this.logger.warn(`pg pool error (${cfg.host}:${cfg.port}/${cfg.database}): ${err.message}`);
    });

    return pool;
  }

  async onModuleDestroy() {
    // pg Pool end() không trả Promise trong mọi phiên bản, nên dùng await kiểu "best effort".
    try {
      Object.values(this.pools).forEach((p) => p.end());
    } catch (e) {
      this.logger.warn(`Failed to close pg pools: ${(e as Error).message}`);
    }
  }

  async checkNode(connection: Pool): Promise<NodeStatus> {
    try {
      await connection.query('SELECT 1;');
      return 'online';
    } catch (err) {
      this.logger.warn(`Node check failed: ${(err as Error).message}`);
      return 'offline';
    }
  }

  getServiceLevel(primary: NodeStatus, replica: NodeStatus): ServiceLevel {
    if (primary === 'online') return 'full';
    if (primary === 'offline' && replica === 'online') return 'readonly';
    return 'unavailable';
  }

  async getHealth(): Promise<HealthResponse> {
    const [northPrimary, northReplica, southPrimary, southReplica] = await Promise.all([
      this.checkNode(this.pools.northPrimary),
      this.checkNode(this.pools.northReplica),
      this.checkNode(this.pools.southPrimary),
      this.checkNode(this.pools.southReplica),
    ]);

    return {
      nodes: {
        northPrimary,
        northReplica,
        southPrimary,
        southReplica,
      },
      serviceLevel: {
        north: this.getServiceLevel(northPrimary, northReplica),
        south: this.getServiceLevel(southPrimary, southReplica),
      },
    };
  }

  async getNorthHealth(): Promise<NorthHealthResponse> {
    const [northPrimary, northReplica] = await Promise.all([
      this.checkNode(this.pools.northPrimary),
      this.checkNode(this.pools.northReplica),
    ]);

    return {
      nodes: { northPrimary, northReplica },
      serviceLevel: { north: this.getServiceLevel(northPrimary, northReplica) },
    };
  }

  async getSouthHealth(): Promise<SouthHealthResponse> {
    const [southPrimary, southReplica] = await Promise.all([
      this.checkNode(this.pools.southPrimary),
      this.checkNode(this.pools.southReplica),
    ]);

    return {
      nodes: { southPrimary, southReplica },
      serviceLevel: { south: this.getServiceLevel(southPrimary, southReplica) },
    };
  }
}

