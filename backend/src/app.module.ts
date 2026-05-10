import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { LocationRouterService } from './router/location-router.service';
import { DbRoutingModule } from './db-routing/db-routing.module';
import { DbRoutingService } from './db-routing/db-routing.service';
import { TestDbController } from './test-db/test-db.controller';
import { ReportsController } from './reports/reports.controller';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { TripsModule } from './trips/trips.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { MessagesModule } from './messages/messages.module';
import { RatingsModule } from './ratings/ratings.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    DriversModule,
    MessagesModule,
    TripsModule,
    AdminModule,
    DbRoutingModule,
    RatingsModule,
    PaymentsModule,
  ],
  controllers: [HealthController, TestDbController, ReportsController, AppController],
  providers: [HealthService, LocationRouterService, DbRoutingService, AppService],
})
export class AppModule {}
