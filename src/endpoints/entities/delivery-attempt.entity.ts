import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { EventEntity } from './event.entity';
import { DestinationEntity } from './destination.entity';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';

@Entity()
export class DeliveryAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  status!: DeliveryStatus;

  @Column({ default: 1 })
  attemptNumber!: number;

  @Column('json', { nullable: true })
  requestHeaders!: JSON;

  @Column('json', { nullable: true })
  requestBody!: JSON;

  @Column({ nullable: true })
  responseStatusCode!: number;

  @Column('text', { nullable: true })
  responseBody!: string;

  @Column({ nullable: true })
  errorMessage!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  attemptedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt!: Date;

  @ManyToOne(() => EventEntity)
  event!: EventEntity;

  @ManyToOne(() => DestinationEntity)
  destination!: DestinationEntity;
}
