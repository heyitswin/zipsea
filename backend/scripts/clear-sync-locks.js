const { Client } = require('pg');
require('dotenv').config();

async function clearSyncLocks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current locks
    const currentLocks = await client.query(`
      SELECT * FROM sync_locks WHERE is_active = true
    `);

    console.log('\nActive locks found:', currentLocks.rows.length);
    currentLocks.rows.forEach(lock => {
      const age = Date.now() - new Date(lock.acquired_at).getTime();
      const ageMinutes = Math.floor(age / 60000);
      console.log(`- Lock ${lock.id}: ${lock.lock_key}, acquired ${ageMinutes} minutes ago`);
    });

    // Clear all active locks
    const result = await client.query(`
      UPDATE sync_locks
      SET is_active = false, released_at = NOW()
      WHERE is_active = true
      RETURNING *
    `);

    console.log(`\nCleared ${result.rowCount} active locks`);

    // Verify no active locks remain
    const remaining = await client.query(`
      SELECT COUNT(*) as count FROM sync_locks WHERE is_active = true
    `);

    console.log(`Remaining active locks: ${remaining.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

clearSyncLocks();
