import dotenv from 'dotenv';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { IoAdapter } from '@nestjs/platform-socket.io';

// Load .env từ thư mục gốc repo (cùng cấp với folder backend).
// Khi chạy `npm run start:dev` trong folder `backend`, process.cwd() sẽ là `backend/`.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true });
  
  // Kích hoạt Socket.IO adapter cho WebSocket
  app.useWebSocketAdapter(new IoAdapter(app));
  
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
