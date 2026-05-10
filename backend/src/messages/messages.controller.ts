import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { RequestUser } from '../auth/auth.types';

type RequestWithUser = Request & { user: RequestUser };

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * GET /messages/unread/count
   * Đếm tin nhắn chưa đọc của user hiện tại
   * PHẢI đứng trước /:trip_id để tránh NestJS match "unread" như một trip_id
   */
  @Get('unread/count')
  async countUnread(@Req() req: RequestWithUser) {
    return this.messagesService.countUnread(req.user.userId.toString());
  }

  /**
   * GET /messages/:trip_id
   * Lấy lịch sử chat của 1 chuyến
   */
  @Get(':trip_id')
  async getMessagesByTrip(
    @Param('trip_id') tripId: string,
  ) {
    const result = await this.messagesService.getMessagesByTrip(tripId);
    return {
      readOnly: result.readOnly,
      warning: result.readOnly
        ? 'Đang ở chế độ chỉ đọc — Primary DB đang bảo trì'
        : null,
      total: result.total,
      data: result.data,
    };
  }
}
