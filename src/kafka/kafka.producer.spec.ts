import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaProducer } from './kafka.producer';

const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

const mockAdmin = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  createTopics: jest.fn(),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => mockProducer,
    admin: () => mockAdmin,
  })),
}));

const mockConfigService = {
  get: jest.fn().mockReturnValue('localhost:9092'),
};

describe('KafkaProducer', () => {
  let service: KafkaProducer;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('localhost:9092');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaProducer,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KafkaProducer>(KafkaProducer);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect the producer and create topics via admin', async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      mockAdmin.connect.mockResolvedValue(undefined);
      mockAdmin.createTopics.mockResolvedValue(undefined);
      mockAdmin.disconnect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockProducer.connect).toHaveBeenCalled();
      expect(mockAdmin.connect).toHaveBeenCalled();
      expect(mockAdmin.createTopics).toHaveBeenCalledWith({
        topics: [
          { topic: 'webhook-events', numPartitions: 3 },
          { topic: 'webhook-events-dlq', numPartitions: 1 },
        ],
      });
      expect(mockAdmin.disconnect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect the producer', async () => {
      mockProducer.disconnect.mockResolvedValue(undefined);
      await service.onModuleDestroy();
      expect(mockProducer.disconnect).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send a JSON-serialized message with key to the topic', async () => {
      mockProducer.send.mockResolvedValue(undefined);
      const message = { id: 'event-123', endpointId: 'ep-001', body: { test: true } };

      await service.sendMessage('webhook-events', 'ep-001', message);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'webhook-events',
        messages: [{ key: 'ep-001', value: JSON.stringify(message) }],
      });
    });

    it('should log an error if send fails', async () => {
      mockProducer.send.mockRejectedValue(new Error('Kafka unavailable'));

      // Should not throw — error is caught and logged
      await expect(
        service.sendMessage('webhook-events', 'ep-001', { test: true }),
      ).resolves.toBeUndefined();
    });
  });
});
