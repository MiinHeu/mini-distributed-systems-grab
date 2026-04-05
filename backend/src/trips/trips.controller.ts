import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';
import { TripsService } from './trips.service';

class BookTripDto {
  latitude: number;
  note?: string;
}

@Controller('trips')
export class TripsController {
  constructor(
    private readonly dbRouting: DbRoutingService,
    private readonly tripsService: TripsService
  ) {}

  @Get('history')
  async history(@Query('latitude') latitudeRaw: string) {
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude)) {
      throw new BadRequestException(
        ok(null, { readOnly: false, warning: 'Missing latitude', activeNode: null })
      );
    }
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(
      `SELECT id, node_name, message, created_at FROM replication_test ORDER BY created_at DESC LIMIT 50`
    );
    return ok({ latitude, region: ctx.region, items: result.rows }, { readOnly: ctx.readOnly });
  }

  @Post('book')
  bookTrip(@Body() body: any) {
    if (body.latitude) {
        return this.tripsService.bookTrip(body);
    } else {
        throw new BadRequestException("Missing latitude property");
    }
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
