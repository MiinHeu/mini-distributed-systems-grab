import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { DatabaseModule } from '../database/database.module';
import { TypeOrmModule, getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Trip } from './entities/trip.entity';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { DbRoutingService } from '../db-routing/db-routing.service'; // ✅ thêm
import { LocationRouterService } from '../router/location-router.service'; // ✅ thêm
import { HealthService } from '../health/health.service'; // ✅ thêm dòng này

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Trip], 'primary'),
    TypeOrmModule.forFeature([Trip], 'replica'),
    AuthModule,
  ],
  controllers: [TripsController],
 providers: [
  {
    provide: getRepositoryToken(Trip),
    useFactory: (ds: DataSource) => ds.getRepository(Trip),
    inject: [getDataSourceToken('primary')],
  },
  TripsService,
  DbRoutingService,
  LocationRouterService,
  HealthService,   // ✅ thêm
],
})
export class TripsModule {}