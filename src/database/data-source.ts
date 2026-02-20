import { DataSource, type DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'webhooks',
  synchronize: false,
  entities: ['src/endpoints/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
} as DataSourceOptions);
