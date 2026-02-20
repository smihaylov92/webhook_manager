import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DestinationEntity } from './destination.entity';
import { EventEntity } from './event.entity';

@Entity()
export class EndpointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  slug!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => DestinationEntity, (destination) => destination.endpoint)
  destinations!: DestinationEntity[];

  @OneToMany(() => EventEntity, (event) => event.endpoint)
  events!: EventEntity[];
}
