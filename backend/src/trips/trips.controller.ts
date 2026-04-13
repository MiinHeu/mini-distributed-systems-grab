import { Body, Controller, Post, Get, Param, Patch } from '@nestjs/common';
import { TripsService } from './trips.service';
import { EstimateTripDto } from './dto/estimate-trip.dto';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('book')
  bookTrip(@Body() body: any) {
    return this.tripsService.bookTrip(body);
  }

  @Post('estimate')
  estimate(@Body() body: EstimateTripDto) {
    return this.tripsService.estimateTrip(body);
  }

  @Get(':region/:id')
  getTrip(
    @Param('id') id: string,
    @Param('region') region: string,
  ) {
    return this.tripsService.getTripById(Number(id), region);
  }

  @Patch(':region/:id/cancel')
  cancelTrip(
    @Param('id') id: string,
    @Param('region') region: string,
  ) {
    return this.tripsService.cancelTrip(Number(id), region);
  }

  @Patch(':region/:id/complete')
  completeTrip(
    @Param('id') id: string,
    @Param('region') region: string,
  ) {
    return this.tripsService.completeTrip(Number(id), region);
  }
}