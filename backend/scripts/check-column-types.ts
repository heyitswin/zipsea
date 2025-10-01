import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function checkColumnTypes() {
  console.log('Checking column types...\n');

  // Check cheapest_pricing.cruise_id type
  const cheapestPricingType = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'cheapest_pricing' AND column_name = 'cruise_id'
  `);

  console.log('cheapest_pricing.cruise_id:');
  console.log(cheapestPricingType[0]);
  console.log('');

  // Check price_snapshots.cruise_id type
  const priceSnapshotsType = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'price_snapshots' AND column_name = 'cruise_id'
  `);

  console.log('price_snapshots.cruise_id:');
  console.log(priceSnapshotsType[0]);
  console.log('');

  // Check cruises.id type
  const cruisesType = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'cruises' AND column_name = 'id'
  `);

  console.log('cruises.id:');
  console.log(cruisesType[0]);

  await client.end();
}

checkColumnTypes().catch(console.error);
