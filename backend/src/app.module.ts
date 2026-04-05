import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [HealthModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
