import type { EventEntity } from '../entities/event.entity';

export interface IEventResponse {
  data: EventEntity[];
  pagination: {
    hasMore: boolean;
    limit: number;
    nextCursor?: string;
  };
}
