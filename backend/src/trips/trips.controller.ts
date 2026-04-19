import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TripsGateway } from './trips.gateway';
import { TripsService } from './trips.service';

class BookTripDto {
  latitude: number;
  pickup?: string;
  dropoff?: string;
  note?: string;
}

@Controller('trips')
export class TripsController {
  constructor(
    private readonly dbRouting: DbRoutingService,
    private readonly tripsService: TripsService,
    private readonly tripsGateway: TripsGateway,
  ) {}

  @Get('history-legacy')
  async historyLegacy(@Query('latitude') latitudeRaw: string) {
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude)) {
      throw new BadRequestException(
        ok(null, { readOnly: false, warning: 'Missing latitude', activeNode: null }),
      );
    }
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(
      `SELECT id, node_name, message, created_at FROM replication_test ORDER BY created_at DESC LIMIT 50`,
    );
    return ok({ latitude, region: ctx.region, items: result.rows }, { readOnly: ctx.readOnly });
  }

  @Post('book-legacy')
  bookTripLegacy(@Body() body: any) {
    if (body.latitude) {
      return this.tripsService.bookTripLegacy(body);
    }
    throw new BadRequestException('Missing latitude property');
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending')
  getPendingTrips(@Query('region') region: string) {
    const safeRegion = (region || 'SOUTH').toUpperCase();
    return this.tripsService.getPendingTrips(safeRegion);
  }

  @Get(':id/legacy')
  getTripLegacy(@Param('id') id: string) {
    return this.tripsService.getTripById(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/accept')
  async acceptTrip(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const driverId = req.user.userId || req.user.id;
    const trip = await this.tripsService.acceptTrip(id, driverId);
    this.tripsGateway.emitTripAccepted(trip);
    this.tripsGateway.emitTripStatus({
      tripId: trip.id,
      status: 'accepted',
      trip,
      message: 'Trip accepted by driver',
    });
    return { trip };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/complete')
  async completeTrip(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const driverId = req.user.userId || req.user.id;
    const trip = await this.tripsService.completeTrip(id, driverId);
    this.tripsGateway.emitTripStatus({
      tripId: trip.id,
      status: 'completed',
      trip,
      message: 'Trip completed',
    });
    return { trip };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reject')
  rejectTrip(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const driverId = req.user.userId || req.user.id;
    return this.tripsService.rejectTrip(id, driverId);
  }

  @Patch(':id/cancel-legacy')
  cancelTripLegacy(@Param('id') id: string) {
    return this.tripsService.cancelTrip(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getMyHistory(@Req() req) {
    return this.tripsService.getTripHistory(req.user.userId || req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:userId')
  getHistoryAdmin(@Param('userId') userId: string, @Req() req) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Chi admin moi co quyen nay');
    }
    return this.tripsService.getTripHistoryAdmin(+userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('book')
  async bookTrip(@Body() body: BookTripDto, @Req() req) {
    return this.tripsService.bookTrip(body, req.user.userId || req.user.id);
  }
}
