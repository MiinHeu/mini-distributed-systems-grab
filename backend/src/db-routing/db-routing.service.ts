import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LocationRouterService } from '../router/location-router.service';
import { HealthService } from '../health/health.service';
import { Pool } from 'pg';

type DbRegion = 'north' | 'south';
type ActiveNode =
  | 'northPrimary'
  | 'northReplica'
  | 'southPrimary'
  | 'southReplica';

export type DbReadContext = {
  region: DbRegion;
  activeNode: ActiveNode;
  readOnly: boolean;
  warning: string | null;
  pool: Pool;
};

export type DbWriteContext = {
  region: DbRegion;
  activeNode: 'northPrimary' | 'southPrimary';
  readOnly: false;
  warning: null;
  pool: Pool;
};

@Injectable()
export class DbRoutingService {
  constructor(
    private db: DatabaseService,
    private router: LocationRouterService,
    private health: HealthService,
  ) {}

  getReadPool(latitude: number) {
    return this.getReadContext(latitude).pool;
  }

  getReadContext(latitude: number): DbReadContext {
    const region = this.router.getRegion(latitude);
    console.log('READ REGION:', region);

    const primaryHealthy =
      region === 'north'
        ? this.health.isNorthPrimaryHealthy()
        : this.health.isSouthPrimaryHealthy();
    const replicaHealthy =
      region === 'north'
        ? this.health.isNorthReplicaHealthy()
        : this.health.isSouthReplicaHealthy();

    const readOnly = !primaryHealthy;
    const warning = readOnly
      ? `Primary ${region.toUpperCase()} is down. System is running in read-only mode from replica.`
      : null;

    if (region === 'north') {
      if (replicaHealthy) {
        return {
          region,
          activeNode: 'northReplica',
          readOnly,
          warning,
          pool: this.db.northReplica,
        };
      }

      if (primaryHealthy) {
        return {
          region,
          activeNode: 'northPrimary',
          readOnly,
          warning,
          pool: this.db.northPrimary,
        };
      }

      throw new ServiceUnavailableException({
        readOnly: true,
        warning: `No healthy database available for NORTH region.`,
        activeNode: null,
        data: null,
      });
    }

    if (replicaHealthy) {
      return {
        region,
        activeNode: 'southReplica',
        readOnly,
        warning,
        pool: this.db.southReplica,
      };
    }

    if (primaryHealthy) {
      return {
        region,
        activeNode: 'southPrimary',
        readOnly,
        warning,
        pool: this.db.southPrimary,
      };
    }

    throw new ServiceUnavailableException({
      readOnly: true,
      warning: `No healthy database available for SOUTH region.`,
      activeNode: null,
      data: null,
    });
  }

  getWritePool(latitude: number) {
    return this.getWriteContext(latitude).pool;
  }

  getWriteContext(latitude: number): DbWriteContext {
    const region = this.router.getRegion(latitude);

    if (region === 'north') {
      if (!this.health.isNorthPrimaryHealthy()) {
        throw new ServiceUnavailableException({
          readOnly: true,
          warning:
            'Write database (NORTH primary) is unavailable. Replica is read-only.',
          activeNode: 'northReplica',
          data: null,
        });
      }

      return {
        region,
        activeNode: 'northPrimary',
        readOnly: false,
        warning: null,
        pool: this.db.northPrimary,
      };
    }

    if (!this.health.isSouthPrimaryHealthy()) {
      throw new ServiceUnavailableException({
        readOnly: true,
        warning:
          'Write database (SOUTH primary) is unavailable. Replica is read-only.',
        activeNode: 'southReplica',
        data: null,
      });
    }

    return {
      region,
      activeNode: 'southPrimary',
      readOnly: false,
      warning: null,
      pool: this.db.southPrimary,
    };
  }
}
