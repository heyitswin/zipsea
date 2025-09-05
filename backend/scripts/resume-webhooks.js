#!/usr/bin/env node

/**
 * Resume Webhook Processing
 * Run this after initial FTP sync completes
 * Date: 2025-09-04
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function resumeWebhooks() {
  console.log('▶️ Resuming Webhook Processing');
  console.log('==============================\n');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found');
    process.exit(1);
  }

  const dbClient = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    await dbClient.connect();

    // Remove webhook pause flag
    await dbClient.query(`
      UPDATE system_flags
      SET flag_value = false, updated_at = NOW()
      WHERE flag_name = 'webhooks_paused'
    `);

    console.log('✅ Webhook processing resumed');
    console.log('📋 Webhooks will now process normally');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

if (require.main === module) {
  resumeWebhooks();
}

module.exports = { resumeWebhooks };
