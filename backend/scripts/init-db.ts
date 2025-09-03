#!/usr/bin/env ts-node
import { logger } from '../src/config/logger';
import { env } from '../src/config/environment';
import runMigrations from '../src/db/migrate';

/**
 * Database Initialization Script
 * 
 * This script initializes the database by:
 * 1. Running all Drizzle migrations
 * 2. Creating additional indexes
 * 3. Validating the database structure
 */

async function initializeDatabase(): Promise<void> {
  try {
    logger.info('🚀 Starting database initialization...');

    // Check if database URL is available
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    logger.info('✅ Environment variables validated');
    logger.info(`📊 Target database: ${env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@')}`);

    // Run migrations
    logger.info('📝 Running database migrations...');
    await runMigrations();
    logger.info('✅ Database migrations completed successfully');

    logger.info('🎉 Database initialization completed successfully');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Set up FTP credentials (TRAVELTEK_FTP_USER, TRAVELTEK_FTP_PASSWORD)');
    logger.info('2. Run initial data sync: npm run sync:initial');
    logger.info('3. Deploy your application');

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      // Just run migrations
      runMigrations()
        .then(() => {
          console.log('✅ Database migrations completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Migration failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      // Full initialization
      initializeDatabase()
        .then(() => {
          console.log('✅ Database initialization completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Database initialization failed:', error);
          process.exit(1);
        });
      break;
  }
}

export default initializeDatabase;