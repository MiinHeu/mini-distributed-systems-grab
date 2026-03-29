import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Mock user tạm — sau này JWT thật sẽ tự động gán req.user
    request.user = {
      id: 1,
      role: 'customer',
      name: 'Test User',
    };

    return true;
  }
}