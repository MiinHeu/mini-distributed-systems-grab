import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customer_id: number;

  @Column({ nullable: true })
  driver_id: number;

  @Column()
  pickup_address: string;

  @Column()
  dropoff_address: string;

  @Column('double precision')
  pickup_lat: number;

  @Column('double precision')
  pickup_lng: number;

  @Column('double precision')
  dropoff_lat: number;

  @Column('double precision')
  dropoff_lng: number;

  @Column({ default: 'pending' })
  status: string;

  @Column()
  region: string;

  @Column('double precision', { nullable: true })
  distance_km: number;

  @Column('double precision', { nullable: true })
  fare: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  completed_at: Date;
}