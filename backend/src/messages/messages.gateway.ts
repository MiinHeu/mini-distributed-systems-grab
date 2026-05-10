import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { AuthService } from '../auth/auth.service';
import { SendMessageDto } from './dto/send-message.dto';

interface TypingPayload {
  trip_id: string;
  is_typing: boolean;
}

interface ReadPayload {
  trip_id: string;
}

/**
 * WebSocket Gateway cho Chat real-time
 * Namespace: /chat
 * 
 * Events từ client → server:
 *   message:send    → Gửi tin nhắn
 *   message:read    → Đánh dấu đã đọc
 *   typing          → Đang gõ...
 *   join:trip       → Vào phòng chat của 1 chuyến
 * 
 * Events từ server → client:
 *   message:receive → Nhận tin nhắn mới
 *   message:read    → Xác nhận đã đọc
 *   typing          → Thông báo đang gõ
 *   error           → Lỗi
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  // Map socket.id → userId để biết ai đang kết nối
  private connectedUsers = new Map<string, string>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket Gateway đã khởi động tại namespace /chat');
  }

  /**
   * Xác thực JWT khi client kết nối
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`[${client.id}] Kết nối bị từ chối: thiếu token`);
        client.emit('error', { message: 'Thiếu token xác thực' });
        client.disconnect();
        return;
      }

      const payload = this.authService.verifyToken(token);
      const userId = payload.sub.toString();
      this.connectedUsers.set(client.id, userId);

      this.logger.log(`[${client.id}] User ${userId} đã kết nối`);
      client.emit('connected', { userId, message: 'Kết nối thành công' });
    } catch {
      this.logger.warn(`[${client.id}] Token không hợp lệ`);
      client.emit('error', { message: 'Token không hợp lệ hoặc đã hết hạn' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);
    this.logger.log(`[${client.id}] User ${userId ?? 'unknown'} đã ngắt kết nối`);
  }

  /**
   * Client vào phòng chat của 1 chuyến
   * Emit: join:trip { trip_id }
   */
  @SubscribeMessage('join:trip')
  handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { trip_id: string },
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      throw new WsException('Chưa xác thực');
    }

    const room = `trip:${payload.trip_id}`;
    client.join(room);
    this.logger.log(`User ${userId} đã vào phòng ${room}`);

    return { event: 'joined', data: { room, trip_id: payload.trip_id } };
  }

  /**
   * Gửi tin nhắn
   * Emit: message:send { trip_id, receiver_id, content, type? }
   */
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const senderId = this.connectedUsers.get(client.id);
    if (!senderId) {
      throw new WsException('Chưa xác thực');
    }

    try {
      const message = await this.messagesService.sendMessage(senderId, dto);

      // Broadcast tin nhắn đến tất cả trong phòng trip
      const room = `trip:${dto.trip_id}`;
      this.server.to(room).emit('message:receive', {
        ...message,
        sender_id: senderId,
      });

      return { event: 'message:sent', data: message };
    } catch (err) {
      this.logger.error(`Lỗi gửi tin nhắn: ${(err as Error).message}`);
      throw new WsException('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  }

  /**
   * Đánh dấu đã đọc
   * Emit: message:read { trip_id }
   */
  @SubscribeMessage('message:read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReadPayload,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      throw new WsException('Chưa xác thực');
    }

    const result = await this.messagesService.markAsRead(payload.trip_id, userId);

    // Thông báo cho người gửi biết tin nhắn đã được đọc
    const room = `trip:${payload.trip_id}`;
    this.server.to(room).emit('message:read', {
      trip_id: payload.trip_id,
      read_by: userId,
      updated_count: result.updated,
    });

    return { event: 'read:confirmed', data: result };
  }

  /**
   * Thông báo đang gõ
   * Emit: typing { trip_id, is_typing }
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) return;

    const room = `trip:${payload.trip_id}`;
    // Broadcast cho những người khác trong phòng (không gửi lại cho chính mình)
    client.to(room).emit('typing', {
      trip_id: payload.trip_id,
      user_id: userId,
      is_typing: payload.is_typing,
    });
  }
}
