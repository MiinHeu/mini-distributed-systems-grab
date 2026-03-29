import { Body, Controller, Post, Get, Param, Patch } from '@nestjs/common';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('book')
  bookTrip(@Body() body: any) {
    return this.tripsService.bookTrip(body);
  }

  @Get(':id')
  getTrip(@Param('id') id: string) {
    return this.tripsService.getTripById(Number(id));
  }

  @Patch(':id/cancel')
  cancelTrip(@Param('id') id: string) {
    return this.tripsService.cancelTrip(Number(id));
  }
}