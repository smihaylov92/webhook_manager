import { Test, type TestingModule } from '@nestjs/testing';
import { EndpointsService } from './endpoints.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EndpointEntity } from '@/database/entities/endpoint.entity';
import { NotFoundException } from '@nestjs/common';

const mockEndpointRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockEndpoint = {
  id: 'endpoint-123',
  slug: 'my-endpoint',
  name: 'My Endpoint',
  description: 'Test endpoint',
  isActive: true,
} as unknown as EndpointEntity;

describe('EndpointsService', () => {
  let service: EndpointsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndpointsService,
        {
          provide: getRepositoryToken(EndpointEntity),
          useValue: mockEndpointRepository,
        },
      ],
    }).compile();

    service = module.get<EndpointsService>(EndpointsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a new endpoint', async () => {
      mockEndpointRepository.create.mockReturnValue(mockEndpoint);
      mockEndpointRepository.save.mockResolvedValue(mockEndpoint);

      const result = await service.create(mockEndpoint);
      expect(result).toEqual(mockEndpoint);
      expect(mockEndpointRepository.create).toHaveBeenCalledWith(mockEndpoint);
      expect(mockEndpointRepository.save).toHaveBeenCalledWith(mockEndpoint);
    });

    it('should generate a slug if not provided', async () => {
      const endpointWithoutSlug = { ...mockEndpoint, slug: undefined };
      mockEndpointRepository.create.mockReturnValue(endpointWithoutSlug);
      mockEndpointRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create(endpointWithoutSlug);

      expect(result.slug).toMatch(/^ep-[a-f0-9]{8}$/);
      expect(mockEndpointRepository.create).toHaveBeenCalledWith(endpointWithoutSlug);
      expect(mockEndpointRepository.save).toHaveBeenCalledWith({
        ...endpointWithoutSlug,
        slug: result.slug,
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of endpoints', async () => {
      const endpoints = [mockEndpoint];
      mockEndpointRepository.find.mockResolvedValue(endpoints);
      const result = await service.findAll();
      expect(result).toEqual(endpoints);
      expect(mockEndpointRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an endpoint by ID', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const result = await service.findOne(mockEndpoint.id);
      expect(result).toEqual(mockEndpoint);
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockEndpoint.id },
      });
    });

    it('should throw NotFoundException if endpoint not found', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('findOneBySlug', () => {
    it('should return an endpoint by slug', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      const result = await service.findOneBySlug(mockEndpoint.slug);
      expect(result).toEqual(mockEndpoint);
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockEndpoint.slug },
      });
    });

    it('should throw NotFoundException if endpoint not found', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.findOneBySlug('non-existent-slug')).rejects.toThrow(NotFoundException);
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'non-existent-slug' },
      });
    });
  });

  describe('update', () => {
    it('should update and return the endpoint', async () => {
      const updatedEndpoint = { ...mockEndpoint, name: 'Updated Name' };
      mockEndpointRepository.findOne
        .mockResolvedValueOnce(mockEndpoint)
        .mockResolvedValueOnce(updatedEndpoint);
      const result = await service.update(mockEndpoint.id, { name: 'Updated Name' });
      expect(result).toEqual(updatedEndpoint);
      expect(mockEndpointRepository.update).toHaveBeenCalledWith(mockEndpoint.id, {
        name: 'Updated Name',
      });
    });

    it('should throw NotFoundException if endpoint not found', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.update('non-existent-id', { name: 'Name' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('delete', () => {
    it('should delete the endpoint', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(mockEndpoint);
      mockEndpointRepository.delete.mockResolvedValue(undefined);
      await service.delete(mockEndpoint.id);
      expect(mockEndpointRepository.delete).toHaveBeenCalledWith(mockEndpoint.id);
    });

    it('should throw NotFoundException if endpoint not found', async () => {
      mockEndpointRepository.findOne.mockResolvedValue(null);
      await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(mockEndpointRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });
});
