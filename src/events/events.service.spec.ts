import { Test, type TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEntity } from '@/database/entities/event.entity';
import { EndpointEntity } from '@/database/entities/endpoint.entity';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { DeliveryService } from '@/delivery/delivery.service';
import { NotFoundException } from '@nestjs/common';
import type { IEvent } from '@/endpoints/interfaces/event.interface';

const mockEventRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockEndpointRepository = {
  findOne: jest.fn(),
};

const mockDestinationRepository = {
  find: jest.fn(),
};

const mockDeliveryService = {
  forwardEventToDestination: jest.fn(),
};

const mockEndpoint = {
  id: 'endpoint-123',
  slug: 'my-endpoint',
  name: 'My Endpoint',
} as unknown as EndpointEntity;

const mockEventParam = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { event: 'payment.success' },
  sourceIp: 'test-ip',
} as IEvent;

const mockEvent = {
  id: 'event-456',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { event: 'payment.success' },
  endpoint: mockEndpoint,
  sourceIp: 'test-ip',
} as unknown as EventEntity;

const mockDestination = {
  id: 'dest-789',
  endpointId: 'endpoint-123',
  url: 'https://example.com/webhook',
  httpMethod: 'POST',
  headers: {},
  isActive: true,
} as unknown as DestinationEntity;

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(EventEntity),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(EndpointEntity),
          useValue: mockEndpointRepository,
        },
        {
          provide: getRepositoryToken(DestinationEntity),
          useValue: mockDestinationRepository,
        },
        {
          provide: DeliveryService,
          useValue: mockDeliveryService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEvent', () => {
    it('should create an event and forward to destinations', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      mockEventRepository.create.mockReturnValue(mockEvent);
      mockEventRepository.save.mockResolvedValue(mockEvent);
      mockDestinationRepository.find.mockResolvedValue([mockDestination]);
      mockDeliveryService.forwardEventToDestination.mockResolvedValue(undefined);

      const result = await service.createEvent('my-endpoint', mockEventParam);

      expect(result).toEqual(mockEvent);
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'my-endpoint' },
      });
      expect(mockEventRepository.create).toHaveBeenCalledWith({
        method: mockEvent.method,
        headers: mockEvent.headers,
        body: mockEvent.body,
        endpoint: mockEndpoint,
        sourceIp: mockEvent.sourceIp,
      });
      expect(mockEventRepository.save).toHaveBeenCalledWith(mockEvent);
      expect(mockDestinationRepository.find).toHaveBeenCalledWith({
        where: { endpointId: mockEndpoint.id, isActive: true },
      });
      expect(mockDeliveryService.forwardEventToDestination).toHaveBeenCalledWith(mockEvent, [
        mockDestination,
      ]);
    });

    it('should throw NotFoundException if endpoint does not exist', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.createEvent('non-existent-endpoint', mockEventParam)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEventById', () => {
    it('should return an event by ID', async () => {
      mockEventRepository.findOne.mockResolvedValue(mockEvent);
      const result = await service.getEventById('event-456');
      expect(result).toEqual(mockEvent);
      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'event-456' },
        relations: ['deliveryAttempts'],
      });
    });

    it('should throw NotFoundException if event does not exist', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);
      await expect(service.getEventById('non-existent-event')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEventsBySlug', () => {
    it('should return events for a given slug', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const mockEvents = [mockEvent];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };
      mockEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      const result = await service.getEventsBySlug('my-slug', { limit: 10 });
      expect(result).toEqual({
        data: mockEvents,
        pagination: {
          hasMore: false,
          nextCursor: undefined,
          limit: 10,
        },
      });
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'my-slug' },
      });
      expect(mockEventRepository.createQueryBuilder).toHaveBeenCalledWith('event');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('event.endpointId = :endpointId', {
        endpointId: mockEndpoint.id,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('event.receivedAt', 'DESC');
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(11);
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if endpoint does not exist', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.getEventsBySlug('non-existent-slug', { limit: 10 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if after event does not exist', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockEventRepository.findOne.mockResolvedValue(null); // Simulate after event not found
      await expect(
        service.getEventsBySlug('my-slug', { limit: 10, after: 'non-existent-event' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return hasMore=true if there are more events than the limit', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const mockEvents = Array(11).fill(mockEvent);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };
      mockEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      const result = await service.getEventsBySlug('my-slug', { limit: 10 });
      expect(result.data).toEqual(mockEvents.slice(0, 10));
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should return hasMore=false if there are not more events than the limit', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const mockEvents = Array(5).fill(mockEvent);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };
      mockEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      const result = await service.getEventsBySlug('my-slug', { limit: 10 });
      expect(result.data).toEqual(mockEvents);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should return nextCursor if there are more events than the limit', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const mockEvents = Array(11)
        .fill(mockEvent)
        .map((event, index) => ({ ...event, id: `event-${index}` }) as unknown as EventEntity);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };
      mockEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      const result = await service.getEventsBySlug('my-slug', { limit: 10 });
      expect(result.pagination.nextCursor).toBe('event-9');
    });

    it('should return undefined nextCursor if there are not more events than the limit', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const mockEvents = Array(5)
        .fill(mockEvent)
        .map((event, index) => ({ ...event, id: `event-${index}` }) as unknown as EventEntity);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };
      mockEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      const result = await service.getEventsBySlug('my-slug', { limit: 10 });
      expect(result.pagination.nextCursor).toBeUndefined();
    });
  });
});
