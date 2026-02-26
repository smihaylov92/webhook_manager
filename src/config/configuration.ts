interface Config {
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
  };
  kafka: {
    broker: string;
  };
}

export default (): Config => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME ?? '',
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  kafka: {
    broker: process.env.KAFKA_BROKER ?? 'localhost:9092',
  },
});
