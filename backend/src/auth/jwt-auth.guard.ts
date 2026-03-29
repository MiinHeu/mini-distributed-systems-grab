import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RequestUser } from './auth.types';

type RequestWithAuth = Request & {
  user?: RequestUser;
  token?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('missing bearer token');
    }

    if (this.authService.isTokenRevoked(token)) {
      throw new UnauthorizedException('token has been logged out');
    }

    const payload = this.authService.verifyToken(token);
    request.user = {
      userId: Number(payload.sub),
      role: payload.role,
      email: payload.email,
    };
    request.token = token;

    return true;
  }
}
