import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KafkaConsumer } from './kafka.consumer';
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
  get: jest.fn().mockReturnValue('localhost:9092'),
};

const mockDeliveryService = {
  forwardEventToDestination: jest.fn(),
};

const mockDestinationRepository = {
  find: jest.fn(),
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
    mockConfigService.get.mockReturnValue('localhost:9092');

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
      } as KafkaMessage;

      await consumer.consumeMessage('webhook-events', message);

      expect(mockDestinationRepository.find).toHaveBeenCalledWith({
        where: { endpointId: mockEvent.endpointId, isActive: true },
      });
      expect(mockDeliveryService.forwardEventToDestination).toHaveBeenCalledWith(mockEvent, [
        mockDestination,
      ]);
    });

    it('should warn and return early on empty message', async () => {
      const message = { value: null } as KafkaMessage;

      await consumer.consumeMessage('webhook-events', message);

      expect(mockDestinationRepository.find).not.toHaveBeenCalled();
      expect(mockDeliveryService.forwardEventToDestination).not.toHaveBeenCalled();
    });

    it('should throw on processing error', async () => {
      mockDestinationRepository.find.mockRejectedValue(new Error('DB error'));

      const message = {
        value: Buffer.from(JSON.stringify(mockEvent)),
      } as KafkaMessage;

      await expect(consumer.consumeMessage('webhook-events', message)).rejects.toThrow(
        'Failed to process message from Kafka topic webhook-events',
      );
    });
  });
});
