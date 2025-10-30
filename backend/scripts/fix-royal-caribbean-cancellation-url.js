/**
 * Fix Royal Caribbean cancellation policy URL
 * Updates from incorrect URL to correct official FAQ page
 */

const { drizzle } = require('drizzle-orm/node-postgres');
const { eq } = require('drizzle-orm');
const { Pool } = require('pg');
const { cruiseLines } = require('../src/db/schema/cruise-lines');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log('🔧 Fixing Royal Caribbean cancellation policy URL...');

  // Royal Caribbean is cruise line ID 22
  const result = await db
    .update(cruiseLines)
    .set({
      cancellationPolicyUrl: 'https://www.royalcaribbean.com/faq/questions/booking-cancellation-refund-policy',
    })
    .where(eq(cruiseLines.id, 22))
    .returning();

  if (result.length > 0) {
    console.log('✅ Updated Royal Caribbean cancellation URL:', result[0]);
  } else {
    console.log('⚠️  No rows updated - Royal Caribbean may not exist as ID 22');
  }

  await pool.end();
  console.log('✅ Done!');
}

main().catch(console.error);
