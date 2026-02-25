import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { GetDestinationsQueryDto } from './dto/get-destinations-query.dto';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { DestinationEntity } from '@/database/entities/destination.entity';
import { UpdateDestinationDto } from '@/destinations/dto/update-destination.dto';

@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Post()
  async create(@Body() createDestinationDto: CreateDestinationDto): Promise<DestinationEntity> {
    return await this.destinationsService.create(createDestinationDto);
  }

  @Get()
  async getByEndpoint(@Query() query: GetDestinationsQueryDto): Promise<DestinationEntity[]> {
    return await this.destinationsService.findByEndpointId(query.endpointId);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<DestinationEntity> {
    return await this.destinationsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDestinationDto: UpdateDestinationDto,
  ): Promise<DestinationEntity> {
    return await this.destinationsService.update(id, updateDestinationDto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.destinationsService.delete(id);
  }
}
