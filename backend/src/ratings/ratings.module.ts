import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
