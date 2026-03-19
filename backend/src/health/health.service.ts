import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../database/database.service';

type NodeKey =
  | 'northPrimary'
  | 'northReplica'
  | 'southPrimary'
  | 'southReplica';

export type HealthSnapshot = Record<NodeKey, boolean>;

export type ServiceLevel = 'full' | 'readonly' | 'unavailable';

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly intervalMs = 5000;
  private intervalId?: NodeJS.Timeout;

  private statuses: HealthSnapshot = {
    northPrimary: false,
    northReplica: false,
    southPrimary: false,
    southReplica: false,
  };

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

  async checkDatabase(pool: Pool): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async updateStatuses() {
    this.statuses = {
      northPrimary: await this.checkDatabase(this.databaseService.northPrimary),
      northReplica: await this.checkDatabase(this.databaseService.northReplica),
      southPrimary: await this.checkDatabase(this.databaseService.southPrimary),
      southReplica: await this.checkDatabase(this.databaseService.southReplica),
    };
  }

  snapshot(): HealthSnapshot {
    return { ...this.statuses };
  }

  serviceLevelForRegion(region: 'north' | 'south'): ServiceLevel {
    const primaryHealthy =
      region === 'north' ? this.statuses.northPrimary : this.statuses.southPrimary;
    const replicaHealthy =
      region === 'north' ? this.statuses.northReplica : this.statuses.southReplica;

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
