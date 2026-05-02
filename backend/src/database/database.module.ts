import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { LocationRouterService } from '../router/location-router.service';
import { HealthService } from '../health/health.service';

@Module({
  providers: [
    DatabaseService,
    DbRoutingService,
    LocationRouterService,
    HealthService,
  ],
  exports: [
    DatabaseService,
    DbRoutingService,
    LocationRouterService,
    HealthService,
  ],
})
export class DatabaseModule {}
