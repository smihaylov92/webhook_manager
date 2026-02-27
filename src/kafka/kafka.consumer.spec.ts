import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KafkaConsumer } from './kafka.consumer';
import { KafkaProducer } from './kafka.producer';
import { DeliveryService } from '@/delivery/delivery.service';
import { DestinationEntity } from '@/database/entities/destination.entity';
import type { KafkaMessage } from 'kafkajs';

const mockConsumer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    consumer: () => mockConsumer,
  })),
}));

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, unknown> = {
      'kafka.broker': 'localhost:9092',
      'kafka.maxRetryAttempts': 3,
      'kafka.retryBackoffMs': 0,
    };
    return config[key];
  }),
};

const mockDeliveryService = {
  forwardEventToDestination: jest.fn(),
};

const mockDestinationRepository = {
  find: jest.fn(),
};

const mockKafkaProducer = {
  sendMessage: jest.fn(),
};

const mockEvent = {
  id: 'event-123',
  endpointId: 'endpoint-456',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { event: 'payment.success', amount: 49.99 },
};

const mockDestination = {
  id: 'dest-789',
  endpointId: 'endpoint-456',
  url: 'https://example.com/webhook',
  httpMethod: 'POST',
  headers: {},
  isActive: true,
} as unknown as DestinationEntity;

describe('KafkaConsumer', () => {
  let consumer: KafkaConsumer;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaConsumer,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DeliveryService,
          useValue: mockDeliveryService,
        },
        {
          provide: getRepositoryToken(DestinationEntity),
          useValue: mockDestinationRepository,
        },
        {
          provide: KafkaProducer,
          useValue: mockKafkaProducer,
        },
      ],
    }).compile();

    consumer = module.get<KafkaConsumer>(KafkaConsumer);
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect, subscribe, and start consuming', async () => {
      mockConsumer.connect.mockResolvedValue(undefined);
      mockConsumer.subscribe.mockResolvedValue(undefined);
      mockConsumer.run.mockResolvedValue(undefined);

      await consumer.onModuleInit();

      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'webhook-events',
        fromBeginning: false,
      });
      expect(mockConsumer.run).toHaveBeenCalledWith({
        eachMessage: expect.any(Function),
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect the consumer', async () => {
      mockConsumer.disconnect.mockResolvedValue(undefined);
      await consumer.onModuleDestroy();
      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });
  });

  describe('consumeMessage', () => {
    it('should parse message, find destinations, and trigger delivery', async () => {
      mockDestinationRepository.find.mockResolvedValue([mockDestination]);
      mockDeliveryService.forwardEventToDestination.mockResolvedValue(undefined);

      const message = {
        value: Buffer.from(JSON.stringify(mockEvent)),
        offset: '0',
      } as KafkaMessage;

      await consumer.consumeMessage('webhook-events', 0, message);

      expect(mockDestinationRepository.find).toHaveBeenCalledWith({
        where: { endpointId: mockEvent.endpointId, isActive: true },
      });
      expect(mockDeliveryService.forwardEventToDestination).toHaveBeenCalledWith(mockEvent, [
        mockDestination,
      ]);
      expect(mockKafkaProducer.sendMessage).not.toHaveBeenCalled();
    });

    it('should warn and return early on empty message', async () => {
      const message = { value: null } as KafkaMessage;

      await consumer.consumeMessage('webhook-events', 0, message);

      expect(mockDestinationRepository.find).not.toHaveBeenCalled();
      expect(mockDeliveryService.forwardEventToDestination).not.toHaveBeenCalled();
    });

    it('should send to DLQ after all retries are exhausted', async () => {
      mockDestinationRepository.find.mockRejectedValue(new Error('DB error'));
      mockKafkaProducer.sendMessage.mockResolvedValue(undefined);

      const message = {
        value: Buffer.from(JSON.stringify(mockEvent)),
        offset: '42',
        key: Buffer.from(mockEvent.endpointId),
      } as unknown as KafkaMessage;

      await consumer.consumeMessage('webhook-events', 0, message);

      expect(mockDestinationRepository.find).toHaveBeenCalledTimes(3);
      expect(mockKafkaProducer.sendMessage).toHaveBeenCalledWith(
        'webhook-events-dlq',
        mockEvent.endpointId,
        expect.objectContaining({
          event: mockEvent,
          error: 'DB error',
          topic: 'webhook-events',
          partition: 0,
          offset: '42',
          attemptNumber: 3,
        }),
      );
    });

    it('should retry and succeed on transient error', async () => {
      mockDestinationRepository.find
        .mockRejectedValueOnce(new Error('DB temporarily down'))
        .mockResolvedValueOnce([mockDestination]);
      mockDeliveryService.forwardEventToDestination.mockResolvedValue(undefined);

      const message = {
        value: Buffer.from(JSON.stringify(mockEvent)),
        offset: '10',
      } as KafkaMessage;

      await consumer.consumeMessage('webhook-events', 0, message);

      expect(mockDestinationRepository.find).toHaveBeenCalledTimes(2);
      expect(mockDeliveryService.forwardEventToDestination).toHaveBeenCalledTimes(1);
      expect(mockKafkaProducer.sendMessage).not.toHaveBeenCalled();
    });

    it('should send unparseable messages directly to DLQ without retrying', async () => {
      mockKafkaProducer.sendMessage.mockResolvedValue(undefined);

      const message = {
        value: Buffer.from('not valid json!!!'),
        offset: '7',
        key: null,
      } as unknown as KafkaMessage;

      await consumer.consumeMessage('webhook-events', 0, message);

      expect(mockDestinationRepository.find).not.toHaveBeenCalled();
      expect(mockKafkaProducer.sendMessage).toHaveBeenCalledWith(
        'webhook-events-dlq',
        'unknown',
        expect.objectContaining({
          error: 'Failed to parse message value as JSON',
          topic: 'webhook-events',
          partition: 0,
          offset: '7',
          attemptNumber: 1,
        }),
      );
    });

    it('should not throw even if DLQ publish fails', async () => {
      mockDestinationRepository.find.mockRejectedValue(new Error('DB error'));
      mockKafkaProducer.sendMessage.mockRejectedValue(new Error('Kafka down'));

      const message = {
        value: Buffer.from(JSON.stringify(mockEvent)),
        offset: '99',
      } as KafkaMessage;

      await expect(consumer.consumeMessage('webhook-events', 0, message)).resolves.toBeUndefined();
    });
  });
});
