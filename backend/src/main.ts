import dotenv from 'dotenv';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // ✅ Thêm dòng này

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Thêm đoạn này vào
  const config = new DocumentBuilder()
    .setTitle('Mini Grab API')
    .setDescription('CSDL Phân tán - Đề tài 4')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  // ✅ Kết thúc

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();