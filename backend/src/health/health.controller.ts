import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthResponse } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health(): Promise<HealthResponse> {
    // Trả toàn bộ trạng thái của 4 node + serviceLevel cho north & south
    return this.healthService.getHealth();
  }

  @Get('north')
  async healthNorth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }

  @Get('south')
  async healthSouth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}

