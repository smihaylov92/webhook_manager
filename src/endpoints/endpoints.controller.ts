import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EndpointsService } from './endpoints.service';
import { EndpointEntity } from '../database/entities/endpoint.entity';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { GetEventsQueryDto } from '../events/dto/get-events-query.dto';
import { EventsService } from '@/events/events.service';
import { IEventResponse } from './interfaces/event-response.interface';

@Controller('endpoints')
export class EndpointsController {
  constructor(
    private readonly endpointsService: EndpointsService,
    private readonly eventService: EventsService,
  ) {}

  @Post()
  async create(@Body() createEndpointDto: CreateEndpointDto): Promise<EndpointEntity> {
    return this.endpointsService.create(createEndpointDto);
  }

  @Get()
  async getAll(): Promise<EndpointEntity[]> {
    return this.endpointsService.findAll();
  }

  @Get(':slug/events')
  async getEventsBySlug(
    @Param('slug') slug: string,
    @Query() query: GetEventsQueryDto,
  ): Promise<IEventResponse> {
    return this.eventService.getEventsBySlug(slug, query);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<EndpointEntity | null> {
    return await this.endpointsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEndpointDto: UpdateEndpointDto,
  ): Promise<EndpointEntity | null> {
    return await this.endpointsService.update(id, updateEndpointDto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.endpointsService.delete(id);
  }
}
