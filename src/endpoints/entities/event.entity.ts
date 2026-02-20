import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { EndpointEntity } from './endpoint.entity';
import { DeliveryAttemptEntity } from './delivery-attempt.entity';

@Entity()
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  method!: string;

  @Column('json', { nullable: true })
  headers?: Record<string, string>;

  @Column('json', { nullable: true })
  body?: Record<string, string>;

  @Column('json', { nullable: true })
  queryParams?: Record<string, string>;

  @Column({ nullable: true })
  sourceIp!: string;

  @CreateDateColumn()
  receivedAt!: Date;

  @ManyToOne(() => EndpointEntity)
  endpoint!: EndpointEntity;

  @OneToMany(() => DeliveryAttemptEntity, (attempt) => attempt.event)
  deliveryAttempts!: DeliveryAttemptEntity[];
}
