import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LocationRouterService } from '../router/location-router.service';
import { HealthService } from '../health/health.service';
import { Pool } from 'pg';
import { Region } from '../common/location.utils';

type ActiveNode =
  | 'NORTH_PRIMARY'
  | 'NORTH_REPLICA'
  | 'SOUTH_PRIMARY'
  | 'SOUTH_REPLICA';

export type DbReadContext = {
  region: Region;
  activeNode: ActiveNode;
  readOnly: boolean;
  warning: string | null;
  pool: Pool;
};

export type DbWriteContext = {
  region: Region;
  activeNode: 'NORTH_PRIMARY' | 'SOUTH_PRIMARY';
  readOnly: false;
  warning: null;
  pool: Pool;
};

@Injectable()
export class DbRoutingService {
  private readonly logger = new Logger(DbRoutingService.name);

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

    const primaryHealthy =
      region === Region.NORTH
        ? this.health.isNorthPrimaryHealthy()
        : this.health.isSouthPrimaryHealthy();
    const replicaHealthy =
      region === Region.NORTH
        ? this.health.isNorthReplicaHealthy()
        : this.health.isSouthReplicaHealthy();

    const readOnly = !primaryHealthy;
    const warning = readOnly
      ? `Hệ thống ${region} đang bảo trì (Primary DOWN). Chế độ chỉ đọc từ bản sao (Replica).`
      : null;

    if (region === Region.NORTH) {
      if (primaryHealthy) {
        this.logger.log(`[READ ROUTE] lat=${latitude} → NORTH → NORTH_PRIMARY (full)`);
        return {
          region,
          activeNode: 'NORTH_PRIMARY',
          readOnly: false,
          warning: null,
          pool: this.db.northPrimary,
        };
      }

      if (replicaHealthy) {
        this.logger.warn(`[READ ROUTE] lat=${latitude} → NORTH → NORTH_REPLICA (READ-ONLY: primary down)`);
        return {
          region,
          activeNode: 'NORTH_REPLICA',
          readOnly: true,
          warning,
          pool: this.db.northReplica,
        };
      }

      this.logger.error(`[READ ROUTE] lat=${latitude} → NORTH → UNAVAILABLE (both nodes down)`);
      throw new ServiceUnavailableException({
        readOnly: true,
        warning: `Không có kết nối CSDL khả dụng cho vùng MIỀN BẮC.`,
        activeNode: null,
        data: null,
      });
    }

    // SOUTH
    if (primaryHealthy) {
      this.logger.log(`[READ ROUTE] lat=${latitude} → SOUTH → SOUTH_PRIMARY (full)`);
      return {
        region,
        activeNode: 'SOUTH_PRIMARY',
        readOnly: false,
        warning: null,
        pool: this.db.southPrimary,
      };
    }

    if (replicaHealthy) {
      this.logger.warn(`[READ ROUTE] lat=${latitude} → SOUTH → SOUTH_REPLICA (READ-ONLY: primary down)`);
      return {
        region,
        activeNode: 'SOUTH_REPLICA',
        readOnly: true,
        warning,
        pool: this.db.southReplica,
      };
    }

    this.logger.error(`[READ ROUTE] lat=${latitude} → SOUTH → UNAVAILABLE (both nodes down)`);
    throw new ServiceUnavailableException({
      readOnly: true,
      warning: `Không có kết nối CSDL khả dụng cho vùng MIỀN NAM.`,
      activeNode: null,
      data: null,
    });
  }

  getWritePool(latitude: number) {
    return this.getWriteContext(latitude).pool;
  }

  getWriteContext(latitude: number): DbWriteContext {
    const region = this.router.getRegion(latitude);

    if (region === Region.NORTH) {
      if (!this.health.isNorthPrimaryHealthy()) {
        this.logger.error(`[WRITE ROUTE] lat=${latitude} → NORTH → BLOCKED (primary down, replica is read-only)`);
        throw new ServiceUnavailableException({
          readOnly: true,
          warning:
            'Tính năng GHI (Miền Bắc) tạm thời bị khóa do hệ thống đang bảo trì. Replica chỉ cho phép ĐỌC.',
          activeNode: 'NORTH_REPLICA',
          data: null,
        });
      }

      this.logger.log(`[WRITE ROUTE] lat=${latitude} → NORTH → NORTH_PRIMARY`);
      return {
        region,
        activeNode: 'NORTH_PRIMARY',
        readOnly: false,
        warning: null,
        pool: this.db.northPrimary,
      };
    }

    // SOUTH
    if (!this.health.isSouthPrimaryHealthy()) {
      this.logger.error(`[WRITE ROUTE] lat=${latitude} → SOUTH → BLOCKED (primary down, replica is read-only)`);
      throw new ServiceUnavailableException({
        readOnly: true,
        warning:
          'Tính năng GHI (Miền Nam) tạm thời bị khóa do hệ thống đang bảo trì. Replica chỉ cho phép ĐỌC.',
        activeNode: 'SOUTH_REPLICA',
        data: null,
      });
    }

    this.logger.log(`[WRITE ROUTE] lat=${latitude} → SOUTH → SOUTH_PRIMARY`);
    return {
      region,
      activeNode: 'SOUTH_PRIMARY',
      readOnly: false,
      warning: null,
      pool: this.db.southPrimary,
    };
  }
}
