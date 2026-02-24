import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DatabaseModule } from '@/database/database.module';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { DeliveryProcessor } from '@/delivery/delivery.processor';
import { DeliveryController } from './delivery.controller';

@Module({
  imports: [DatabaseModule, HttpModule, BullModule.registerQueue({ name: 'delivery' })],
  providers: [DeliveryService, DeliveryProcessor],
  exports: [DeliveryService],
  controllers: [DeliveryController],
})
export class DeliveryModule {}
