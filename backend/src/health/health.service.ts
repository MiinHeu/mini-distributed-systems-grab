import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export type NodeStatus = 'online' | 'offline';
export type ServiceLevel = 'full' | 'readonly' | 'unavailable';

// ===== Mới: Enhanced Types =====
export interface NodeMetrics {
  status: NodeStatus;
  latencyMs: number;
  lastCheckTime: number;
}

export type FailoverEventType = 'primary_failed' | 'primary_recovered' | 'replica_promoted';

export interface FailoverEvent {
  timestamp: number;
  region: 'north' | 'south';
  eventType: FailoverEventType;
  message: string;
}

export interface HealthNodes {
  northPrimary: NodeMetrics;
  northReplica: NodeMetrics;
  southPrimary: NodeMetrics;
  southReplica: NodeMetrics;
}

export interface HealthServiceLevel {
  north: ServiceLevel;
  south: ServiceLevel;
}

export interface HealthResponse {
  nodes: HealthNodes;
  serviceLevel: HealthServiceLevel;
  failoverEvents: FailoverEvent[]; // Mới!
  lastUpdated: number; // Mới!
}

export type PartialNodes = Partial<HealthNodes>;

export interface NorthHealthResponse {
  nodes: Pick<HealthNodes, 'northPrimary' | 'northReplica'>;
  serviceLevel: { north: ServiceLevel };
  failoverEvents: FailoverEvent[];
}

