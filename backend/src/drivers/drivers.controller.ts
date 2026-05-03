import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { GetNearbyDriversDto } from './dto/get-nearby.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Region } from '../common/location.utils';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('location')
  async updateLocation(@Body() dto: UpdateLocationDto) {
    return this.driversService.updateLocation(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('availability')
  async updateAvailability(@Body() dto: UpdateAvailabilityDto) {
    return this.driversService.updateAvailability(dto);
  }

  @Get('nearby')
  async getNearbyDrivers(@Query() dto: GetNearbyDriversDto) {
    return this.driversService.getNearbyDrivers(dto);
  }

  /**
   * GET /drivers/by-user/:userId?region=NORTH|SOUTH
   * Tìm driver records của 1 user — dùng sau khi login để lấy driver_id
   * PHẢI đứng trước /:id để tránh conflict route
   */
  @UseGuards(JwtAuthGuard)
  @Get('by-user/:userId')
  async getDriversByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('region') region?: string,
  ) {
    const resolvedRegion = (region as Region) ?? Region.NORTH;
    return this.driversService.getDriversByUserId(userId, resolvedRegion);
  }

  @Get(':id')
  async getDriverById(@Param('id') id: string, @Query('region') region?: any) {
    return this.driversService.getDriverById(id, region);
  }
}
