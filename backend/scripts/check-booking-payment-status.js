const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');
const { bookings, traveltekSessions } = require('../dist/db/schema');
const { eq } = require('drizzle-orm');

async function checkBookingPaymentStatus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const db = drizzle(client);

    // Find the booking by Traveltek booking ID
    const traveltekBookingId = '14396859';
    console.log(`\n🔍 Looking up booking ${traveltekBookingId}...\n`);

    const booking = await db
      .select()
      .from(bookings)
      .where(eq(bookings.traveltekBookingId, traveltekBookingId))
      .limit(1);

    if (booking.length === 0) {
      console.log('❌ Booking not found in database');
      return;
    }

    const bookingData = booking[0];
    console.log('✅ Booking found:');
    console.log('  - Our Booking ID:', bookingData.id);
    console.log('  - Traveltek Booking ID:', bookingData.traveltekBookingId);
    console.log('  - Session ID:', bookingData.sessionId);
    console.log('  - Created At:', bookingData.createdAt);
    console.log('  - Status:', bookingData.status);
    console.log('  - Payment Status:', bookingData.paymentStatus);
    console.log('  - Payment Method:', bookingData.paymentMethod);

    // Check booking details JSON
    console.log('\n💰 Payment Info from stored booking details:');
    const details = bookingData.bookingDetails;
    if (details && details.bookingdetails) {
      const bd = details.bookingdetails;
      console.log('  - Status:', bd.status || 'N/A');
      console.log('  - Total Due:', bd.totaldue || 0);
      console.log('  - Total Paid:', bd.totalpaid || 0);
      console.log('  - Outstanding:', bd.outstanding || 0);
      console.log('  - Handoff Status:', bd.handoffstatus || 'N/A');

      if (bd.transactions && bd.transactions.length > 0) {
        console.log('\n  📝 Transactions:');
        bd.transactions.forEach((tx, idx) => {
          console.log(`\n    Transaction ${idx + 1}:`);
          console.log('    Full details:', JSON.stringify(tx, null, 2));
        });
      } else {
        console.log('\n  ⚠️  No transactions found');
      }

      if (bd.paymentschedule && bd.paymentschedule.length > 0) {
        console.log('\n  📅 Payment Schedule:');
        bd.paymentschedule.forEach((ps, idx) => {
          console.log(`    ${idx + 1}.`, {
            amount: ps.amount,
            duedate: ps.duedate,
            completed: ps.completed,
            type: ps.type,
          });
        });
      }
    } else {
      console.log('  ⚠️  No booking details found in stored data');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

checkBookingPaymentStatus();
