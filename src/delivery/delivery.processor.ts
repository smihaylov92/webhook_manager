import { WorkerHost, Processor } from '@nestjs/bullmq';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { EventEntity } from '@/database/entities/event.entity';
import { AxiosError } from 'axios';
import { Job } from 'bullmq';
import { DeliveryService } from '@/delivery/delivery.service';

@Processor('delivery')
export class DeliveryProcessor extends WorkerHost {
  constructor(private readonly deliveryService: DeliveryService) {
    super();
  }

  async process(
    job: Job<{ event: EventEntity; destination: DestinationEntity; deliveryAttemptId: string }>,
  ): Promise<void> {
    const { event, destination, deliveryAttemptId } = job.data;
    const deliveryAttempt = await this.deliveryService.getDeliveryAttemptById(deliveryAttemptId);
    try {
      await this.deliveryService.attemptDelivery(event, destination, deliveryAttempt);
    } catch (error) {
      await this.deliveryService.mergeDeliveryAttemptError(
        deliveryAttempt,
        error as AxiosError,
        job.attemptsMade,
        job.opts.attempts,
      );

      if (job.attemptsMade < job.opts.attempts! - 1) {
        throw error;
      }
    }
  }
}
