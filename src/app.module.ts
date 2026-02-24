import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventsModule } from './events/events.module';
import { DestinationsModule } from './destinations/destinations.module';
import { DeliveryModule } from './delivery/delivery.module';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { ConfigService } from '@nestjs/config';
import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    DatabaseModule,
    EndpointsModule,
    EventsModule,
    DestinationsModule,
    DeliveryModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
