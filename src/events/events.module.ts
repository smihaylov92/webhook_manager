import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { DatabaseModule } from '@/database/database.module';
import { EventsService } from './events.service';
import { DeliveryModule } from '@/delivery/delivery.module';

@Module({
  imports: [DatabaseModule, DeliveryModule],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
