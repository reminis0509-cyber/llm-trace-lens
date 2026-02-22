import type { Knex } from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const migrationsDirectory = resolve(projectRoot, 'migrations');
const dataDirectory = resolve(projectRoot, 'data');

const config: { [key: string]: Knex.Config } = {
  sqlite: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.SQLITE_PATH || resolve(dataDirectory, 'traces.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: migrationsDirectory,
      extension: 'ts'
    }
  },
  postgres: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'llm_trace_lens'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: migrationsDirectory,
      extension: 'ts'
    }
  }
};

// Determine which config to use based on DB_TYPE env var
const dbType = process.env.DB_TYPE || 'sqlite';
const activeConfig = config[dbType] || config.sqlite;

// Export for both ESM and knex CLI
export default activeConfig;
export { config };
