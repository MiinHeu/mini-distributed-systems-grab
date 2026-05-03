import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  createRating(@Body() body: any, @Req() req) {
    return this.ratingsService.createRating(body, req.user.userId); // sửa .id → .userId
  }

  @Get('driver/:id')
  getDriverRatings(@Param('id') id: string) {
    return this.ratingsService.getDriverRatings(+id);
  }
}
