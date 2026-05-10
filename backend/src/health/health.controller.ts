import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ok } from '../common/api-response';
import { Region } from '../common/location.utils';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** GET /health — Full status of all 4 nodes + replication + latency */
  @Get()
  async check() {
    const full = this.healthService.getFullHealth();
    return ok(full);
  }

  /** GET /health/north — Detail for North region */
  @Get('north')
  async healthNorth() {
    const full = this.healthService.getFullHealth();
    const serviceLevel = full.serviceLevel[Region.NORTH];
    return ok({
      nodes: {
        NORTH_PRIMARY: full.nodes.NORTH_PRIMARY,
        NORTH_REPLICA: full.nodes.NORTH_REPLICA,
      },
      serviceLevel: {
        [Region.NORTH]: serviceLevel,
      },
      replication: {
        [Region.NORTH]: full.replication[Region.NORTH],
      },
      warning: serviceLevel === 'readonly'
        ? 'Miền Bắc đang ở chế độ chỉ đọc. Primary DOWN, đang dùng Replica.'
        : serviceLevel === 'unavailable'
          ? 'Miền Bắc hiện không khả dụng. Cả Primary và Replica đều DOWN.'
          : null,
      lastCheckedAt: full.lastCheckedAt,
      uptimeSeconds: full.uptimeSeconds,
    });
  }

  /** GET /health/south — Detail for South region */
  @Get('south')
  async healthSouth() {
    const full = this.healthService.getFullHealth();
    const serviceLevel = full.serviceLevel[Region.SOUTH];
    return ok({
      nodes: {
        SOUTH_PRIMARY: full.nodes.SOUTH_PRIMARY,
        SOUTH_REPLICA: full.nodes.SOUTH_REPLICA,
      },
      serviceLevel: {
        [Region.SOUTH]: serviceLevel,
      },
      replication: {
        [Region.SOUTH]: full.replication[Region.SOUTH],
      },
      warning: serviceLevel === 'readonly'
        ? 'Miền Nam đang ở chế độ chỉ đọc. Primary DOWN, đang dùng Replica.'
        : serviceLevel === 'unavailable'
          ? 'Miền Nam hiện không khả dụng. Cả Primary và Replica đều DOWN.'
          : null,
      lastCheckedAt: full.lastCheckedAt,
      uptimeSeconds: full.uptimeSeconds,
    });
  }

  /** GET /health/history — Server-side event timeline */
  @Get('history')
  async healthHistory() {
    return ok({
      timeline: this.healthService.getTimeline(),
    });
  }
}
