import { Controller, Get, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create')
  createPayment(@Body() body: any, @Req() req) {
    return this.paymentsService.createPayment(body, req.user.userId);
  }

  // VNPay gọi callback — không cần JWT
  @Get('callback')
  handleCallback(@Query() query: Record<string, string>) {
    return this.paymentsService.handleCallback(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':trip_id')
  getPayment(@Param('trip_id') tripId: string) {
    return this.paymentsService.getPaymentByTrip(+tripId);
  }
}
