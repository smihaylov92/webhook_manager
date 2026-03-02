interface Config {
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
  };
  kafka: {
    broker: string;
    maxRetryAttempts?: number;
    retryBackoffMs?: number;
  };
}

export default (): Config => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME ?? '',
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    ssl: process.env.NODE_ENV === 'production',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  kafka: {
    broker: process.env.KAFKA_BROKER ?? 'localhost:9092',
    maxRetryAttempts: Number(process.env.KAFKA_MAX_RETRY_ATTEMPTS),
    retryBackoffMs: Number(process.env.KAFKA_RETRY_BACKOFF_MS),
  },
});
