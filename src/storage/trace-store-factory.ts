import { TraceStoreInterface } from './trace-store-interface.js';
import { SQLiteTraceStore } from './sqlite-trace-store.js';
import { PostgresTraceStore } from './postgres-trace-store.js';

export function createTraceStore(): TraceStoreInterface {
  const dbType = process.env.DB_TYPE || 'sqlite';

  switch (dbType) {
    case 'postgres':
      return new PostgresTraceStore();
    case 'sqlite':
    default:
      return new SQLiteTraceStore();
  }
}
