import { Global, Module } from '@nestjs/common';
import { DbRoutingService } from './db-routing.service';
import { LocationRouterService } from '../router/location-router.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [DbRoutingService, LocationRouterService],
  exports: [DbRoutingService, LocationRouterService],
})
export class DbRoutingModule {}
