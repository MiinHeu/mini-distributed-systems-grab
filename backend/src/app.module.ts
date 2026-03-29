import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { LocationRouterService } from './router/location-router.service';
import { DbRoutingService } from './db-routing/db-routing.service';
import { TestDbController } from './test-db/test-db.controller';
import { TripsController } from './trips/trips.controller';
import { ReportsController } from './reports/reports.controller';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
  controllers: [
    HealthController,
    TestDbController,
    TripsController,
    ReportsController,
  ],
  providers: [HealthService, LocationRouterService, DbRoutingService],
})
export class AppModule {}
