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
    // Check if we're in the right directory
    const { stdout: pwdOutput } = await execAsync('pwd');
    console.log('Current directory:', pwdOutput.trim());
    
    // Install drizzle-orm if needed (it's a dependency but might not be available in build)
    console.log('📦 Ensuring drizzle-orm is available...');
    try {
      await execAsync('npm list drizzle-orm');
    } catch {
      console.log('Installing drizzle-orm for migrations...');
      await execAsync('npm install drizzle-orm');
    }
    
    // Use the compiled JavaScript migration approach instead of drizzle-kit push
    // This is more reliable in production environments
    console.log('\n🚀 Running migrations using migrate function...');
    
    const migrationScript = `
      const { drizzle } = require('drizzle-orm/postgres-js');
      const { migrate } = require('drizzle-orm/postgres-js/migrator');
      const postgres = require('postgres');
      const path = require('path');
      
      const sql = postgres(process.env.DATABASE_URL, { max: 1 });
      const db = drizzle(sql);
      
      migrate(db, { migrationsFolder: path.join(__dirname, '../src/db/migrations') })
        .then(() => {
          console.log('Migrations completed');
          sql.end();
        })
        .catch(err => {
          console.error('Migration error:', err);
          sql.end();
          process.exit(1);
        });
    `;
    
    const { stdout, stderr } = await execAsync(`node -e "${migrationScript}"`);
    
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('Warning')) console.error(stderr);
    
    console.log('\n✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Don't fail the build if migrations fail
    console.log('\n⚠️  Continuing despite migration error (database may need manual update)');
    console.log('You can run migrations manually with: npx drizzle-kit push');
    process.exit(0);
  }
}

// Only run if DATABASE_URL is set (i.e., on Render, not during local builds)
if (process.env.DATABASE_URL) {
  runMigrations();
} else {
  console.log('📦 No DATABASE_URL found, skipping migrations (local build)');
  process.exit(0);
}