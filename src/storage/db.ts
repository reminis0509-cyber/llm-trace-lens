import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

/**
 * Check if running in Vercel Serverless environment
 * In Vercel, SQLite cannot be used (no persistent filesystem)
 */
function isVercelEnvironment(): boolean {
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true';
}

/**
 * Check if SQLite is available
 */
export function isSQLiteAvailable(): boolean {
  return !isVercelEnvironment();
}

/**
 * Get or create database connection
 * Returns null in Vercel environment where SQLite is not available
 */
export function getDatabase(): Database.Database {
  // In Vercel environment, SQLite is not available
  if (isVercelEnvironment()) {
    throw new Error('SQLite is not available in Vercel Serverless environment. Use KV instead.');
  }

  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './data/traces.db';

    // Ensure data directory exists
    const dataDir = dirname(dbPath);
    if (dataDir !== '.' && !existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run migrations
    runMigrations(db);

    console.log(`📦 Database initialized: ${dbPath}`);
  }

  return db;
}

/**
 * Run all migrations
 */
function runMigrations(database: Database.Database): void {
  const migrationsDir = join(__dirname, 'migrations');

  try {
    const migrationFile = join(migrationsDir, '001_initial.sql');
    const sql = readFileSync(migrationFile, 'utf-8');

    database.exec(sql);
    console.log('📦 Migrations completed');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
