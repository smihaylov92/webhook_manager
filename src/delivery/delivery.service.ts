import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEntity } from '@/database/entities/event.entity';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryAttemptEntity)
    private readonly deliveryAttemptRepository: Repository<DeliveryAttemptEntity>,
    private readonly httpService: HttpService,
  ) {}

  private async postToDestination(
    destination: DestinationEntity,
    event: EventEntity,
  ): Promise<Partial<DeliveryAttemptEntity>> {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url: destination.url,
          method: destination.httpMethod,
          headers: destination.headers,
          data: event.body,
        }),
      );

      return {
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: response.status,
        responseBody:
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        status: DeliveryStatus.FAILED,
        errorMessage: axiosError.message,
        responseStatusCode: axiosError.response?.status ?? undefined,
      };
    }
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
      const deliveryResponse = await this.postToDestination(destination, event);
      this.deliveryAttemptRepository.merge(deliveryAttempt, deliveryResponse);
      await this.deliveryAttemptRepository.save(deliveryAttempt);
    }
  }
}
