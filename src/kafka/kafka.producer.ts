import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Admin } from 'kafkajs';

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;
  private admin: Admin;
  private readonly logger = new Logger(KafkaProducer.name);

  constructor(private readonly configService: ConfigService) {
    const kafkaBroker = this.configService.get<string>('kafka.broker');
    if (!kafkaBroker) {
      throw new Error('KAFKA_BROKER environment variable is not set');
    }
    const kafka = new Kafka({
      clientId: 'webhook-router',
      brokers: [kafkaBroker],
    });
    this.producer = kafka.producer();
    this.admin = kafka.admin();
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect().catch((error) => {
      this.logger.error('Failed to connect to Kafka broker:', error);
    });

    await this.admin.connect().catch((error) => {
      this.logger.error('Failed to connect to Kafka admin:', error);
    });

    await this.admin
      .createTopics({
        topics: [{ topic: 'webhook-events', numPartitions: 3 }],
      })
      .catch((error) => {
        this.logger.error('Failed to create Kafka topic:', error);
      });

    await this.admin.disconnect().catch((error) => {
      this.logger.error('Failed to disconnect from Kafka admin:', error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect().catch((error) => {
      this.logger.error('Failed to disconnect from Kafka broker:', error);
    });
  }

  async sendMessage(topic: string, key: string, message: Record<string, unknown>): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(message) }],
      });
    } catch (error: unknown) {
      this.logger.error(`Failed to send message to Kafka topic ${topic}:`, error);
    }
  }
}
