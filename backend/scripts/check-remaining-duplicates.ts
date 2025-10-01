import { sql } from '../src/db/connection';

async function checkDuplicates() {
  try {
    console.log('Checking for duplicates using the same logic as unique constraint...\n');

    const duplicates = await sql`
      SELECT
        cruise_line_id,
        ship_id,
        sailing_date,
        voyage_code,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id ORDER BY updated_at DESC) as cruise_ids
      FROM cruises
      GROUP BY cruise_line_id, ship_id, sailing_date, COALESCE(voyage_code, '')
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `;

    console.log(`Found ${duplicates.length} duplicate groups\n`);

    if (duplicates.length > 0) {
      console.log('Duplicate groups:');
      duplicates.forEach((dup: any) => {
        console.log(`Line: ${dup.cruise_line_id}, Ship: ${dup.ship_id}, Date: ${dup.sailing_date}, Voyage: ${dup.voyage_code || 'NULL'}`);
        console.log(`  → ${dup.duplicate_count} duplicates: ${dup.cruise_ids}`);
        console.log('');
      });
    }

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
    process.exit(1);
  }
}

checkDuplicates();
