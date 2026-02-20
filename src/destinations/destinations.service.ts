import { DestinationEntity } from '@/database/entities/destination.entity';
import { EndpointEntity } from '@/database/entities/endpoint.entity';
import { CreateDestinationDto } from '@/destinations/dto/create-destination.dto';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateDestinationDto } from './dto/update-destination.dto';

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(DestinationEntity)
    private readonly destinationRepository: Repository<DestinationEntity>,
    @InjectRepository(EndpointEntity)
    private readonly endpointRepository: Repository<EndpointEntity>,
  ) {}

  private async validateEndpoint(endpointId: string): Promise<EndpointEntity> {
    const endpoint = await this.endpointRepository.findOne({ where: { id: endpointId } });
    if (!endpoint) {
      throw new UnprocessableEntityException(`Endpoint with ID ${endpointId} not found`);
    }
    return endpoint;
  }

  async create(createDestinationDto: CreateDestinationDto): Promise<DestinationEntity> {
    await this.validateEndpoint(createDestinationDto.endpointId);

    const destination = this.destinationRepository.create(createDestinationDto);
    return this.destinationRepository.save(destination);
  }

  async findByEndpointId(endpointId: string): Promise<DestinationEntity[]> {
    await this.validateEndpoint(endpointId);

    return this.destinationRepository.find({ where: { endpointId } });
  }

  async findOne(id: string): Promise<DestinationEntity> {
    const destination = await this.destinationRepository.findOne({ where: { id } });
    if (!destination) {
      throw new NotFoundException(`Destination with ID ${id} not found`);
    }
    return destination;
  }

  async update(id: string, updateDestinationDto: UpdateDestinationDto): Promise<DestinationEntity> {
    await this.findOne(id);

    const { endpointId } = updateDestinationDto;
    if (endpointId) {
      await this.validateEndpoint(endpointId);
    }
    await this.destinationRepository.update(id, updateDestinationDto);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.destinationRepository.delete(id);
  }
}
