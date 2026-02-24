import { WorkerHost, Processor } from '@nestjs/bullmq';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { EventEntity } from '@/database/entities/event.entity';
import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Processor('delivery')
export class DeliveryProcessor extends WorkerHost {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(DeliveryAttemptEntity)
    private readonly deliveryRepository: Repository<DeliveryAttemptEntity>,
  ) {
    super();
  }

  private mergeDeliveryAttemptError(
    deliveryAttempt: DeliveryAttemptEntity,
    error: AxiosError,
    job: Job,
  ): void {
    this.deliveryRepository.merge(deliveryAttempt, {
      attemptNumber: job.attemptsMade + 1,
      status:
        job.attemptsMade >= job.opts.attempts! - 1 ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
      errorMessage: error.message,
      responseStatusCode: error.response?.status ?? undefined,
      responseBody:
        typeof error.response?.data === 'string'
          ? error.response?.data
          : JSON.stringify(error.response?.data),
    });
  }

  async process(
    job: Job<{ event: EventEntity; destination: DestinationEntity; deliveryAttemptId: string }>,
  ): Promise<void> {
    const { event, destination, deliveryAttemptId } = job.data;

    const deliveryAttempt = await this.deliveryRepository.findOne({
      where: { id: deliveryAttemptId },
    });

    if (!deliveryAttempt) {
      throw new Error(`DeliveryAttempt with ID ${deliveryAttemptId} not found`);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url: destination.url,
          method: destination.httpMethod,
          headers: destination.headers,
          data: event.body,
        }),
      );
      this.deliveryRepository.merge(deliveryAttempt, {
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: response.status,
        responseBody:
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      });
      await this.deliveryRepository.save(deliveryAttempt);
    } catch (error) {
      const axiosError = error as AxiosError;

      this.mergeDeliveryAttemptError(deliveryAttempt, axiosError, job);
      await this.deliveryRepository.save(deliveryAttempt);

      if (job.attemptsMade < job.opts.attempts! - 1) {
        throw error;
      }
    }
  }
}
