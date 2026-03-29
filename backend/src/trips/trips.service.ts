import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from './entities/trip.entity';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
  ) {}

  async bookTrip(data: Partial<Trip>) {
    const trip = this.tripRepository.create({
      ...data,
      status: 'pending',
    });

    return await this.tripRepository.save(trip);
  }

  async getTripById(id: number) {
    return await this.tripRepository.findOne({
      where: { id },
    });
  }

  async cancelTrip(id: number) {
    const trip = await this.tripRepository.findOne({
      where: { id },
    });

    if (!trip) {
      return { message: 'Trip not found' };
    }

    trip.status = 'cancelled';
    return await this.tripRepository.save(trip);
  }
}