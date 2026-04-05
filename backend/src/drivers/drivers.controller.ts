import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { GetNearbyDriversDto } from './dto/get-nearby.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Patch('location')
  async updateLocation(@Body() dto: UpdateLocationDto) {
    return this.driversService.updateLocation(dto);
  }

  @Patch('availability')
  async updateAvailability(@Body() dto: UpdateAvailabilityDto) {
    return this.driversService.updateAvailability(dto);
  }

  @Get('nearby')
  async getNearbyDrivers(@Query() dto: GetNearbyDriversDto) {
    return this.driversService.getNearbyDrivers(dto);
  }

  @Get(':id')
  async getDriverById(@Param('id') id: string, @Query('region') region?: any) {
    return this.driversService.getDriverById(id, region);
  }
}
