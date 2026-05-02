import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  ) {}

  @Get('history-legacy')
  async historyLegacy(@Query('latitude') latitudeRaw: string) {
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude)) {
      throw new BadRequestException(
        ok(null, {
          readOnly: false,
          warning: 'Missing latitude',
          activeNode: null,
        }),
      );
    }
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(
      `SELECT id, node_name, message, created_at FROM replication_test ORDER BY created_at DESC LIMIT 50`,
    );
    return ok(
      { latitude, region: ctx.region, items: result.rows },
      { readOnly: ctx.readOnly },
    );
  }

  @Post('book-legacy')
  bookTripLegacy(@Body() body: any) {
    if (body.latitude) {
      return this.tripsService.bookTripLegacy(body);
    } else {
      throw new BadRequestException('Missing latitude property');
    }
  }

  @Get(':id/legacy')
  getTripLegacy(@Param('id') id: string) {
    return this.tripsService.getTripById(Number(id));
  }

  @Patch(':id/cancel-legacy')
  cancelTripLegacy(@Param('id') id: string) {
    return this.tripsService.cancelTrip(Number(id));
  }

  // --- Nguoi5 API ---
  @UseGuards(JwtAuthGuard)
  @Get('history')
  getMyHistory(@Req() req) {
    return this.tripsService.getTripHistory(req.user.userId || req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:userId')
  getHistoryAdmin(@Param('userId') userId: string, @Req() req) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Chỉ admin mới có quyền này');
    }
    return this.tripsService.getTripHistoryAdmin(+userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('book')
  async bookTrip(@Body() body: any, @Req() req) {
    return this.tripsService.bookTrip(body, req.user.userId || req.user.id);
  }
}
