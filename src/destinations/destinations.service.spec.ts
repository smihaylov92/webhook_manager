import { Test, type TestingModule } from '@nestjs/testing';
import { DestinationsService } from './destinations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { EndpointEntity } from '@/database/entities/endpoint.entity';
import { HttpMethods } from '@/common/enums/http-methods.enum';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const mockDestinationRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockEndpointRepository = {
  findOne: jest.fn(),
};

const mockEndpoint = {
  id: 'endpoint-123',
  slug: 'my-endpoint',
  name: 'My Endpoint',
} as unknown as EndpointEntity;

const mockDestination = {
  id: 'dest-456',
  endpointId: 'endpoint-123',
  url: 'https://example.com/webhook',
  httpMethod: HttpMethods.POST,
  headers: { 'Content-Type': 'application/json' },
  isActive: true,
} as unknown as DestinationEntity;

describe('DestinationsService', () => {
  let service: DestinationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DestinationsService,
        {
          provide: getRepositoryToken(DestinationEntity),
          useValue: mockDestinationRepository,
        },
        {
          provide: getRepositoryToken(EndpointEntity),
          useValue: mockEndpointRepository,
        },
      ],
    }).compile();

    service = module.get<DestinationsService>(DestinationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a new destination', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      mockDestinationRepository.create.mockReturnValue(mockDestination);
      mockDestinationRepository.save.mockResolvedValue(mockDestination);
      const result = await service.create({
        endpointId: 'endpoint-123',
        url: 'https://example.com/webhook',
        httpMethod: HttpMethods.POST,
        headers: { 'Content-Type': 'application/json' },
        isActive: true,
      });
      expect(result).toEqual(mockDestination);
    });

    it('should throw UnprocessableEntityException if endpoint does not exist', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({
          endpointId: 'non-existent-endpoint',
          url: 'https://example.com/webhook',
          httpMethod: HttpMethods.POST,
          headers: { 'Content-Type': 'application/json' },
          isActive: true,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('findByEndpointId', () => {
    it('should return an array of destinations for a valid endpoint ID', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      mockDestinationRepository.find.mockResolvedValue([mockDestination]);
      const result = await service.findByEndpointId('endpoint-123');
      expect(result).toEqual([mockDestination]);
    });
    it('should throw UnprocessableEntityException if endpoint does not exist', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.findByEndpointId('non-existent-endpoint')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a destination by ID', async () => {
      mockDestinationRepository.findOne.mockResolvedValue(mockDestination);
      const result = await service.findOne('dest-456');
      expect(result).toEqual(mockDestination);
      expect(mockDestinationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dest-456' },
      });
    });
    it('should throw NotFoundException if destination not found', async () => {
      mockDestinationRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent-dest')).rejects.toThrow(NotFoundException);
      expect(mockDestinationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-dest' },
      });
    });
  });

  describe('update', () => {
    it('should update and return the destination', async () => {
      const updatedDestination = { ...mockDestination, url: 'https://example.com/new-webhook' };
      mockDestinationRepository.findOne.mockResolvedValue(mockDestination);
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      mockDestinationRepository.update.mockResolvedValue(undefined);
      mockDestinationRepository.findOne.mockResolvedValue(updatedDestination);
      const result = await service.update('dest-456', {
        url: 'https://example.com/new-webhook',
      });
      expect(mockDestinationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dest-456' },
      });
      expect(result).toEqual(updatedDestination);
    });

    it('should throw NotFoundException if destination not found', async () => {
      mockDestinationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.update('non-existent-dest', { url: 'https://example.com/new-webhook' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException if new endpoint does not exist', async () => {
      mockDestinationRepository.findOne.mockResolvedValue(mockDestination);
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(
        service.update('dest-456', { endpointId: 'non-existent-endpoint' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('delete', () => {
    it('should delete the destination', async () => {
      mockDestinationRepository.findOne.mockResolvedValue(mockDestination);
      mockDestinationRepository.delete.mockResolvedValue(undefined);
      await service.delete('dest-456');
      expect(mockDestinationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dest-456' },
      });
      expect(mockDestinationRepository.delete).toHaveBeenCalledWith('dest-456');
    });

    it('should throw NotFoundException if destination not found', async () => {
      mockDestinationRepository.findOne.mockResolvedValue(null);
      await expect(service.delete('non-existent-dest')).rejects.toThrow(NotFoundException);
    });
  });
});
