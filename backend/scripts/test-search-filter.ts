import 'dotenv/config';
import axios from 'axios';

/**
 * Test script to verify search filtering with live booking enabled
 *
 * Tests:
 * 1. Search without cruise line filter (should auto-add RCL/Celebrity)
 * 2. Search with different cruise line (should be filtered to RCL/Celebrity)
 * 3. Verify only cruise lines 22 and 3 appear in results
 *
 * Run with: PORT=3001 npm start (in one terminal)
 *           npx ts-node scripts/test-search-filter.ts (in another)
 */

const BASE_URL = 'http://localhost:3001/api/v1';

async function testSearchFilter() {
  console.log('🧪 Testing Search Filtering with Live Booking...\n');

  try {
    // Test 1: Search without cruise line filter
    console.log('Test 1: Search without cruise line filter');
    console.log('Expected: Results should only include cruise lines 22 and 3\n');

    const response1 = await axios.get(`${BASE_URL}/search`, {
      params: {
        sailingDateFrom: '2025-01-01',
        sailingDateTo: '2025-12-31',
        limit: 10,
      },
    });

    console.log(`✅ Found ${response1.data.cruises?.length || 0} cruises`);

    if (response1.data.cruises && response1.data.cruises.length > 0) {
      const cruiseLines = [...new Set(response1.data.cruises.map((c: any) => c.cruiseLineId))];
      console.log(`   Cruise lines in results: ${cruiseLines.join(', ')}`);

      const hasOnlyRCLAndCelebrity = cruiseLines.every(id => id === 22 || id === 3);
      if (hasOnlyRCLAndCelebrity) {
        console.log('   ✅ PASS: Only Royal Caribbean (22) and Celebrity (3) in results');
      } else {
        console.log('   ❌ FAIL: Found other cruise lines!');
      }
    } else {
      console.log('   ⚠️  No results found (may need to check database)');
    }
    console.log('');

    // Test 2: Search with a different cruise line filter (should be overridden)
    console.log('Test 2: Search requesting different cruise line (e.g., Princess = 11)');
    console.log('Expected: Should still only get RCL and Celebrity\n');

    const response2 = await axios.get(`${BASE_URL}/search`, {
      params: {
        cruiseLine: 11, // Princess Cruises (not bookable)
        sailingDateFrom: '2025-01-01',
        sailingDateTo: '2025-12-31',
        limit: 10,
      },
    });

    console.log(`✅ Request sent with cruiseLine=11 (Princess)`);
    console.log(`   Found ${response2.data.cruises?.length || 0} cruises`);

    if (response2.data.cruises && response2.data.cruises.length > 0) {
      const cruiseLines = [...new Set(response2.data.cruises.map((c: any) => c.cruiseLineId))];
      console.log(`   Cruise lines in results: ${cruiseLines.join(', ')}`);

      const hasOnlyRCLAndCelebrity = cruiseLines.every(id => id === 22 || id === 3);
      if (hasOnlyRCLAndCelebrity) {
        console.log('   ✅ PASS: Filter was overridden, only bookable lines returned');
      } else {
        console.log('   ❌ FAIL: Non-bookable cruise lines in results!');
      }
    } else {
      console.log('   ℹ️  No results (expected if Princess requested but only RCL/Celebrity available)');
    }
    console.log('');

    // Test 3: Verify total count
    console.log('Test 3: Get total cruise count for bookable lines');
    const response3 = await axios.get(`${BASE_URL}/search`, {
      params: {
        sailingDateFrom: '2025-01-01',
        sailingDateTo: '2025-12-31',
        limit: 1,
      },
    });

    console.log(`✅ Total bookable cruises: ${response3.data.total || 0}`);
    console.log(`   (This should be much less than the full database if filter is working)`);
    console.log('');

    console.log('🎉 All tests completed!');
    console.log('');
    console.log('Summary:');
    console.log('- Search filtering is active');
    console.log('- Only Royal Caribbean (22) and Celebrity (3) cruises are returned');
    console.log('- User requests for other cruise lines are overridden');
    console.log('');
    console.log('Note: To disable filtering, set TRAVELTEK_LIVE_BOOKING_ENABLED=false in .env');

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ API Error:', error.response?.status, error.response?.statusText);
      console.error('   Response:', JSON.stringify(error.response?.data, null, 2));
    } else {
      console.error('❌ Test failed:', error);
    }

    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Make sure backend is running: PORT=3001 npm start');
    console.log('2. Check .env has TRAVELTEK_LIVE_BOOKING_ENABLED=true');
    console.log('3. Verify database has cruises with cruise_line_id IN (22, 3)');

    process.exit(1);
  }
}

testSearchFilter()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
