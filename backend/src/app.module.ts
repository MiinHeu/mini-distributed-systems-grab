import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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

    HealthModule,
    TripsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}