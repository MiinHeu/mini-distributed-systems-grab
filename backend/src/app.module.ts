import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsModule } from './trips/trips.module';
import { Trip } from './trips/entities/trip.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      name: 's1',
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '123456',
      database: 'postgres',
      entities: [Trip],
      synchronize: true,
    }),
    TypeOrmModule.forRoot({
      name: 's2',
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '123456',
      database: 'postgres',
      entities: [Trip],
      synchronize: true,
    }),
    TripsModule,
  ],
})
export class AppModule {}