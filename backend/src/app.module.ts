import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { LocationRouterService } from './router/location-router.service';
import { DbRoutingService } from './db-routing/db-routing.service';
import { TestDbController } from './test-db/test-db.controller';
import { TripsController } from './trips/trips.controller';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    DatabaseModule, 
    AuthModule, 
    DriversModule,
    // South PRIMARY
    TypeOrmModule.forRoot({
      name: 'primary',
      type: 'postgres',
      host: process.env.DB_SOUTH_PRIMARY_HOST,
      port: +(process.env.DB_SOUTH_PRIMARY_PORT ?? '5434'),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      synchronize: false,
      connectTimeoutMS: 3000,
    }),
    // South REPLICA
    TypeOrmModule.forRoot({
      name: 'replica',
      type: 'postgres',
      host: process.env.DB_SOUTH_REPLICA_HOST,
      port: +(process.env.DB_SOUTH_REPLICA_PORT ?? '5435'),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      synchronize: false,
    }),
    TripsModule,
  ],
  controllers: [HealthController, TestDbController, TripsController],
  providers: [HealthService, LocationRouterService, DbRoutingService],
})
export class AppModule {}