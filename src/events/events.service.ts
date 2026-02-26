import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEntity } from '@/database/entities/event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IEvent } from '@/endpoints/interfaces/event.interface';
import { GetEventsQueryDto } from './dto/get-events-query.dto';
import { IEventResponse } from '@/endpoints/interfaces/event-response.interface';
import { EndpointEntity } from '@/database/entities/endpoint.entity';
import { KafkaProducer } from '@/kafka/kafka.producer';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EndpointEntity)
    private readonly endpointRepository: Repository<EndpointEntity>,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  async createEvent(slug: string, event: IEvent): Promise<EventEntity> {
    const endpoint = await this.endpointRepository.findOne({
      where: { slug },
    });
    if (!endpoint) {
      throw new NotFoundException('Endpoint not found');
    }

    const newEvent: Partial<EventEntity> = {
      endpoint,
      ...event,
    };

    const createdEvent = this.eventRepository.create(newEvent);
    const savedEvent = await this.eventRepository.save(createdEvent);
    await this.kafkaProducer.sendMessage('webhook-events', {
      id: savedEvent.id,
      endpointId: endpoint.id,
      method: savedEvent.method,
      headers: savedEvent.headers,
      body: savedEvent.body,
    });
    return savedEvent;
  }

  async getEventById(id: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['deliveryAttempts'],
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  async getEventsBySlug(slug: string, query: GetEventsQueryDto): Promise<IEventResponse> {
    const endpoint = await this.endpointRepository.findOne({ where: { slug } });
    if (!endpoint) {
      throw new NotFoundException(`Endpoint with slug ${slug} not found`);
    }

    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .where('event.endpointId = :endpointId', { endpointId: endpoint.id })
      .orderBy('event.receivedAt', 'DESC');

    if (query.after) {
      const afterEvent = await this.eventRepository.findOne({
        select: ['receivedAt'],
        where: { id: query.after },
      });
      if (afterEvent) {
        queryBuilder.andWhere('event.receivedAt < :after', { after: afterEvent.receivedAt });
      } else {
        throw new NotFoundException(`Event with ID ${query.after} not found`);
      }
    }

    const events = await queryBuilder.take(query.limit + 1).getMany();
    const hasMore = events.length > query.limit;
    if (hasMore) {
      events.pop();
    }

    return {
      data: events,
      pagination: {
        hasMore,
        limit: query.limit,
        nextCursor: hasMore ? events[events.length - 1].id : undefined,
      },
    };
  }
}
