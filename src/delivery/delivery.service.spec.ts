import { Test, type TestingModule } from '@nestjs/testing';
import { DeliveryService } from './delivery.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DeliveryAttemptEntity } from '@/database/entities/delivery-attempt.entity';
import { DeliveryStatus } from '@/common/enums/delivery-status.enum';
import { HttpService } from '@nestjs/axios';
import type { EventEntity } from '@/database/entities/event.entity';
import type { DestinationEntity } from '@/database/entities/destination.entity';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import type { AxiosError } from 'axios';

// Reusable mock factories — you'll use these across all test files
const mockDeliveryAttemptRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

const mockHttpService = {
  request: jest.fn(),
};

// Test data — build once, reuse across tests
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

describe('DeliveryService', () => {
  let service: DeliveryService;

  beforeEach(async () => {
    // Reset all mocks between tests so they don't leak state
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        {
          // This replaces the real TypeORM repository with our mock
          provide: getRepositoryToken(DeliveryAttemptEntity),
          useValue: mockDeliveryAttemptRepository,
        },
        {
          // This replaces the real BullMQ queue with our mock
          provide: getQueueToken('delivery'),
          useValue: mockQueue,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);

    mockDeliveryAttemptRepository.merge.mockImplementation((entity, data) => {
      Object.assign(entity, data);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forwardEventToDestination', () => {
    it('should create a pending delivery attempt and queue a job for each destination', async () => {
      // Arrange: set up what the mocks return
      mockDeliveryAttemptRepository.create.mockReturnValue(mockDeliveryAttempt);
      mockDeliveryAttemptRepository.save.mockResolvedValue(mockDeliveryAttempt);

      // Act: call the method under test
      await service.forwardEventToDestination(mockEvent, [mockDestination]);

      // Assert: verify the delivery attempt was created with correct data
      expect(mockDeliveryAttemptRepository.create).toHaveBeenCalledWith({
        event: mockEvent,
        destination: mockDestination,
        status: DeliveryStatus.PENDING,
      });
      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledWith(mockDeliveryAttempt);

      // Assert: verify the job was added to the queue with correct payload
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-delivery',
        {
          deliveryAttemptId: mockDeliveryAttempt.id,
          event: mockEvent,
          destination: mockDestination,
        },
        {
          attempts: 3,
          backoff: { type: 'fixed', delay: 60000 },
        },
      );
    });

    it('should process multiple destinations independently', async () => {
      const secondDestination = {
        id: 'dest-999',
        url: 'https://other.com/hook',
        httpMethod: 'POST',
        headers: {},
      } as unknown as DestinationEntity;

      const firstAttempt = { ...mockDeliveryAttempt, id: 'attempt-1' };
      const secondAttempt = { ...mockDeliveryAttempt, id: 'attempt-2' };

      mockDeliveryAttemptRepository.create
        .mockReturnValueOnce(firstAttempt)
        .mockReturnValueOnce(secondAttempt);
      mockDeliveryAttemptRepository.save
        .mockResolvedValueOnce(firstAttempt)
        .mockResolvedValueOnce(secondAttempt);

      await service.forwardEventToDestination(mockEvent, [mockDestination, secondDestination]);

      // Both destinations get their own delivery attempt and job
      expect(mockDeliveryAttemptRepository.create).toHaveBeenCalledTimes(2);
      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);

      // Each job gets the correct destination
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        1,
        'process-delivery',
        expect.objectContaining({ destination: mockDestination }),
        expect.any(Object),
      );
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        2,
        'process-delivery',
        expect.objectContaining({ destination: secondDestination }),
        expect.any(Object),
      );
    });

    it('should do nothing when destinations array is empty', async () => {
      await service.forwardEventToDestination(mockEvent, []);

      expect(mockDeliveryAttemptRepository.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('retryDelivery', () => {
    it('should throw an error if the delivery attempt is not found', async () => {
      mockDeliveryAttemptRepository.findOne.mockResolvedValue(null);
      await expect(service.retryDelivery('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw an error if the delivery attempt is not in a retryable state', async () => {
      const nonRetryableAttempt = { ...mockDeliveryAttempt, status: DeliveryStatus.SUCCESS };
      mockDeliveryAttemptRepository.findOne.mockResolvedValue(nonRetryableAttempt);
      await expect(service.retryDelivery(nonRetryableAttempt.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should attempt delivery and update the attempt on success', async () => {
      const failedAttempt = {
        ...mockDeliveryAttempt,
        status: DeliveryStatus.FAILED,
        attemptNumber: 1,
      };
      mockDeliveryAttemptRepository.findOne.mockResolvedValue(failedAttempt);
      mockHttpService.request.mockReturnValue(of({ status: 200, data: 'OK' }));
      mockDeliveryAttemptRepository.save.mockResolvedValue({
        ...failedAttempt,
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });

      await expect(service.retryDelivery(failedAttempt.id)).resolves.toEqual({
        ...failedAttempt,
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });

      expect(mockHttpService.request).toHaveBeenCalledWith({
        url: mockDestination.url,
        method: mockDestination.httpMethod,
        headers: mockDestination.headers,
        data: mockEvent.body,
      });
      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledWith({
        ...failedAttempt,
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });
      expect(mockDeliveryAttemptRepository.merge).toHaveBeenCalledWith(failedAttempt, {
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });
    });

    it('should attempt delivery and update the attempt on failure', async () => {
      const failedAttempt = {
        ...mockDeliveryAttempt,
        status: DeliveryStatus.FAILED,
        attemptNumber: 1,
      };
      mockDeliveryAttemptRepository.findOne.mockResolvedValue(failedAttempt);
      const axiosError = {
        message: 'Network error',
        response: { status: 500, data: 'Internal Server Error' },
      } as AxiosError;
      mockHttpService.request.mockReturnValue(throwError(() => axiosError));
      mockDeliveryAttemptRepository.save.mockResolvedValue({
        ...failedAttempt,
        status: DeliveryStatus.FAILED,
        responseStatusCode: 500,
        responseBody: 'Internal Server Error',
        errorMessage: 'Network error',
      });

      await expect(service.retryDelivery(failedAttempt.id)).resolves.toEqual({
        ...failedAttempt,
        status: DeliveryStatus.FAILED,
        responseStatusCode: 500,
        responseBody: 'Internal Server Error',
        errorMessage: 'Network error',
      });

      expect(mockHttpService.request).toHaveBeenCalledWith({
        url: mockDestination.url,
        method: mockDestination.httpMethod,
        headers: mockDestination.headers,
        data: mockEvent.body,
      });
      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledWith({
        ...failedAttempt,
        status: DeliveryStatus.FAILED,
        responseStatusCode: 500,
        responseBody: 'Internal Server Error',
        errorMessage: 'Network error',
      });
      expect(mockDeliveryAttemptRepository.merge).toHaveBeenCalledWith(failedAttempt, {
        status: DeliveryStatus.FAILED,
        responseStatusCode: 500,
        responseBody: 'Internal Server Error',
        errorMessage: 'Network error',
        attemptNumber: 2,
      });
    });
  });

  describe('attemptDelivery', () => {
    it('should make an HTTP request and update the delivery attempt on success', async () => {
      mockHttpService.request.mockReturnValue(of({ status: 200, data: 'OK' }));
      mockDeliveryAttemptRepository.save.mockResolvedValue({
        ...mockDeliveryAttempt,
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });

      await expect(
        service.attemptDelivery(mockEvent, mockDestination, mockDeliveryAttempt),
      ).resolves.toEqual({
        ...mockDeliveryAttempt,
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });
      expect(mockHttpService.request).toHaveBeenCalledWith({
        url: mockDestination.url,
        method: mockDestination.httpMethod,
        headers: mockDestination.headers,
        data: mockEvent.body,
      });
      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledWith({
        ...mockDeliveryAttempt,
        status: DeliveryStatus.SUCCESS,
        responseStatusCode: 200,
        responseBody: 'OK',
      });
    });
  });

  describe('mergeDeliveryAttemptError', () => {
    it('should update the delivery attempt number when total attempts are not reached', async () => {
      const attempt = { ...mockDeliveryAttempt, status: DeliveryStatus.PENDING };
      const axiosError = {
        message: 'Network error',
        response: { status: 500, data: 'Internal Server Error' },
      } as AxiosError;
      mockDeliveryAttemptRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      // Verify initial state before the call
      expect(attempt.status).toBe(DeliveryStatus.PENDING);
      expect(attempt.attemptNumber).toBeUndefined();

      await service.mergeDeliveryAttemptError(attempt, axiosError, 1, 3);

      // Status stays PENDING because we haven't exhausted all attempts
      expect(attempt.status).toBe(DeliveryStatus.PENDING);
      // attemptNumber incremented from attemptsMade (1) + 1
      expect(attempt.attemptNumber).toBe(2);
      expect(attempt.errorMessage).toBe('Network error');
      expect(attempt.responseStatusCode).toBe(500);
      expect(attempt.responseBody).toBe('Internal Server Error');

      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledWith(attempt);
    });

    it('should update the delivery attempt to failed when total attempts are reached', async () => {
      const attempt = { ...mockDeliveryAttempt, status: DeliveryStatus.PENDING };
      const axiosError = {
        message: 'Network error',
        response: { status: 500, data: 'Internal Server Error' },
      } as AxiosError;
      mockDeliveryAttemptRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      // Verify initial state before the call
      expect(attempt.status).toBe(DeliveryStatus.PENDING);

      await service.mergeDeliveryAttemptError(attempt, axiosError, 3, 3);

      // Status changed to FAILED because attemptsMade (3) >= maxAttempts (3) - 1
      expect(attempt.status).toBe(DeliveryStatus.FAILED);
      // attemptNumber incremented from attemptsMade (3) + 1
      expect(attempt.attemptNumber).toBe(4);
      expect(attempt.errorMessage).toBe('Network error');
      expect(attempt.responseStatusCode).toBe(500);
      expect(attempt.responseBody).toBe('Internal Server Error');

      expect(mockDeliveryAttemptRepository.save).toHaveBeenCalledWith(attempt);
    });
  });
});
