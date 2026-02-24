import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEntity } from '@/database/entities/event.entity';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryAttemptEntity)
    private readonly deliveryAttemptRepository: Repository<DeliveryAttemptEntity>,
    @InjectQueue('delivery') private readonly deliveryQueue: Queue,
    private readonly httpService: HttpService,
  ) {}

  async getDeliveryAttemptById(id: string): Promise<DeliveryAttemptEntity> {
    const deliveryAttempt = await this.deliveryAttemptRepository.findOne({
      where: { id },
      relations: ['event', 'destination'],
    });
    if (!deliveryAttempt) {
      throw new NotFoundException(`DeliveryAttempt with ID ${id} not found`);
    }
    return deliveryAttempt;
  }

  async retryDelivery(id: string): Promise<DeliveryAttemptEntity> {
    const deliveryAttempt = await this.getDeliveryAttemptById(id);
    if (deliveryAttempt.status !== DeliveryStatus.FAILED) {
      throw new UnprocessableEntityException('Only failed delivery attempts can be retried');
    }
    try {
      return await this.attemptDelivery(
        deliveryAttempt.event,
        deliveryAttempt.destination,
        deliveryAttempt,
      );
    } catch (error) {
      return await this.mergeDeliveryAttemptError(
        deliveryAttempt,
        error as AxiosError,
        deliveryAttempt.attemptNumber,
      );
    }
  }

  async attemptDelivery(
    event: EventEntity,
    destination: DestinationEntity,
    deliveryAttempt: DeliveryAttemptEntity,
  ): Promise<DeliveryAttemptEntity> {
    const response = await firstValueFrom(
      this.httpService.request({
        url: destination.url,
        method: destination.httpMethod,
        headers: destination.headers,
        data: event.body,
      }),
    );
    this.deliveryAttemptRepository.merge(deliveryAttempt, {
      status: DeliveryStatus.SUCCESS,
      responseStatusCode: response.status,
      responseBody:
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    });
    return await this.deliveryAttemptRepository.save(deliveryAttempt);
  }

  async mergeDeliveryAttemptError(
    deliveryAttempt: DeliveryAttemptEntity,
    error: AxiosError,
    attemptsMade: number,
    maxAttempts?: number,
  ): Promise<DeliveryAttemptEntity> {
    this.deliveryAttemptRepository.merge(deliveryAttempt, {
      attemptNumber: attemptsMade + 1,
      status:
        maxAttempts && attemptsMade >= maxAttempts - 1
          ? DeliveryStatus.FAILED
          : deliveryAttempt.status,
      errorMessage: error.message,
      responseStatusCode: error.response?.status ?? undefined,
      responseBody:
        typeof error.response?.data === 'string'
          ? error.response?.data
          : JSON.stringify(error.response?.data),
    });
    return await this.deliveryAttemptRepository.save(deliveryAttempt);
  }

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
