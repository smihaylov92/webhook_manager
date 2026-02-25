import { EventEntity } from '@/database/entities/event.entity';
import { EventsService } from '@/events/events.service';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

@Controller('events')
export class EventsInspectionController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':id')
  async getEventById(@Param('id', ParseUUIDPipe) id: string): Promise<EventEntity> {
    return await this.eventsService.getEventById(id);
  }
}
