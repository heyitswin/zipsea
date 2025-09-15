#!/usr/bin/env node

/**
 * Trigger Manual Cleanup via API
 * This script calls an API endpoint to trigger database cleanup
 */

const fetch = require('node-fetch');

async function triggerCleanup() {
  const baseUrl = process.env.API_URL || 'http://localhost:3001';

  console.log('🧹 Triggering manual cleanup via API...');
  console.log(`   Target: ${baseUrl}/api/admin/cleanup`);

  try {
    const response = await fetch(`${baseUrl}/api/admin/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': process.env.ADMIN_KEY || 'emergency-cleanup-2024'
      },
      body: JSON.stringify({
        aggressive: true,
        vacuum: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    console.log('✅ Cleanup triggered successfully!');
    console.log('   Results:', result);

  } catch (error) {
    console.error('❌ Failed to trigger cleanup:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  triggerCleanup().catch(console.error);
}

module.exports = { triggerCleanup };
