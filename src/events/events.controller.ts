import { Controller, Param, Post, Req } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventEntity } from '@/endpoints/entities/event.entity';
import type { Request } from 'express';
import type { IEvent } from '@/endpoints/interfaces/event.interface';

@Controller('webhooks')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post(':slug')
  async createEvent(@Param('slug') slug: string, @Req() request: Request): Promise<EventEntity> {
    const event: IEvent = {
      method: request.method,
      headers: request.headers as Record<string, string>,
      body: request.body as Record<string, string>,
      queryParams: request.query as Record<string, string>,
      sourceIp: request.ip,
    };

    return this.eventsService.createEvent(slug, event);
  }
}
