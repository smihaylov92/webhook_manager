import { Module } from '@nestjs/common';
import { KafkaProducer } from './kafka.producer';
import { KafkaConsumer } from './kafka.consumer';
import { DeliveryModule } from '@/delivery/delivery.module';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DeliveryModule, DatabaseModule],
  providers: [KafkaProducer, KafkaConsumer],
  exports: [KafkaProducer],
})
export class KafkaModule {}
