import { Injectable } from '@nestjs/common';
import { OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Consumer, KafkaMessage } from 'kafkajs';
import { DeliveryService } from '@/delivery/delivery.service';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IWebhookEventMessage } from '@/common/interfaces/webhook-event-message.interface';

@Injectable()
export class KafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumer.name);
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly deliveryService: DeliveryService,
    @InjectRepository(DestinationEntity)
    private readonly destinationRepository: Repository<DestinationEntity>,
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
      eachMessage: async ({ topic, message }) => {
        await this.consumeMessage(topic, message);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  async consumeMessage(topic: string, message: KafkaMessage): Promise<void> {
    try {
      if (!message?.value) {
        this.logger.warn(`Received empty message from topic ${topic}`);
        return;
      }
      const event = JSON.parse(message.value.toString()) as IWebhookEventMessage;
      const destinations = await this.destinationRepository.find({
        where: { endpointId: event.endpointId, isActive: true },
      });

      await this.deliveryService.forwardEventToDestination(event, destinations);

      this.logger.log(`Consumed message from topic ${topic}: ${JSON.stringify(event)}`);
    } catch (error: unknown) {
      throw new Error(
        `Failed to process message from Kafka topic ${topic}: ${(error as Error).message}`,
      );
    }
  }
}
