import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ok } from '../common/api-response';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check() {
    const snapshot = this.healthService.snapshot();

    return ok({
      nodes: {
        northPrimary: snapshot.northPrimary ? 'online' : 'offline',
        northReplica: snapshot.northReplica ? 'online' : 'offline',
        southPrimary: snapshot.southPrimary ? 'online' : 'offline',
        southReplica: snapshot.southReplica ? 'online' : 'offline',
      },
      serviceLevel: {
        north: this.healthService.serviceLevelForRegion('north'),
        south: this.healthService.serviceLevelForRegion('south'),
      },
    });
  }
}
