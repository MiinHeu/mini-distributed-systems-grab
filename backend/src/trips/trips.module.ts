import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TripsController } from './trips.controller';
import { TripsGateway } from './trips.gateway';
import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DbRoutingModule } from '../db-routing/db-routing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Trip]), AuthModule, DatabaseModule, HttpModule, DbRoutingModule],
  controllers: [TripsController],
  providers: [TripsService, TripsGateway],
  exports: [TripsService, TripsGateway],
})
export class TripsModule {}
