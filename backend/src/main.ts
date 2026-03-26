import dotenv from 'dotenv';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Load .env từ thư mục gốc repo (cùng cấp với folder backend).
// Khi chạy `npm run start:dev` trong folder `backend`, process.cwd() sẽ là `backend/`.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Cho phép frontend (Vite) gọi API backend ở port khác
  app.enableCors({ origin: true });
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
