/**
 * Test script to check per-passenger pricing breakdown
 *
 * Cruise: Grandeur of the Seas - November 1, 2026
 * Cruise ID: 2259949
 * Passengers: 2 adults + 2 children (both age 8)
 * Cabin: Z1 (Interior)
 */

require('dotenv').config();
const { traveltekApiService } = require('./dist/services/traveltek-api.service');
const { db } = require('./dist/db/connection');
const { cruises } = require('./dist/db/schema');
const { eq } = require('drizzle-orm');

async function testPassengerBreakdown() {
  try {
    console.log('🧪 Testing per-passenger pricing breakdown\n');
    console.log('='.repeat(60));

    // Step 1: Get cruise data from database
    console.log('\n📊 Step 1: Fetching cruise data from database...');
    const cruiseId = '2259949';
    const [cruise] = await db.select().from(cruises).where(eq(cruises.id, cruiseId)).limit(1);

    if (!cruise) {
      throw new Error(`Cruise ${cruiseId} not found in database`);
    }

    console.log(`✅ Found cruise: ${cruise.id} - ${cruise.sailingDate}`);
    console.log(`   Ship ID: ${cruise.shipId}`);
    console.log(`   Code to Cruise ID: ${cruise.codetocruiseid || 'N/A'}`);

    // Step 2: Create a session with 2 adults + 2 children (age 8)
    console.log('\n📊 Step 2: Creating Traveltek session...');
    const targetDate = new Date(cruise.sailingDate);
    const sessionData = await traveltekApiService.createSession(
      targetDate,
      2, // adults
      2, // children
      [8, 8] // child ages
    );

    console.log(`✅ Session created:`);
    console.log(`   Session Key: ${sessionData.sessionkey}`);
    console.log(`   SID: ${sessionData.sid}`);

    // Step 3: Get cabin grades (live pricing)
    console.log('\n📊 Step 3: Getting cabin grades with live pricing...');

    // Calculate child DOBs (8 years old)
    const today = new Date();
    const childDob = new Date(today.getFullYear() - 8, today.getMonth(), today.getDate());
    const childDobString = childDob.toISOString().split('T')[0];

    const cabinGradesResponse = await traveltekApiService.getCabinGrades({
      sessionkey: sessionData.sessionkey,
      sid: sessionData.sid,
      codetocruiseid: cruise.codetocruiseid,
      adults: 2,
      children: 2,
      childDobs: [childDobString, childDobString],
    });

    if (!cabinGradesResponse.results || cabinGradesResponse.results.length === 0) {
      console.error('❌ No cabin grades returned');
      console.log('Full response:', JSON.stringify(cabinGradesResponse, null, 2));
      return;
    }

    console.log(`✅ Found ${cabinGradesResponse.results.length} cabin grades`);

    // Find Z1 cabin (Interior)
    const z1Cabin = cabinGradesResponse.results.find(
      cabin =>
        cabin.gradename === 'Z1' || cabin.gradecode === 'Z1' || cabin.description?.includes('Z1')
    );

    if (!z1Cabin) {
      console.log('\n⚠️  Z1 cabin not found. Available cabins:');
      cabinGradesResponse.results.slice(0, 10).forEach(cabin => {
        console.log(
          `   - ${cabin.gradename || cabin.gradecode}: ${cabin.description} - $${cabin.total || cabin.price}`
        );
      });
      return;
    }

    console.log(`\n✅ Found Z1 cabin:`);
    console.log(`   Grade Name: ${z1Cabin.gradename}`);
    console.log(`   Description: ${z1Cabin.description}`);
    console.log(`   Total Price: $${z1Cabin.total || z1Cabin.price}`);
    console.log(`   Result No: ${z1Cabin.resultno}`);
    console.log(`   Grade No: ${z1Cabin.gradeno}`);
    console.log(`   Rate Code: ${z1Cabin.ratecode || 'N/A'}`);

    // Step 4: Get detailed pricing breakdown
    console.log('\n📊 Step 4: Getting detailed per-passenger breakdown...');
    console.log('='.repeat(60));

    const breakdown = await traveltekApiService.getCabinGradeBreakdown({
      sessionkey: sessionData.sessionkey,
      chosencruise: z1Cabin.resultno,
      chosencabingrade: z1Cabin.gradeno,
      chosenfarecode: z1Cabin.ratecode || '',
      cid: cruise.codetocruiseid,
    });

    if (!breakdown.results || breakdown.results.length === 0) {
      console.error('❌ No breakdown results returned');
      console.log('Full response:', JSON.stringify(breakdown, null, 2));
      return;
    }

    console.log(`\n✅ Received ${breakdown.results.length} cost categories\n`);

    // Display breakdown by category
    let grandTotal = 0;

    breakdown.results.forEach((item, index) => {
      console.log(`\n📋 Category ${index + 1}: ${item.description || item.category}`);
      console.log(`   Category Code: ${item.category}`);
      console.log(`   Commissionable: ${item.commissionable === 1 ? 'Yes ✅' : 'No'}`);

      if (item.prices && Array.isArray(item.prices) && item.prices.length > 0) {
        console.log(`   Number of Passengers: ${item.prices.length}`);
        console.log(`   Per-Passenger Breakdown:`);

        let categoryTotal = 0;
        item.prices.forEach((priceItem, paxIndex) => {
          const price = parseFloat(priceItem.sprice || priceItem.price || 0);
          categoryTotal += price;

          // Try to determine passenger type
          let paxType = 'Unknown';
          if (paxIndex < 2) {
            paxType = 'Adult';
          } else {
            paxType = 'Child (age 8)';
          }

          console.log(`      Passenger ${paxIndex + 1} (${paxType}): $${price.toFixed(2)}`);

          // Log additional fields if available
          if (priceItem.description && priceItem.description !== item.description) {
            console.log(`         └─ ${priceItem.description}`);
          }
        });

        console.log(`   Category Total: $${categoryTotal.toFixed(2)}`);
        grandTotal += categoryTotal;
      } else {
        console.log(`   Total: $${item.total || item.price || 0}`);
        grandTotal += parseFloat(item.total || item.price || 0);
      }

      console.log('   ' + '-'.repeat(55));
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`💰 GRAND TOTAL: $${grandTotal.toFixed(2)}`);
    console.log(`${'='.repeat(60)}\n`);

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Cruise: Grandeur of the Seas - ${cruise.sailingDate}`);
    console.log(`   Cabin: Z1 (Interior)`);
    console.log(`   Passengers: 2 adults + 2 children (age 8)`);
    console.log(`   Total Price: $${grandTotal.toFixed(2)}`);

    // Find commissionable fare for OBC calculation
    const fareItem = breakdown.results.find(item => item.commissionable === 1);
    if (fareItem && fareItem.prices) {
      const commissionableFare = fareItem.prices.reduce(
        (sum, p) => sum + parseFloat(p.sprice || p.price || 0),
        0
      );
      const obc = Math.floor((commissionableFare * 0.1) / 10) * 10;
      console.log(`   Commissionable Fare: $${commissionableFare.toFixed(2)}`);
      console.log(`   OBC (10%): $${obc}`);
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.response) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    process.exit(0);
  }
}

// Run test
testPassengerBreakdown();
