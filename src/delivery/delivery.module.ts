import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DatabaseModule } from '@/database/database.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [DatabaseModule, HttpModule],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
