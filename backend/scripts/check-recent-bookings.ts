import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { bookings } from '../src/db/schema';
import { desc } from 'drizzle-orm';

async function checkRecentBookings() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const db = drizzle(client);

  try {
    const recentBookings = await db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(3);

    for (const booking of recentBookings) {
      console.log('\n========================================');
      console.log('Booking ID:', booking.id);
      console.log('Traveltek ID:', booking.traveltekBookingId);
      console.log('Status:', booking.bookingStatus);
      console.log('Payment Status:', booking.paymentStatus);
      console.log('Created At:', booking.createdAt);
      console.log('Total Price:', booking.totalPrice);

      if (booking.bookingDetails) {
        const details = typeof booking.bookingDetails === 'string'
          ? JSON.parse(booking.bookingDetails)
          : booking.bookingDetails;

        console.log('\nTransactions:');
        if (details.transactions && Array.isArray(details.transactions)) {
          for (const tx of details.transactions) {
            console.log('  - Type:', tx.type);
            console.log('    Amount:', tx.amount);
            console.log('    Auth Code:', tx.authcode || '(empty)');
            console.log('    Fraud Category:', tx.fraudcategory);
            console.log('    Status:', tx.status);
          }
        } else {
          console.log('  No transactions found in booking details');
        }

        // Also check if there are any errors
        if (details.errors && Array.isArray(details.errors) && details.errors.length > 0) {
          console.log('\nErrors from Traveltek:');
          console.log(JSON.stringify(details.errors, null, 2));
        }
      }
    }
  } finally {
    await client.end();
  }
}

checkRecentBookings().catch(console.error);
