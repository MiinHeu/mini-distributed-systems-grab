import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

enum VehicleType {
  CAR = 'car',
  BIKE = 'bike',
  TRUCK = 'truck',
}

export class GetNearbyDriversDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  radius_km?: number = 5; // Mặc định tìm bán kính 5km

  @IsEnum(VehicleType)
  @IsOptional()
  vehicle_type?: VehicleType = VehicleType.BIKE;
}
