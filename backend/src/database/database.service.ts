import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  northPrimary: Pool;
  northReplica: Pool;
  southPrimary: Pool;
  southReplica: Pool;

  constructor() {
    console.log('ENV CHECK:');
    console.log('north primary host:', process.env.DB_NORTH_PRIMARY_HOST);
    console.log('north primary port:', process.env.DB_NORTH_PRIMARY_PORT);
    console.log('south primary host:', process.env.DB_SOUTH_PRIMARY_HOST);
    console.log('south primary port:', process.env.DB_SOUTH_PRIMARY_PORT);
    this.northPrimary = new Pool({
      host: process.env.DB_NORTH_PRIMARY_HOST,
      port: Number(process.env.DB_NORTH_PRIMARY_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });

    this.northReplica = new Pool({
      host: process.env.DB_NORTH_REPLICA_HOST,
      port: Number(process.env.DB_NORTH_REPLICA_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });

    this.southPrimary = new Pool({
      host: process.env.DB_SOUTH_PRIMARY_HOST,
      port: Number(process.env.DB_SOUTH_PRIMARY_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });

    this.southReplica = new Pool({
      host: process.env.DB_SOUTH_REPLICA_HOST,
      port: Number(process.env.DB_SOUTH_REPLICA_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });
  }
}
