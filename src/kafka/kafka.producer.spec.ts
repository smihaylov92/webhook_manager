import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaProducer } from './kafka.producer';

const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => mockProducer,
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
    it('should connect the producer', async () => {
      mockProducer.connect.mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(mockProducer.connect).toHaveBeenCalled();
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
    it('should send a JSON-serialized message to the topic', async () => {
      mockProducer.send.mockResolvedValue(undefined);
      const message = { id: 'event-123', body: { test: true } };

      await service.sendMessage('webhook-events', message);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'webhook-events',
        messages: [{ value: JSON.stringify(message) }],
      });
    });

    it('should log an error if send fails', async () => {
      mockProducer.send.mockRejectedValue(new Error('Kafka unavailable'));

      // Should not throw — error is caught and logged
      await expect(service.sendMessage('webhook-events', { test: true })).resolves.toBeUndefined();
    });
  });
});
