import { IsNumber } from 'class-validator';

export class EstimateTripDto {
  @IsNumber()
  pickup_lat: number;

  @IsNumber()
  pickup_lng: number;

  @IsNumber()
  dropoff_lat: number;

  @IsNumber()
  dropoff_lng: number;
}   