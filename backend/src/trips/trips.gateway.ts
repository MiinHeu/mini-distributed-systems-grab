import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Trip } from './entities/trip.entity';

type TripStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

interface JoinTripPayload {
  tripId: number;
}

interface DriverLocationPayload {
  tripId: number;
  driverId: number;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

interface TripStatusPayload {
  tripId: number;
  status: TripStatus;
  trip?: Trip;
  message?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TripsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit('connection:ready', { socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    client.rooms.forEach(room => {
      if (room.startsWith('trip:')) {
        client.to(room).emit('trip:user_left', { socketId: client.id });
      }
    });
  }

  @SubscribeMessage('trip:join')
  handleJoinTrip(
    @MessageBody() payload: JoinTripPayload,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(this.getTripRoom(payload.tripId));
    client.emit('trip:joined', { tripId: payload.tripId });
  }

  @SubscribeMessage('trip:leave')
  handleLeaveTrip(
    @MessageBody() payload: JoinTripPayload,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(this.getTripRoom(payload.tripId));
    client.emit('trip:left', { tripId: payload.tripId });
  }

  @SubscribeMessage('driver:location')
  handleDriverLocation(@MessageBody() payload: DriverLocationPayload) {
    const event = {
      ...payload,
      sentAt: new Date().toISOString(),
    };
    this.server.to(this.getTripRoom(payload.tripId)).emit('driver:location', event);
    return event;
  }

  emitTripAccepted(trip: Trip) {
    this.server.to(this.getTripRoom(trip.id)).emit('trip:accepted', {
      tripId: trip.id,
      driverId: trip.driver_id,
      trip,
      sentAt: new Date().toISOString(),
    });
  }

  emitTripStatus(payload: TripStatusPayload) {
    this.server.to(this.getTripRoom(payload.tripId)).emit('trip:status', {
      ...payload,
      sentAt: new Date().toISOString(),
    });
  }

  private getTripRoom(tripId: number) {
    return `trip:${tripId}`;
  }
}

