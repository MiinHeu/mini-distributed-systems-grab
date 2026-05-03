import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TripStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TripRegion {
  NORTH = 'NORTH',
  SOUTH = 'SOUTH',
}

@Entity('trips')
@Index('idx_trips_status_region', ['status', 'region'])
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

  @Column({
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.PENDING,
  })
  status: TripStatus;

  @Column({
    type: 'enum',
    enum: TripRegion,
  })
  region: TripRegion;

  @Column('double precision', { nullable: true })
  distance_km: number;

  @Column('double precision', { nullable: true })
  fare: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;
}
