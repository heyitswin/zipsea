import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env, dbConfig } from '../config/environment';
import logger, { dbLogger } from '../config/logger';
import * as schema from './schema';

// Create PostgreSQL connection
const sql = postgres(env.DATABASE_URL, {
  max: dbConfig.max,
  idle_timeout: dbConfig.idleTimeoutMillis / 1000,
  connect_timeout: dbConfig.connectionTimeoutMillis / 1000,
  ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
  onnotice: () => {}, // Suppress notices in production
  debug: env.NODE_ENV === 'development',
});

// Create Drizzle database instance
export const db = drizzle(sql, { 
  schema,
  logger: env.NODE_ENV === 'development' ? {
    logQuery: (query, params) => {
      dbLogger.debug('SQL Query', { query, params });
    }
  } : false,
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    dbLogger.info('Database connection established successfully');
    return true;
  } catch (error) {
    dbLogger.error('Failed to connect to database', { error });
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  try {
    await sql.end();
    dbLogger.info('Database connection closed');
  } catch (error) {
    dbLogger.error('Error closing database connection', { error });
  }
}

// Connection error handling
sql.on('error', (error) => {
  dbLogger.error('Database connection error', { error });
});

// Export types
export type Database = typeof db;

export default db;