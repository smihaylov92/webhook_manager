import { DestinationEntity } from '@/database/entities/destination.entity';
import { EndpointEntity } from '@/database/entities/endpoint.entity';
import { EventEntity } from '@/database/entities/event.entity';
import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
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
        ssl: configService.get<boolean>('database.ssl'),
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
