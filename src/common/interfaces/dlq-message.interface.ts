import type { IWebhookEventMessage } from '@/common/interfaces/webhook-event-message.interface';

export interface IDlqMessage {
  event: IWebhookEventMessage | string;
  error: string;
  topic: string;
  partition: number;
  offset: string;
  attemptNumber: number;
  timestamp: string;
}
