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
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TripsGateway } from './trips.gateway';
import { TripsService } from './trips.service';
import { EstimateTripDto } from './dto/estimate-trip.dto';

class BookTripDto {
  @IsNumber()
  pickup_lat: number;

  @IsNumber()
  pickup_lng: number;

  @IsNumber()
  dropoff_lat: number;

  @IsNumber()
  dropoff_lng: number;

  @IsString()
  @IsOptional()
  pickup?: string;

  @IsString()
  @IsOptional()
  dropoff?: string;

  @IsNumber()
  fare: number;

  @IsString()
  @IsOptional()
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
    return this.tripsService.getTripById(id);
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
    return this.tripsService.getTripHistoryAdmin(userId);
  }

  /**
   * GET /trips/:id — Chi tiết 1 chuyến (có auth)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getTripDetail(@Param('id') id: string) {
    const trip = await this.tripsService.getTripById(id);
    if (!trip) {
      throw new BadRequestException('Không tìm thấy chuyến xe');
    }
    return { trip };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/accept')
  async acceptTrip(@Param('id') id: string, @Req() req) {
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
  async completeTrip(@Param('id') id: string, @Req() req) {
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
  rejectTrip(@Param('id') id: string, @Req() req) {
    const driverId = req.user.userId || req.user.id;
    return this.tripsService.rejectTrip(id, driverId.toString());
  }

  @Patch(':id/cancel-legacy')
  cancelTripLegacy(@Param('id') id: string) {
    return this.tripsService.cancelTrip(id);
  }

  /**
   * PATCH /trips/:id/cancel — Hủy chuyến (có auth, dùng raw pg + region routing)
   * Chỉ customer sở hữu chuyến mới được hủy, và chỉ khi status là pending/accepted
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancelTrip(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId || req.user.id;
    const trip = await this.tripsService.cancelTrip(id, userId);
    this.tripsGateway.emitTripStatus({
      tripId: id,
      status: 'cancelled',
      trip: trip as any,
      message: 'Trip cancelled by customer',
    });
    return { trip };
  }



  @UseGuards(JwtAuthGuard)
  @Post('book')
  async bookTrip(@Body() body: any, @Req() req) {
    console.log(`[TripsAudit] Yêu cầu đặt xe từ User ID: ${req.user.userId || req.user.id}`);
    console.log(`[TripsAudit] Payload:`, JSON.stringify(body));
    return this.tripsService.bookTrip(body, req.user.userId || req.user.id);
  }

  /**
   * POST /trips/estimate
   * Tính tiền ước tính theo tọa độ — Người 2 Tầng 2
   */
  @Post('estimate')
  estimateTrip(@Body() body: EstimateTripDto) {
    return this.tripsService.estimateTrip(body);
  }
}
