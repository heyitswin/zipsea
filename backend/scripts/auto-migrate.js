#!/usr/bin/env node

/**
 * Automatic migration runner for Render deployments
 * Runs on every build to ensure database is up to date
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  try {
    // First, generate any pending migrations
    console.log('📝 Generating migrations if needed...');
    try {
      const { stdout: genOutput } = await execAsync('npx drizzle-kit generate');
      console.log(genOutput);
    } catch (genError) {
      console.log('No new migrations to generate or already generated');
    }
    
    // Then push schema changes to database
    console.log('\n🚀 Applying migrations to database...');
    const { stdout, stderr } = await execAsync('npx drizzle-kit push');
    
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('Warning')) console.error(stderr);
    
    console.log('\n✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    
    // Don't fail the build if migrations fail (optional)
    // Remove the line below if you want to fail the build on migration errors
    console.log('\n⚠️  Continuing despite migration error (database may need manual update)');
    process.exit(0);
    
    // Uncomment this to fail the build on migration errors:
    // process.exit(1);
  }
}

// Only run if DATABASE_URL is set (i.e., on Render, not during local builds)
if (process.env.DATABASE_URL) {
  runMigrations();
} else {
  console.log('📦 No DATABASE_URL found, skipping migrations (local build)');
  process.exit(0);
}