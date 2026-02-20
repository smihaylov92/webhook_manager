export interface IEvent {
  method: string;
  headers?: Record<string, string>;
  body?: Record<string, string>;
  queryParams?: Record<string, string>;
  sourceIp: string | undefined;
}
