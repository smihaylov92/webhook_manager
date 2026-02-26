export interface IWebhookEventMessage {
  id: string;
  endpointId: string;
  method: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}
