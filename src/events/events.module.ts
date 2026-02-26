import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { DatabaseModule } from '@/database/database.module';
import { EventsService } from './events.service';
import { EventsInspectionController } from './events-inspection.controller';
import { KafkaModule } from '@/kafka/kafka.module';

@Module({
  imports: [DatabaseModule, KafkaModule],
  providers: [EventsService],
  controllers: [EventsController, EventsInspectionController],
  exports: [EventsService],
})
export class EventsModule {}
