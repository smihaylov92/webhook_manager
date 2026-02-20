import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EndpointEntity } from './entities/endpoint.entity';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import * as crypto from 'crypto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

@Injectable()
export class EndpointsService {
  constructor(
    @InjectRepository(EndpointEntity)
    private readonly endpointRepository: Repository<EndpointEntity>,
  ) {}

  async create(createEndpointDto: CreateEndpointDto): Promise<EndpointEntity> {
    const endpoint = this.endpointRepository.create(createEndpointDto);
    if (!endpoint.slug) {
      endpoint.slug = `ep-${crypto.randomBytes(4).toString('hex')}`;
    }
    return this.endpointRepository.save(endpoint);
  }

  async findAll(): Promise<EndpointEntity[]> {
    return this.endpointRepository.find();
  }

  async findOne(id: string): Promise<EndpointEntity | null> {
    const endpoint = await this.endpointRepository.findOne({ where: { id } });
    if (!endpoint) {
      throw new NotFoundException(`Endpoint with ID ${id} not found`);
    }
    return endpoint;
  }

  async findOneBySlug(slug: string): Promise<EndpointEntity | null> {
    const endpoint = await this.endpointRepository.findOne({ where: { slug } });
    if (!endpoint) {
      throw new NotFoundException(`Endpoint with slug ${slug} not found`);
    }
    return endpoint;
  }

  async update(id: string, updateEndpointDto: UpdateEndpointDto): Promise<EndpointEntity | null> {
    if (!(await this.findOne(id))) {
      throw new NotFoundException(`Endpoint with ID ${id} not found`);
    }
    await this.endpointRepository.update(id, updateEndpointDto);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.endpointRepository.delete(id);
  }
}
