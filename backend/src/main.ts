import dotenv from 'dotenv';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(); // 👈 THÊM DÒNG NÀY

  await app.listen(3000);
}
bootstrap();