import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env, dbConfig } from '../config/environment';
import logger, { dbLogger } from '../config/logger';
import * as schema from './schema';

// Create PostgreSQL connection (only if DATABASE_URL is provided)
const sql = env.DATABASE_URL ? postgres(env.DATABASE_URL, {
  max: dbConfig.max,
  idle_timeout: dbConfig.idleTimeoutMillis / 1000,
  connect_timeout: dbConfig.connectionTimeoutMillis / 1000,
  ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
  onnotice: () => {}, // Suppress notices in production
  debug: env.NODE_ENV === 'development',
}) : null as any;

// Create Drizzle database instance (only if we have a connection)
export const db = sql ? drizzle(sql, { 
  schema,
  logger: env.NODE_ENV === 'development' ? {
    logQuery: (query, params) => {
      dbLogger.debug('SQL Query', { query, params });
    }
  } : false,
}) : null as any;

// Test database connection
export async function testConnection(): Promise<boolean> {
  if (!sql) {
    dbLogger.warn('No database URL configured');
    return false;
  }
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
  if (!sql) {
    return;
  }
  try {
    await sql.end();
    dbLogger.info('Database connection closed');
  } catch (error) {
    dbLogger.error('Error closing database connection', { error });
  }
}

// Connection error handling (postgres.js doesn't have .on method)
// Error handling is done in the connection configuration above

// Export types
export type Database = typeof db;

export default db;
export { sql };