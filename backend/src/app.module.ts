import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { LocationRouterService } from './router/location-router.service';
import { DbRoutingService } from './db-routing/db-routing.service';
import { TestDbController } from './test-db/test-db.controller';
import { TripsController } from './trips/trips.controller';
import { AuthModule } from './auth/auth.module';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule],
  controllers: [HealthController, TestDbController, TripsController],
  providers: [HealthService, LocationRouterService, DbRoutingService],
})
export class AppModule {}
