import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Trip], 's1'),
    TypeOrmModule.forFeature([Trip], 's2'),
  ],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}