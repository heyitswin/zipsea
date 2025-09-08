#!/usr/bin/env node
/**
 * Real-time webhook monitoring tool
 * Shows live progress of webhook processing
 */

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING;
const REFRESH_INTERVAL = 2000; // Update every 2 seconds

let dbPool;

/**
 * Initialize database
 */
async function initDatabase() {
  if (!DATABASE_URL) {
    console.log('⚠️  No database URL - will only show API diagnostics');
    return false;
  }

  try {
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });
    await dbPool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Get current processing status
 */
async function getProcessingStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    activeLocks: 0,
    ftpStatus: 'unknown',
    recentUpdates: [],
    redisStatus: 'unknown'
  };

  // Get API diagnostics
  try {
    const response = await axios.get(`${API_URL}/api/webhooks/traveltek/diagnostics`, {
      timeout: 5000
    });

    if (response.data.diagnostics) {
      const diag = response.data.diagnostics;
      status.activeLocks = diag.activeLocks || 0;
      status.ftpStatus = diag.ftpConnection || 'unknown';
      status.redisStatus = diag.redisStatus || 'unknown';
      status.recentProcessing = diag.recentProcessing || [];
    }
  } catch (error) {
    // Ignore errors
  }

  // Get database stats if connected
  if (dbPool) {
    try {
      const result = await dbPool.query(`
        SELECT
          cl.id as line_id,
          cl.name as line_name,
          COUNT(*) as updated_count,
          MAX(c.last_traveltek_update) as last_update
        FROM cruises c
        JOIN cruise_lines cl ON cl.id = c.cruise_line_id
        WHERE c.last_traveltek_update > NOW() - INTERVAL '10 minutes'
        GROUP BY cl.id, cl.name
        ORDER BY last_update DESC
        LIMIT 5
      `);

      status.recentUpdates = result.rows.map(row => ({
        lineId: row.line_id,
        lineName: row.line_name,
        updatedCount: parseInt(row.updated_count),
        lastUpdate: row.last_update
      }));
    } catch (error) {
      // Ignore database errors
    }
  }

  return status;
}

/**
 * Clear console and display status
 */
function displayStatus(status) {
  console.clear();
  console.log('🔄 WEBHOOK PROCESSING MONITOR');
  console.log('==============================');
  console.log(`Time: ${status.timestamp}`);
  console.log('');

  // System status
  console.log('📊 System Status:');
  console.log(`   Redis: ${status.redisStatus}`);
  console.log(`   FTP: ${status.ftpStatus}`);
  console.log(`   Active Locks: ${status.activeLocks}`);
  console.log('');

  // Recent updates
  if (status.recentUpdates.length > 0) {
    console.log('📈 Recent Updates (last 10 min):');
    status.recentUpdates.forEach(update => {
      const timeAgo = getTimeAgo(update.lastUpdate);
      console.log(`   ${update.lineName}: ${update.updatedCount} cruises (${timeAgo})`);
    });
  } else {
    console.log('📈 No recent updates in the last 10 minutes');
  }

  console.log('');
  console.log('Press Ctrl+C to exit');
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(date) {
  if (!date) return 'never';

  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Start monitoring
 */
async function startMonitoring() {
  console.log('🚀 Starting webhook monitor...');

  // Initialize database
  await initDatabase();

  // Start monitoring loop
  setInterval(async () => {
    const status = await getProcessingStatus();
    displayStatus(status);
  }, REFRESH_INTERVAL);

  // Initial display
  const status = await getProcessingStatus();
  displayStatus(status);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Stopping monitor...');
  if (dbPool) {
    await dbPool.end();
  }
  process.exit(0);
});

// Start monitoring
startMonitoring().catch(console.error);
