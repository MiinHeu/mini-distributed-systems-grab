import {
  Controller, Get, Post, Param,
  Req, UseGuards, ForbiddenException, Body,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('history')
  getMyHistory(@Req() req) {
    return this.tripsService.getTripHistory(req.user.id);
  }

  @Get('history/:userId')
  getHistoryAdmin(@Param('userId') userId: string, @Req() req) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Chỉ admin mới có quyền này');
    }
    return this.tripsService.getTripHistoryAdmin(+userId);
  }

  @Post('book')
  async bookTrip(@Body() body: any, @Req() req) {
    return this.tripsService.bookTrip(body, req.user.id);
  }
}