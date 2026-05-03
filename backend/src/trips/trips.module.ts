import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsGateway } from './trips.gateway';
import { TripsService } from './trips.service';
<<<<<<< HEAD
import { Trip } from './entities/trip.entity';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Trip]), AuthModule, DatabaseModule],
  controllers: [TripsController],
  providers: [TripsService, TripsGateway],
  exports: [TripsService, TripsGateway],
=======
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
>>>>>>> origin/feature/nguoi7-admin
})
export class TripsModule {}
