import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEntity } from '@/database/entities/event.entity';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryAttemptEntity)
    private readonly deliveryAttemptRepository: Repository<DeliveryAttemptEntity>,
    @InjectQueue('delivery') private readonly deliveryQueue: Queue,
  ) {}

  async forwardEventToDestination(
    event: EventEntity,
    destinations: DestinationEntity[],
  ): Promise<void> {
    for (const destination of destinations) {
      const deliveryAttempt = this.deliveryAttemptRepository.create({
        event: event,
        destination: destination,
        status: DeliveryStatus.PENDING,
      });

      await this.deliveryAttemptRepository.save(deliveryAttempt);
      await this.deliveryQueue.add(
        'process-delivery',
        {
          deliveryAttemptId: deliveryAttempt.id,
          event: event,
          destination: destination,
        },
        {
          attempts: 3, // Retry up to 3 times on failure
          backoff: {
            type: 'fixed',
            delay: 60000, // Wait 1 minute between retries
          },
        },
      );
    }
  }
}
