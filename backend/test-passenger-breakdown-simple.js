/**
 * Simplified test for per-passenger pricing breakdown
 *
 * Search for a Royal Caribbean cruise and get pricing breakdown
 * for 2 adults + 2 children (both age 8)
 */

require('dotenv').config();
const { traveltekApiService } = require('./dist/services/traveltek-api.service');

async function testPassengerBreakdown() {
  try {
    console.log('🧪 Testing per-passenger pricing breakdown\n');
    console.log('='.repeat(60));

    // Step 1: Search for Royal Caribbean cruises in November 2026
    console.log('\n📊 Step 1: Searching for cruises...');
    const today = new Date();
    const sixMonthsLater = new Date(today);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    console.log(
      `   Searching from ${today.toISOString().split('T')[0]} to ${sixMonthsLater.toISOString().split('T')[0]}`
    );

    const searchResponse = await traveltekApiService.searchCruises({
      startdate: today.toISOString().split('T')[0],
      enddate: sixMonthsLater.toISOString().split('T')[0],
      lineid: '22', // Royal Caribbean
      adults: 2,
      children: 2,
      currency: 'USD',
    });

    if (!searchResponse.results || searchResponse.results.length === 0) {
      console.error('❌ No cruises found');
      return;
    }

    const cruise = searchResponse.results[0];
    console.log(`✅ Found cruise: ${cruise.name}`);
    console.log(`   Sailing Date: ${cruise.saildate || cruise.startdate}`);
    console.log(`   Code to Cruise ID: ${cruise.codetocruiseid}`);
    console.log(`   Session Key: ${searchResponse.meta.criteria.sessionkey}`);

    // Step 2: Get cabin grades with live pricing
    console.log('\n📊 Step 2: Getting cabin grades...');

    // Calculate child DOBs (8 years old)
    const now = new Date();
    const childDob = new Date(now.getFullYear() - 8, now.getMonth(), now.getDate());
    const childDobString = childDob.toISOString().split('T')[0];

    const cabinGradesResponse = await traveltekApiService.getCabinGrades({
      sessionkey: searchResponse.meta.criteria.sessionkey,
      sid: searchResponse.meta.criteria.sid || 'default',
      codetocruiseid: cruise.codetocruiseid,
      adults: 2,
      children: 2,
      childDobs: [childDobString, childDobString],
    });

    if (!cabinGradesResponse.results || cabinGradesResponse.results.length === 0) {
      console.error('❌ No cabin grades returned');
      return;
    }

    console.log(`✅ Found ${cabinGradesResponse.results.length} cabin grades`);

    // Find Z1 cabin (Interior)
    const z1Cabin = cabinGradesResponse.results.find(
      cabin =>
        cabin.gradename === 'Z1' ||
        cabin.gradecode === 'Z1' ||
        cabin.description?.includes('Z1') ||
        cabin.description?.includes('Interior')
    );

    if (!z1Cabin) {
      console.log('\n⚠️  Z1 cabin not found. Using first available cabin:');
      const firstCabin = cabinGradesResponse.results[0];
      console.log(
        `   ${firstCabin.gradename}: ${firstCabin.description} - $${firstCabin.total || firstCabin.price}`
      );

      // Use first cabin instead
      await showBreakdown(searchResponse.meta.criteria.sessionkey, firstCabin, cruise);
      return;
    }

    console.log(`\n✅ Found Z1 cabin:`);
    console.log(`   Grade Name: ${z1Cabin.gradename}`);
    console.log(`   Description: ${z1Cabin.description}`);
    console.log(`   Total Price: $${z1Cabin.total || z1Cabin.price}`);

    await showBreakdown(searchResponse.meta.criteria.sessionkey, z1Cabin, cruise);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.response) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    process.exit(0);
  }
}

async function showBreakdown(sessionkey, cabin, cruise) {
  // Step 3: Get detailed pricing breakdown
  console.log('\n📊 Step 3: Getting detailed per-passenger breakdown...');
  console.log('='.repeat(60));

  const breakdown = await traveltekApiService.getCabinGradeBreakdown({
    sessionkey: sessionkey,
    chosencruise: cabin.resultno,
    chosencabingrade: cabin.gradeno,
    chosenfarecode: cabin.ratecode || '',
    cid: cruise.codetocruiseid,
  });

  if (!breakdown.results || breakdown.results.length === 0) {
    console.error('❌ No breakdown results returned');
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
  console.log(`   Cruise: ${cruise.name}`);
  console.log(`   Sailing Date: ${cruise.saildate || cruise.startdate}`);
  console.log(`   Cabin: ${cabin.gradename} - ${cabin.description}`);
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
}

// Run test
testPassengerBreakdown();
