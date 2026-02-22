/**
 * Shared Knex client for database operations
 * Used for workspace_users, invitations, and other tables
 */
import knex, { Knex } from 'knex';
import activeConfig from '../config/knexfile.js';

let db: Knex | null = null;

/**
 * Get or create shared Knex instance
 */
export function getKnex(): Knex {
  if (!db) {
    db = knex(activeConfig);
  }
  return db;
}

/**
 * Close Knex connection (for graceful shutdown)
 */
export async function closeKnex(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
