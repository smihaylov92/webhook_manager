import { Test, type TestingModule } from '@nestjs/testing';
import { DeliveryProcessor } from './delivery.processor';
import { DeliveryService } from './delivery.service';
import type { EventEntity } from '@/database/entities/event.entity';
import type { DestinationEntity } from '@/database/entities/destination.entity';
import type { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';
import type { Job } from 'bullmq';

const mockDeliveryService = {
  getDeliveryAttemptById: jest.fn(),
  attemptDelivery: jest.fn(),
  mergeDeliveryAttemptError: jest.fn(),
};

const mockEvent = {
  id: 'event-123',
  body: { event: 'payment.success', amount: 49.99 },
} as unknown as EventEntity;

const mockDestination = {
  id: 'dest-456',
  url: 'https://example.com/webhook',
  httpMethod: 'POST',
  headers: { 'X-Test': 'hello' },
} as unknown as DestinationEntity;

const mockDeliveryAttempt = {
  id: 'attempt-789',
  status: DeliveryStatus.PENDING,
  event: mockEvent,
  destination: mockDestination,
} as unknown as DeliveryAttemptEntity;

const createMockJob = (overrides: Partial<Job> = {}) =>
  ({
    data: {
      event: mockEvent,
      destination: mockDestination,
      deliveryAttemptId: mockDeliveryAttempt.id,
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  }) as unknown as Job;

describe('DeliveryProcessor', () => {
  let processor: DeliveryProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryProcessor,
        {
          provide: DeliveryService,
          useValue: mockDeliveryService,
        },
      ],
    }).compile();

    processor = module.get<DeliveryProcessor>(DeliveryProcessor);

    mockDeliveryService.getDeliveryAttemptById.mockResolvedValue(mockDeliveryAttempt);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('processDelivery', () => {
    it('should attempt delivery and update status on success', async () => {
      mockDeliveryService.attemptDelivery.mockResolvedValue({ success: true });
      const job = createMockJob() as unknown as Job<{
        event: EventEntity;
        destination: DestinationEntity;
        deliveryAttemptId: string;
      }>;
      await processor.process(job);
      expect(mockDeliveryService.getDeliveryAttemptById).toHaveBeenCalledWith(
        mockDeliveryAttempt.id,
      );
      expect(mockDeliveryService.attemptDelivery).toHaveBeenCalledWith(
        mockEvent,
        mockDestination,
        mockDeliveryAttempt,
      );
      expect(mockDeliveryService.mergeDeliveryAttemptError).not.toHaveBeenCalled();
    });

    it('should handle delivery failure and retry', async () => {
      const error = new Error('Network error');
      mockDeliveryService.attemptDelivery.mockRejectedValue(error);
      const job = createMockJob({ attemptsMade: 1 }) as unknown as Job<{
        event: EventEntity;
        destination: DestinationEntity;
        deliveryAttemptId: string;
      }>;

      await expect(processor.process(job)).rejects.toThrow('Network error');
      expect(mockDeliveryService.getDeliveryAttemptById).toHaveBeenCalledWith(
        mockDeliveryAttempt.id,
      );
      expect(mockDeliveryService.attemptDelivery).toHaveBeenCalledWith(
        mockEvent,
        mockDestination,
        mockDeliveryAttempt,
      );
      expect(mockDeliveryService.mergeDeliveryAttemptError).toHaveBeenCalledWith(
        mockDeliveryAttempt,
        error,
        1,
        3,
      );
    });

    it('should not retry after max attempts', async () => {
      const error = new Error('Network error');
      mockDeliveryService.attemptDelivery.mockRejectedValue(error);
      const job = createMockJob({ attemptsMade: 2 }) as unknown as Job<{
        event: EventEntity;
        destination: DestinationEntity;
        deliveryAttemptId: string;
      }>;

      await expect(processor.process(job)).resolves.toBeUndefined();
      expect(mockDeliveryService.getDeliveryAttemptById).toHaveBeenCalledWith(
        mockDeliveryAttempt.id,
      );
      expect(mockDeliveryService.attemptDelivery).toHaveBeenCalledWith(
        mockEvent,
        mockDestination,
        mockDeliveryAttempt,
      );
      expect(mockDeliveryService.mergeDeliveryAttemptError).toHaveBeenCalledWith(
        mockDeliveryAttempt,
        error,
        2,
        3,
      );
    });
  });
});
