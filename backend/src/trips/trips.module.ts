import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { AuthModule } from '../auth/auth.module';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { DatabaseModule } from '../database/database.module';
import { LocationRouterService } from '../router/location-router.service';
import { HealthService } from '../health/health.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TripsController],
  providers: [TripsService, DbRoutingService, LocationRouterService, HealthService],
})
export class TripsModule {}