import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../database/database.service';

type NodeKey =
  | 'northPrimary'
  | 'northReplica'
  | 'southPrimary'
  | 'southReplica';

export type HealthSnapshot = Record<NodeKey, boolean>;

export type ServiceLevel = 'full' | 'readonly' | 'unavailable';

export type NodeDetail = {
  status: 'online' | 'offline';
  responseTimeMs: number | null;
};

export type ReplicationInfo = {
  applicationName: string;
  state: string;
  syncState: string;
  sentLsn: string | null;
  writeLsn: string | null;
  flushLsn: string | null;
  replayLsn: string | null;
  writeLagMs: string | null;
  flushLagMs: string | null;
  replayLagMs: string | null;
};

export type RegionReplicationStatus = {
  connected: boolean;
  replicas: ReplicationInfo[];
};

export type HealthTimelineEntry = {
  timestamp: string;
  changes: string[];
};

export type FullHealthResponse = {
  nodes: Record<NodeKey, NodeDetail>;
  serviceLevel: {
    north: ServiceLevel;
    south: ServiceLevel;
  };
  replication: {
    north: RegionReplicationStatus;
    south: RegionReplicationStatus;
  };
  lastCheckedAt: string | null;
  uptimeSeconds: number;
  tripCounts: {
    north: number;
    south: number;
  };
};

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly intervalMs = 5000;
  private intervalId?: NodeJS.Timeout;
  private readonly startedAt = Date.now();

  private statuses: HealthSnapshot = {
    northPrimary: false,
    northReplica: false,
    southPrimary: false,
    southReplica: false,
  };

  private responseTimes: Record<NodeKey, number | null> = {
    northPrimary: null,
    northReplica: null,
    southPrimary: null,
    southReplica: null,
  };

  private replicationData: Record<'north' | 'south', RegionReplicationStatus> = {
    north: { connected: false, replicas: [] },
    south: { connected: false, replicas: [] },
  };

  private lastCheckedAt: string | null = null;
  private tripCounts = { north: 0, south: 0 };

  // Server-side timeline (last 100 events)
  private timeline: HealthTimelineEntry[] = [];
  private previousSnapshot: HealthSnapshot | null = null;

  constructor(private databaseService: DatabaseService) {}

  onModuleInit() {
    void this.updateStatuses();
    this.intervalId = setInterval(() => {
      void this.updateStatuses();
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /** Ping a database node and measure response time in milliseconds */
  async checkDatabase(pool: Pool): Promise<{ alive: boolean; responseTimeMs: number | null }> {
    const start = Date.now();
    try {
      await pool.query('SELECT 1');
      return { alive: true, responseTimeMs: Date.now() - start };
    } catch {
      return { alive: false, responseTimeMs: null };
    }
  }

  /** Read pg_stat_replication and return structured data */
  async checkReplication(pool: Pool, region: string): Promise<RegionReplicationStatus> {
    try {
      const res = await pool.query(
        `SELECT application_name, state, sync_state,
                sent_lsn::text, write_lsn::text, flush_lsn::text, replay_lsn::text,
                write_lag::text, flush_lag::text, replay_lag::text
         FROM pg_stat_replication`,
      );

      if (res.rows.length > 0) {
        const replicas: ReplicationInfo[] = res.rows.map((row) => ({
          applicationName: row.application_name,
          state: row.state,
          syncState: row.sync_state,
          sentLsn: row.sent_lsn ?? null,
          writeLsn: row.write_lsn ?? null,
          flushLsn: row.flush_lsn ?? null,
          replayLsn: row.replay_lsn ?? null,
          writeLagMs: row.write_lag ?? null,
          flushLagMs: row.flush_lag ?? null,
          replayLagMs: row.replay_lag ?? null,
        }));

        for (const r of replicas) {
          this.logger.log(
            `[HealthMonitor] ${region} Replication - App: ${r.applicationName}, State: ${r.state}, Sync: ${r.syncState}`,
          );
        }

        return { connected: true, replicas };
      }

      this.logger.warn(
        `[HealthMonitor] ${region} Primary is UP, but NO replicas are connected or replicating.`,
      );
      return { connected: false, replicas: [] };
    } catch (e) {
      this.logger.error(
        `[HealthMonitor] Failed to read pg_stat_replication for ${region}: ${e.message}`,
      );
      return { connected: false, replicas: [] };
    }
  }

  private async updateStatuses() {
    const [northPrimary, northReplica, southPrimary, southReplica] =
      await Promise.all([
        this.checkDatabase(this.databaseService.northPrimary),
        this.checkDatabase(this.databaseService.northReplica),
        this.checkDatabase(this.databaseService.southPrimary),
        this.checkDatabase(this.databaseService.southReplica),
      ]);

    const newStatuses: HealthSnapshot = {
      northPrimary: northPrimary.alive,
      northReplica: northReplica.alive,
      southPrimary: southPrimary.alive,
      southReplica: southReplica.alive,
    };

    this.responseTimes = {
      northPrimary: northPrimary.responseTimeMs,
      northReplica: northReplica.responseTimeMs,
      southPrimary: southPrimary.responseTimeMs,
      southReplica: southReplica.responseTimeMs,
    };

    // Detect changes and record timeline
    if (this.previousSnapshot) {
      const changes: string[] = [];
      for (const key of Object.keys(newStatuses) as NodeKey[]) {
        if (this.previousSnapshot[key] !== newStatuses[key]) {
          const from = this.previousSnapshot[key] ? 'online' : 'offline';
          const to = newStatuses[key] ? 'online' : 'offline';
          changes.push(`${key}: ${from} → ${to}`);
        }
      }
      if (changes.length > 0) {
        this.timeline.unshift({
          timestamp: new Date().toISOString(),
          changes,
        });
        // Keep last 100 entries
        if (this.timeline.length > 100) {
          this.timeline = this.timeline.slice(0, 100);
        }
        this.logger.warn(`[HealthMonitor] Status changed: ${changes.join(', ')}`);
      }
    }

    this.previousSnapshot = { ...newStatuses };
    this.statuses = newStatuses;
    this.lastCheckedAt = new Date().toISOString();

    // Fetch replication info from online primaries
    const [northRepl, southRepl] = await Promise.all([
      newStatuses.northPrimary
        ? this.checkReplication(this.databaseService.northPrimary, 'North')
        : Promise.resolve({ connected: false, replicas: [] } as RegionReplicationStatus),
      newStatuses.southPrimary
        ? this.checkReplication(this.databaseService.southPrimary, 'South')
        : Promise.resolve({ connected: false, replicas: [] } as RegionReplicationStatus),
    ]);

    this.replicationData = {
      north: northRepl,
      south: southRepl,
    };

    // Đếm số lượng chuyến đi trong từng vùng
    const [northCount, southCount] = await Promise.all([
      newStatuses.northPrimary || newStatuses.northReplica
        ? (async () => {
            const ds = newStatuses.northPrimary ? this.databaseService.northPrimary : this.databaseService.northReplica;
            const res = await ds.query('SELECT COUNT(*) FROM trips');
            return parseInt(res.rows[0].count);
          })()
        : Promise.resolve(0),
      newStatuses.southPrimary || newStatuses.southReplica
        ? (async () => {
            const ds = newStatuses.southPrimary ? this.databaseService.southPrimary : this.databaseService.southReplica;
            const res = await ds.query('SELECT COUNT(*) FROM trips');
            return parseInt(res.rows[0].count);
          })()
        : Promise.resolve(0),
    ]);

    this.tripCounts = { north: northCount, south: southCount };
  }

  snapshot(): HealthSnapshot {
    return { ...this.statuses };
  }

  /** Get full detailed health data for API response */
  getFullHealth(): FullHealthResponse {
    return {
      nodes: {
        northPrimary: {
          status: this.statuses.northPrimary ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.northPrimary,
        },
        northReplica: {
          status: this.statuses.northReplica ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.northReplica,
        },
        southPrimary: {
          status: this.statuses.southPrimary ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.southPrimary,
        },
        southReplica: {
          status: this.statuses.southReplica ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.southReplica,
        },
      },
      serviceLevel: {
        north: this.serviceLevelForRegion('north'),
        south: this.serviceLevelForRegion('south'),
      },
      replication: {
        north: this.replicationData.north,
        south: this.replicationData.south,
      },
      lastCheckedAt: this.lastCheckedAt,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      tripCounts: this.tripCounts,
    };
  }

  /** Get server-side event timeline */
  getTimeline(): HealthTimelineEntry[] {
    return [...this.timeline];
  }

  serviceLevelForRegion(region: 'north' | 'south'): ServiceLevel {
    const primaryHealthy =
      region === 'north'
        ? this.statuses.northPrimary
        : this.statuses.southPrimary;
    const replicaHealthy =
      region === 'north'
        ? this.statuses.northReplica
        : this.statuses.southReplica;

    if (primaryHealthy) return 'full';
    if (replicaHealthy) return 'readonly';
    return 'unavailable';
  }

  isNorthPrimaryHealthy() {
    return this.statuses.northPrimary;
  }

  isNorthReplicaHealthy() {
    return this.statuses.northReplica;
  }

  isSouthPrimaryHealthy() {
    return this.statuses.southPrimary;
  }

  isSouthReplicaHealthy() {
    return this.statuses.southReplica;
  }
}
