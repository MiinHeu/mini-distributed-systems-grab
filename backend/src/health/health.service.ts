import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';

type NodeKey =
  | 'NORTH_PRIMARY'
  | 'NORTH_REPLICA'
  | 'SOUTH_PRIMARY'
  | 'SOUTH_REPLICA';

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
    [Region.NORTH]: ServiceLevel;
    [Region.SOUTH]: ServiceLevel;
  };
  replication: {
    [Region.NORTH]: RegionReplicationStatus;
    [Region.SOUTH]: RegionReplicationStatus;
  };
  lastCheckedAt: string | null;
  uptimeSeconds: number;
  tripCounts: {
    [Region.NORTH]: number;
    [Region.SOUTH]: number;
  };
};

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly intervalMs = 5000;
  private intervalId?: NodeJS.Timeout;
  private readonly startedAt = Date.now();

  // Mặc định lạc quan (optimistic): giả sử tất cả node đều online khi khởi động.
  // Điều này tránh lỗi ServiceUnavailableException trong vài giây đầu trước khi
  // health check lần đầu hoàn tất. Nếu node thực sự sập, updateStatuses() sẽ
  // cập nhật thành false ngay trong lần check đầu tiên (~vài trăm ms sau khởi động).
  private statuses: HealthSnapshot = {
    NORTH_PRIMARY: true,
    NORTH_REPLICA: true,
    SOUTH_PRIMARY: true,
    SOUTH_REPLICA: true,
  };

  private responseTimes: Record<NodeKey, number | null> = {
    NORTH_PRIMARY: null,
    NORTH_REPLICA: null,
    SOUTH_PRIMARY: null,
    SOUTH_REPLICA: null,
  };

  private replicationData: Record<Region, RegionReplicationStatus> = {
    [Region.NORTH]: { connected: false, replicas: [] },
    [Region.SOUTH]: { connected: false, replicas: [] },
  };

  private lastCheckedAt: string | null = null;
  private tripCounts = { [Region.NORTH]: 0, [Region.SOUTH]: 0 };

  // Server-side timeline (last 100 events)
  private timeline: HealthTimelineEntry[] = [];
  private previousSnapshot: HealthSnapshot | null = null;

  constructor(private databaseService: DatabaseService) {}

  async onModuleInit() {
    // Chạy health check lần đầu ngay lập tức (await) để có trạng thái chính xác
    // trước khi bất kỳ request nào đến
    await this.updateStatuses();
    this.logger.log('[HealthService] Health check lần đầu hoàn tất — hệ thống sẵn sàng phục vụ.');
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
            `[HealthMonitor] Đồng bộ ${region} - App: ${r.applicationName}, Trạng thái: ${r.state}, Kiểu: ${r.syncState}`,
          );
        }

        return { connected: true, replicas };
      }

      this.logger.warn(
        `[HealthMonitor] Node ${region} PRIMARY đang online, nhưng CHƯA CÓ bản sao (Replica) nào kết nối.`,
      );
      return { connected: false, replicas: [] };
    } catch (e) {
      this.logger.error(
        `[HealthMonitor] Lỗi khi đọc trạng thái đồng bộ cho vùng ${region}: ${e.message}`,
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
      NORTH_PRIMARY: northPrimary.alive,
      NORTH_REPLICA: northReplica.alive,
      SOUTH_PRIMARY: southPrimary.alive,
      SOUTH_REPLICA: southReplica.alive,
    };

    this.responseTimes = {
      NORTH_PRIMARY: northPrimary.responseTimeMs,
      NORTH_REPLICA: northReplica.responseTimeMs,
      SOUTH_PRIMARY: southPrimary.responseTimeMs,
      SOUTH_REPLICA: southReplica.responseTimeMs,
    };

    // Detect changes and record timeline
    if (this.previousSnapshot) {
      const changes: string[] = [];
      for (const key of Object.keys(newStatuses) as NodeKey[]) {
        if (this.previousSnapshot[key] !== newStatuses[key]) {
          const from = this.previousSnapshot[key] ? 'ONLINE' : 'OFFLINE';
          const to = newStatuses[key] ? 'ONLINE' : 'OFFLINE';
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
        this.logger.warn(`[HealthMonitor] Trạng thái thay đổi: ${changes.join(', ')}`);
      }
    }

    this.previousSnapshot = { ...newStatuses };
    this.statuses = newStatuses;
    this.lastCheckedAt = new Date().toISOString();

    // Đồng bộ trạng thái sang DatabaseService để tối ưu failover (tránh timeout 3s)
    this.databaseService.setNodeStatus(Region.NORTH, newStatuses.NORTH_PRIMARY);
    this.databaseService.setNodeStatus(Region.SOUTH, newStatuses.SOUTH_PRIMARY);

    // Fetch replication info from online primaries
    let northRepl: RegionReplicationStatus = { connected: false, replicas: [] };
    let southRepl: RegionReplicationStatus = { connected: false, replicas: [] };

    try {
      if (newStatuses.NORTH_PRIMARY) {
        northRepl = await this.checkReplication(this.databaseService.northPrimary, 'MIỀN BẮC');
      }
    } catch (e) {
      this.logger.error(`[HealthMonitor] Error checking NORTH replication: ${e.message}`);
    }

    try {
      if (newStatuses.SOUTH_PRIMARY) {
        southRepl = await this.checkReplication(this.databaseService.southPrimary, 'MIỀN NAM');
      }
    } catch (e) {
      this.logger.error(`[HealthMonitor] Error checking SOUTH replication: ${e.message}`);
    }

    this.replicationData = {
      [Region.NORTH]: northRepl,
      [Region.SOUTH]: southRepl,
    };

    // Đếm số lượng chuyến đi trong từng vùng (bọc try-catch để tránh crash toàn cục)
    try {
      if (newStatuses.NORTH_PRIMARY || newStatuses.NORTH_REPLICA) {
        const ds = newStatuses.NORTH_PRIMARY ? this.databaseService.northPrimary : this.databaseService.northReplica;
        const res = await ds.query('SELECT COUNT(*) FROM trips');
        this.tripCounts[Region.NORTH] = parseInt(res.rows[0].count);
      }
    } catch (e) {
      this.logger.error(`[HealthMonitor] Error counting NORTH trips: ${e.message}`);
    }

    try {
      if (newStatuses.SOUTH_PRIMARY || newStatuses.SOUTH_REPLICA) {
        const ds = newStatuses.SOUTH_PRIMARY ? this.databaseService.southPrimary : this.databaseService.southReplica;
        const res = await ds.query('SELECT COUNT(*) FROM trips');
        this.tripCounts[Region.SOUTH] = parseInt(res.rows[0].count);
      }
    } catch (e) {
      this.logger.error(`[HealthMonitor] Error counting SOUTH trips: ${e.message}`);
    }
  }

  snapshot(): HealthSnapshot {
    return { ...this.statuses };
  }

  /** Get full detailed health data for API response */
  getFullHealth(): FullHealthResponse {
    return {
      nodes: {
        NORTH_PRIMARY: {
          status: this.statuses.NORTH_PRIMARY ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.NORTH_PRIMARY,
        },
        NORTH_REPLICA: {
          status: this.statuses.NORTH_REPLICA ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.NORTH_REPLICA,
        },
        SOUTH_PRIMARY: {
          status: this.statuses.SOUTH_PRIMARY ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.SOUTH_PRIMARY,
        },
        SOUTH_REPLICA: {
          status: this.statuses.SOUTH_REPLICA ? 'online' : 'offline',
          responseTimeMs: this.responseTimes.SOUTH_REPLICA,
        },
      },
      serviceLevel: {
        [Region.NORTH]: this.serviceLevelForRegion(Region.NORTH),
        [Region.SOUTH]: this.serviceLevelForRegion(Region.SOUTH),
      },
      replication: {
        [Region.NORTH]: this.replicationData[Region.NORTH],
        [Region.SOUTH]: this.replicationData[Region.SOUTH],
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

  serviceLevelForRegion(region: Region): ServiceLevel {
    const primaryHealthy =
      region === Region.NORTH
        ? this.statuses.NORTH_PRIMARY
        : this.statuses.SOUTH_PRIMARY;
    const replicaHealthy =
      region === Region.NORTH
        ? this.statuses.NORTH_REPLICA
        : this.statuses.SOUTH_REPLICA;

    if (primaryHealthy) return 'full';
    if (replicaHealthy) return 'readonly';
    return 'unavailable';
  }

  isNorthPrimaryHealthy() {
    return this.statuses.NORTH_PRIMARY;
  }

  isNorthReplicaHealthy() {
    return this.statuses.NORTH_REPLICA;
  }

  isSouthPrimaryHealthy() {
    return this.statuses.SOUTH_PRIMARY;
  }

  isSouthReplicaHealthy() {
    return this.statuses.SOUTH_REPLICA;
  }
}
