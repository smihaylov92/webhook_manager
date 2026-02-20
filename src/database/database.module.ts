import { DestinationEntity } from '@/endpoints/entities/destination.entity';
import { EndpointEntity } from '@/endpoints/entities/endpoint.entity';
import { EventEntity } from '@/endpoints/entities/event.entity';
import { DeliveryAttemptEntity } from '@/endpoints/entities/delivery-attempt.entity';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),

    TypeOrmModule.forFeature([
      EndpointEntity,
      DestinationEntity,
      EventEntity,
      DeliveryAttemptEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
