import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { EndpointEntity } from './endpoint.entity';

@Entity()
export class DestinationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  endpointId!: string;

  @Column({ default: 'POST' })
  httpMethod!: string;

  @Column('json', { nullable: true })
  headers!: JSON;

  @Column()
  url!: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => EndpointEntity)
  endpoint!: EndpointEntity;
}
