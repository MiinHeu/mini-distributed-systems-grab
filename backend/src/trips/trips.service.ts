import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus, TripRegion } from './entities/trip.entity';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip, 's1')
    private readonly tripRepositoryS1: Repository<Trip>,

    @InjectRepository(Trip, 's2')
    private readonly tripRepositoryS2: Repository<Trip>,
  ) {}

  private getRepositoryByRegion(region: string | TripRegion): Repository<Trip> {
    const normalizedRegion = region.toString().toUpperCase();

    if (normalizedRegion === TripRegion.NORTH) {
      return this.tripRepositoryS1;
    }

    if (normalizedRegion === TripRegion.SOUTH) {
      return this.tripRepositoryS2;
    }

    throw new BadRequestException('Region must be NORTH or SOUTH');
  }

  async bookTrip(data: Partial<Trip>) {
    const inputRegion = data.region?.toString().toUpperCase();

    if (!inputRegion) {
      throw new BadRequestException('Region is required');
    }

    let region: TripRegion;

    if (inputRegion === TripRegion.NORTH) {
      region = TripRegion.NORTH;
    } else if (inputRegion === TripRegion.SOUTH) {
      region = TripRegion.SOUTH;
    } else {
      throw new BadRequestException('Region must be NORTH or SOUTH');
    }

    const repository = this.getRepositoryByRegion(region);

    const tripData: Partial<Trip> = {
      ...data,
      region,
      status: TripStatus.PENDING,
    };

    const trip = repository.create(tripData);

    return await repository.save(trip);
  }

  async getTripById(id: number, region: string) {
    const repository = this.getRepositoryByRegion(region);

    const trip = await repository.findOne({
      where: { id },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }

  async cancelTrip(id: number, region: string) {
    const repository = this.getRepositoryByRegion(region);

    const trip = await repository.findOne({
      where: { id },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.status === TripStatus.COMPLETED) {
      throw new BadRequestException('Completed trip cannot be cancelled');
    }

    if (trip.status === TripStatus.CANCELLED) {
      throw new BadRequestException('Trip is already cancelled');
    }

    trip.status = TripStatus.CANCELLED;
    return await repository.save(trip);
  }

  async completeTrip(id: number, region: string) {
    const repository = this.getRepositoryByRegion(region);

    const trip = await repository.findOne({
      where: { id },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.status === TripStatus.CANCELLED) {
      throw new BadRequestException('Cancelled trip cannot be completed');
    }

    if (trip.status === TripStatus.COMPLETED) {
      throw new BadRequestException('Trip is already completed');
    }

    trip.status = TripStatus.COMPLETED;
    trip.completed_at = new Date();

    return await repository.save(trip);
  }
}