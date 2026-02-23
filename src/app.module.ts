import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventsModule } from './events/events.module';
import { DestinationsModule } from './destinations/destinations.module';
import { DeliveryModule } from './delivery/delivery.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    DatabaseModule,
    EndpointsModule,
    EventsModule,
    DestinationsModule,
    DeliveryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
