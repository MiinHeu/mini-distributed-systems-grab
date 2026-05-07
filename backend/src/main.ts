import 'dotenv/config'; // Nạp biến môi trường ngay lập tức ở dòng đầu tiên
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true });

  // Kích hoạt Socket.IO adapter cho WebSocket
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Mini Grab API')
    .setDescription('API documentation cho hệ thống gọi xe Mini Grab')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
// Force restart 1
