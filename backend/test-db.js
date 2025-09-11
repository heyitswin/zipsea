const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  idle_timeout: 0,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    console.log('Testing database connection...');
    console.time('Simple query');
    const result = await sql`SELECT 1 as test`;
    console.timeEnd('Simple query');
    console.log('Simple query result:', result);

    console.time('Count query');
    const count = await sql`SELECT COUNT(*) FROM cruises`;
    console.timeEnd('Count query');
    console.log('Total cruises:', count);

    console.time('Limited query');
    const cruises = await sql`SELECT id, name FROM cruises LIMIT 5`;
    console.timeEnd('Limited query');
    console.log('Sample cruises:', cruises);

    console.time('Active cruises count');
    const active = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE is_active = true
      AND sailing_date >= CURRENT_DATE
      LIMIT 1
    `;
    console.timeEnd('Active cruises count');
    console.log('Active future cruises:', active);

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

test();
