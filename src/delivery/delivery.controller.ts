import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { DeliveryService } from '@/delivery/delivery.service';
import { Controller, Post, Param, ParseUUIDPipe } from '@nestjs/common';

@Controller('delivery-attempts')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post(':id/retry')
  async retryDelivery(@Param('id', ParseUUIDPipe) id: string): Promise<DeliveryAttemptEntity> {
    return await this.deliveryService.retryDelivery(id);
  }
}
