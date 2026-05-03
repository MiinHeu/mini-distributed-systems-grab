import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ok } from '../common/api-response';

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
    return ok({
      nodes: {
        northPrimary: full.nodes.northPrimary,
        northReplica: full.nodes.northReplica,
      },
      serviceLevel: {
        north: full.serviceLevel.north,
      },
      replication: {
        north: full.replication.north,
      },
      lastCheckedAt: full.lastCheckedAt,
      uptimeSeconds: full.uptimeSeconds,
    });
  }

  /** GET /health/south — Detail for South region */
  @Get('south')
  async healthSouth() {
    const full = this.healthService.getFullHealth();
    return ok({
      nodes: {
        southPrimary: full.nodes.southPrimary,
        southReplica: full.nodes.southReplica,
      },
      serviceLevel: {
        south: full.serviceLevel.south,
      },
      replication: {
        south: full.replication.south,
      },
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