export interface SouthHealthResponse {
  nodes: Pick<HealthNodes, 'southPrimary' | 'southReplica'>;
  serviceLevel: { south: ServiceLevel };
  failoverEvents: FailoverEvent[];
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
    northPrimary: Pool | null;
    northReplica: Pool | null;
    southPrimary: Pool | null;
    southReplica: Pool | null;
  };

  // ===== Mới: Tracking State Changes & Failovers =====
  private lastNodeStates: Map<string, NodeStatus> = new Map();
  private failoverEvents: FailoverEvent[] = [];
  private readonly MAX_FAILOVER_EVENTS = 50; // Lưu tối đa 50 sự kiện

  constructor() {
    // Initialize pools as null by default
    this.pools = {
      northPrimary: null,
      northReplica: null,
      southPrimary: null,
      southReplica: null,
    };

    // Initialize last states
    this.lastNodeStates.set('northPrimary', 'offline');
    this.lastNodeStates.set('northReplica', 'offline');
    this.lastNodeStates.set('southPrimary', 'offline');
    this.lastNodeStates.set('southReplica', 'offline');

    try {
      // Try to get env vars, but don't require them
      const user = process.env.POSTGRES_USER;
      const password = process.env.POSTGRES_PASSWORD;
      const database = process.env.POSTGRES_DB;

      // If any critical env var is missing, skip pool creation
      if (!user || !password || !database) {
        this.logger.warn(`Missing PostgreSQL credentials. Running without database.`);
        return;
      }

      const northPrimaryHost = process.env.DB_NORTH_PRIMARY_HOST;
      const northReplicaHost = process.env.DB_NORTH_REPLICA_HOST;
      const southPrimaryHost = process.env.DB_SOUTH_PRIMARY_HOST;
      const southReplicaHost = process.env.DB_SOUTH_REPLICA_HOST;

      if (!northPrimaryHost || !northReplicaHost || !southPrimaryHost || !southReplicaHost) {
        this.logger.warn(`Missing database hostname configuration. Running without database.`);
        return;
      }

      this.pools = {
        northPrimary: this.createPool({
          host: northPrimaryHost,
          port: Number(process.env.DB_NORTH_PRIMARY_PORT ?? 5432),
          user,
          password,
          database,
        }),
        northReplica: this.createPool({
          host: northReplicaHost,
          port: Number(process.env.DB_NORTH_REPLICA_PORT ?? 5433),
          user,
          password,
          database,
        }),
        southPrimary: this.createPool({
          host: southPrimaryHost,
          port: Number(process.env.DB_SOUTH_PRIMARY_PORT ?? 5434),
          user,
          password,
          database,
        }),
        southReplica: this.createPool({
          host: southReplicaHost,
          port: Number(process.env.DB_SOUTH_REPLICA_PORT ?? 5435),
          user,
          password,
          database,
        }),
      };
    } catch (err) {
      this.logger.warn(`Database initialization error: ${(err as Error).message}. Running without database.`);
    }
  }

  private createPool(cfg: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Pool | null {
    try {
      // max: 1 để giảm tài nguyên trong health check.
      const pool = new Pool({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        max: 1,
        connectionTimeoutMillis: 2000, // Thêm timeout 2s để không bị treo
        query_timeout: 2000, // Thêm timeout truy vấn
        // Nếu bạn dùng SSL, có thể bật thêm ssl: { rejectUnauthorized: false }
        // theo môi trường của bạn.
      });

      // Quan trọng: khi container PostgreSQL bị stop, `pg` có thể phát sinh event `error`.
      // Nếu không attach handler thì Node sẽ crash vì unhandled 'error' event.
      pool.on('error', (err: Error) => {
        this.logger.warn(`pg pool error (${cfg.host}:${cfg.port}/${cfg.database}): ${err.message}`);
      });

      return pool;
    } catch (err) {
      this.logger.warn(`Failed to create pool for ${cfg.host}:${cfg.port}: ${(err as Error).message}`);
      return null;
    }
  }

  async onModuleDestroy() {
    // pg Pool end() không trả Promise trong mọi phiên bản, nên dùng await kiểu "best effort".
    try {
      Object.values(this.pools).forEach((p) => p?.end());
    } catch (e) {
      this.logger.warn(`Failed to close pg pools: ${(e as Error).message}`);
    }
  }

  async checkNode(connection: Pool | null, nodeName?: string): Promise<NodeMetrics> {
    if (!connection) {
      return {
        status: 'offline',
        latencyMs: 0,
        lastCheckTime: Date.now(),
      };
    }

    const startTime = Date.now();
    try {
      await connection.query('SELECT 1;');
      const latency = Date.now() - startTime;
      return {
        status: 'online',
        latencyMs: latency,
        lastCheckTime: Date.now(),
      };
    } catch (err) {
      const latency = Date.now() - startTime;
      this.logger.warn(`Node ${nodeName || 'unknown'} check failed (${latency}ms): ${(err as Error).message}`);
      return {
        status: 'offline',
        latencyMs: latency,
        lastCheckTime: Date.now(),
      };
    }
  }

  // ===== Mới: Phát hiện thay đổi trạng thái =====
  private detectStateChange(nodeName: string, newStatus: NodeStatus): void {
    const oldStatus = this.lastNodeStates.get(nodeName) || 'offline';

    if (oldStatus !== newStatus) {
      const message = `[STATE CHANGE] ${nodeName}: ${oldStatus} → ${newStatus} at ${new Date().toISOString()}`;
      if (newStatus === 'offline') {
        this.logger.error(message);
      } else {
        this.logger.warn(message);
      }
      this.lastNodeStates.set(nodeName, newStatus);
    }
  }

  // ===== Mới: Phát hiện Failover =====
  private detectFailover(region: 'north' | 'south', nodes: HealthNodes): void {
    const primaryKey = region === 'north' ? 'northPrimary' : 'southPrimary';
    const replicaKey = region === 'north' ? 'northReplica' : 'southReplica';

    const primaryStatus = nodes[primaryKey as keyof HealthNodes].status;
    const replicaStatus = nodes[replicaKey as keyof HealthNodes].status;

    const lastPrimaryStatus = this.lastNodeStates.get(primaryKey) || 'offline';
    const lastReplicaStatus = this.lastNodeStates.get(replicaKey) || 'offline';

    // Detect: Primary chết, Replica sống = FAILOVER
    if (
      lastPrimaryStatus === 'online' &&
      primaryStatus === 'offline' &&
      replicaStatus === 'online'
    ) {
      const event: FailoverEvent = {
        timestamp: Date.now(),
        region,
        eventType: 'primary_failed',
        message: `[FAILOVER TRIGGERED] ${region.toUpperCase()} Primary went down. Replica is now serving reads only.`,
      };
      this.addFailoverEvent(event);
    }

    // Detect: Primary khôi phục
    if (lastPrimaryStatus === 'offline' && primaryStatus === 'online') {
      const event: FailoverEvent = {
        timestamp: Date.now(),
        region,
        eventType: 'primary_recovered',
        message: `[RECOVERY] ${region.toUpperCase()} Primary is back online. Service returned to full capacity.`,
      };
      this.addFailoverEvent(event);
    }
  }

  // ===== Utility: Thêm failover event =====
  private addFailoverEvent(event: FailoverEvent): void {
    this.failoverEvents.unshift(event);
    if (this.failoverEvents.length > this.MAX_FAILOVER_EVENTS) {
      this.failoverEvents.pop();
    }
    this.logger.error(event.message);
  }

  // ===== Utility: Lấy failover events =====
  private getFailoverEvents(): FailoverEvent[] {
    return this.failoverEvents;
  }

  getServiceLevel(primary: NodeMetrics, replica: NodeMetrics): ServiceLevel {
    if (primary.status === 'online') return 'full';
    if (primary.status === 'offline' && replica.status === 'online') return 'readonly';
    return 'unavailable';
  }

  async getHealth(): Promise<HealthResponse> {
    const [northPrimary, northReplica, southPrimary, southReplica] = await Promise.all([
      this.checkNode(this.pools.northPrimary, 'northPrimary'),
      this.checkNode(this.pools.northReplica, 'northReplica'),
      this.checkNode(this.pools.southPrimary, 'southPrimary'),
      this.checkNode(this.pools.southReplica, 'southReplica'),
    ]);

    const nodes: HealthNodes = {
      northPrimary,
      northReplica,
      southPrimary,
      southReplica,
    };

    // ===== Mới: Detect state changes =====
    this.detectStateChange('northPrimary', northPrimary.status);
    this.detectStateChange('northReplica', northReplica.status);
    this.detectStateChange('southPrimary', southPrimary.status);
    this.detectStateChange('southReplica', southReplica.status);

    // ===== Mới: Detect failovers =====
    this.detectFailover('north', nodes);
    this.detectFailover('south', nodes);

    return {
      nodes,
      serviceLevel: {
        north: this.getServiceLevel(northPrimary, northReplica),
        south: this.getServiceLevel(southPrimary, southReplica),
      },
      failoverEvents: this.getFailoverEvents(),
      lastUpdated: Date.now(),
    };
  }

  async getNorthHealth(): Promise<NorthHealthResponse> {
    const [northPrimary, northReplica] = await Promise.all([
      this.checkNode(this.pools.northPrimary, 'northPrimary'),
      this.checkNode(this.pools.northReplica, 'northReplica'),
    ]);

    // ===== Mới: Detect state changes =====
    this.detectStateChange('northPrimary', northPrimary.status);
    this.detectStateChange('northReplica', northReplica.status);

    const nodes = { northPrimary, northReplica };
    const north: HealthNodes = { northPrimary, northReplica, southPrimary: { status: 'offline', latencyMs: 0, lastCheckTime: 0 }, southReplica: { status: 'offline', latencyMs: 0, lastCheckTime: 0 } };

    // ===== Mới: Detect failovers =====
    this.detectFailover('north', north);

    return {
      nodes,
      serviceLevel: { north: this.getServiceLevel(northPrimary, northReplica) },
      failoverEvents: this.getFailoverEvents(),
    };
  }

  async getSouthHealth(): Promise<SouthHealthResponse> {
    const [southPrimary, southReplica] = await Promise.all([
      this.checkNode(this.pools.southPrimary, 'southPrimary'),
      this.checkNode(this.pools.southReplica, 'southReplica'),
    ]);

    // ===== Mới: Detect state changes =====
    this.detectStateChange('southPrimary', southPrimary.status);
    this.detectStateChange('southReplica', southReplica.status);

    const nodes = { southPrimary, southReplica };
    const south: HealthNodes = { northPrimary: { status: 'offline', latencyMs: 0, lastCheckTime: 0 }, northReplica: { status: 'offline', latencyMs: 0, lastCheckTime: 0 }, southPrimary, southReplica };

    // ===== Mới: Detect failovers =====
    this.detectFailover('south', south);

    return {
      nodes,
      serviceLevel: { south: this.getServiceLevel(southPrimary, southReplica) },
      failoverEvents: this.getFailoverEvents(),
    };
  }
}

