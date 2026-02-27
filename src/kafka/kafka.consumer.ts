import { Injectable } from '@nestjs/common';
import { OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Consumer, KafkaMessage } from 'kafkajs';
import { DeliveryService } from '@/delivery/delivery.service';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IWebhookEventMessage } from '@/common/interfaces/webhook-event-message.interface';
import { KafkaProducer } from '@/kafka/kafka.producer';

@Injectable()
export class KafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumer.name);
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly deliveryService: DeliveryService,
    @InjectRepository(DestinationEntity)
    private readonly destinationRepository: Repository<DestinationEntity>,
    private readonly kafkaProducer: KafkaProducer,
  ) {
    const kafkaBroker = this.configService.get<string>('kafka.broker');

    if (!kafkaBroker) {
      throw new Error('KAFKA_BROKER environment variable is not set');
    }
    this.consumer = new Kafka({
      clientId: 'webhook-router',
      brokers: [kafkaBroker],
    }).consumer({ groupId: 'webhook-router-group' });
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'webhook-events', fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await this.consumeMessage(topic, partition, message);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async consumeMessage(topic: string, partition: number, message: KafkaMessage): Promise<void> {
    if (!message?.value) {
      this.logger.warn(`Received empty message from topic ${topic}`);
      return;
    }
    let event: IWebhookEventMessage;
    try {
      event = JSON.parse(message.value.toString()) as IWebhookEventMessage;
    } catch (error) {
      const dlqMessage = {
        event: (error as Error).message,
        error: 'Failed to parse message value as JSON',
        topic,
        partition,
        offset: message.offset,
        attemptNumber: 1,
        timestamp: new Date().toISOString(),
      };
      try {
        await this.kafkaProducer.sendMessage(
          'webhook-events-dlq',
          message.key?.toString() ?? 'unknown',
          dlqMessage,
        );
      } catch (dlqError) {
        this.logger.error('Failed to send message to DLQ:', (dlqError as Error).message);
      }
      return;
    }
    const maxRetryAttempts = this.configService.get<number>('kafka.maxRetryAttempts');
    const retryBackoffMs = this.configService.get<number>('kafka.retryBackoffMs');

    if (maxRetryAttempts == null || retryBackoffMs == null) {
      this.logger.error(
        'Kafka retry configuration is missing. Please set KAFKA_MAX_RETRY_ATTEMPTS and KAFKA_RETRY_BACKOFF_MS environment variables.',
      );
      return;
    }

    let lastError: unknown;

    for (let i = 0; i < maxRetryAttempts; i++) {
      try {
        const destinations = await this.destinationRepository.find({
          where: { endpointId: event.endpointId, isActive: true },
        });

        await this.deliveryService.forwardEventToDestination(event, destinations);

        this.logger.log(
          `[partition=${partition}] Consumed message from topic ${topic}: ${JSON.stringify(event)}`,
        );
        return;
      } catch (error: unknown) {
        lastError = error;
        this.logger.error(
          `Error processing message from topic ${topic} (attempt ${i + 1}/${maxRetryAttempts}):`,
          (error as Error).message,
        );
        if (i < maxRetryAttempts - 1) {
          await this.delay(retryBackoffMs);
        }
      }
    }

    try {
      const dlqMessage = {
        event,
        error: (lastError as Error).message,
        topic,
        partition,
        offset: message.offset,
        attemptNumber: maxRetryAttempts,
        timestamp: new Date().toISOString(),
      };
      await this.kafkaProducer.sendMessage(
        'webhook-events-dlq',
        message.key?.toString() ?? 'unknown',
        dlqMessage,
      );
    } catch (dlqError) {
      this.logger.error('Failed to send message to DLQ:', (dlqError as Error).message);
    }
  }
}
