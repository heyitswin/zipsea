import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql, closeConnection } from './connection';
import logger, { dbLogger } from '../config/logger';
import { allIndexQueries } from './schema/indexes';

async function runMigrations() {
  try {
    dbLogger.info('Starting database migrations...');
    
    // Run Drizzle migrations
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    dbLogger.info('Drizzle migrations completed successfully');
    
    // Create additional indexes that Drizzle doesn't support yet
    dbLogger.info('Creating additional indexes...');
    for (const query of allIndexQueries) {
      try {
        await sql.unsafe(query);
        dbLogger.debug('Index created successfully', { query });
      } catch (error) {
        dbLogger.warn('Index creation failed (may already exist)', { query, error });
      }
    }
    
    dbLogger.info('All migrations and indexes completed successfully');
  } catch (error) {
    dbLogger.error('Migration failed', { error });
    throw error;
  } finally {
    await closeConnection();
  }
}

// Allow running migrations directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ Database migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default runMigrations;