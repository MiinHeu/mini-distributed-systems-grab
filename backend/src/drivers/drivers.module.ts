import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DatabaseModule } from '../database/database.module';
<<<<<<< HEAD
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
=======

@Module({
  imports: [DatabaseModule],
>>>>>>> origin/feature/nguoi7-admin
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}