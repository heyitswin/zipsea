import 'dotenv/config';
import { traveltekApiService } from '../src/services/traveltek-api.service';
import logger from '../src/config/logger';

/**
 * Test script to verify Traveltek API connection
 *
 * Tests:
 * 1. OAuth token acquisition
 * 2. Session creation
 * 3. Basic API call (search or get cabin grades)
 *
 * Run with: npx ts-node scripts/test-traveltek-api.ts
 */

async function testTraveltekAPI() {
  console.log('🧪 Testing Traveltek API Connection...\n');

  try {
    // Test 1: Get OAuth token
    console.log('Test 1: Acquiring OAuth token...');
    const token = await (traveltekApiService as any).getAccessToken();
    console.log('✅ OAuth token acquired successfully');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log('');

    // Test 2: Create session
    console.log('Test 2: Creating Traveltek session...');
    const session = await traveltekApiService.createSession();

    if (session.sessionkey && session.sid) {
      console.log('✅ Session created successfully');
      console.log(`   Session Key: ${session.sessionkey.substring(0, 20)}...`);
      console.log(`   SID: ${session.sid.substring(0, 20)}...`);
      console.log('');

      // Test 3: Try to get cabin grades for a test cruise
      // Using a known Royal Caribbean cruise from our database
      console.log('Test 3: Getting cabin grades for a test cruise...');
      console.log("   Note: This may fail if we don't have the right codetocruiseid");
      console.log("   That's okay - we just need to verify API connectivity");

      try {
        // Example: Use a placeholder cruise ID - replace with actual one from your DB
        const testCruiseId = '12345'; // Replace with actual codetocruiseid from staging DB

        const cabinGrades = await traveltekApiService.getCabinGrades({
          sessionkey: session.sessionkey,
          codetocruiseid: testCruiseId,
          adults: 2,
          children: 0,
        });

        console.log('✅ Cabin grades retrieved successfully');
        console.log('   Response structure:', Object.keys(cabinGrades).slice(0, 5));
      } catch (apiError: any) {
        if (apiError.response) {
          console.log('⚠️  API call failed (expected - need valid cruise ID)');
          console.log(`   Status: ${apiError.response.status}`);
          console.log(`   Error: ${apiError.response.data?.error || 'Unknown error'}`);
          console.log('   This is okay - it proves API connectivity works!');
        } else {
          throw apiError;
        }
      }
    } else {
      throw new Error('Session creation returned invalid data');
    }

    console.log('');
    console.log('🎉 All connectivity tests passed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Find a valid codetocruiseid from staging database');
    console.log('2. Update the test script with that ID');
    console.log('3. Run again to test full cabin pricing flow');
    console.log('');
    console.log('To find a cruise ID, run:');
    console.log(
      '  psql "$DATABASE_URL" -c "SELECT id, name, sailing_date FROM cruises WHERE cruise_line_id IN (22, 3) AND sailing_date > NOW() LIMIT 5;"'
    );
  } catch (error) {
    console.error('❌ Test failed:', error);

    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }

    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Check .env file has correct credentials:');
    console.log('   - TRAVELTEK_API_USERNAME=cruisepassjson');
    console.log('   - TRAVELTEK_API_PASSWORD=cr11fd75');
    console.log('   - TRAVELTEK_API_BASE_URL=https://fusionapi.traveltek.net/2.1/json');
    console.log('2. Check Redis is running (redis-cli ping)');
    console.log('3. Check network connectivity to Traveltek API');

    process.exit(1);
  }
}

// Run the test
testTraveltekAPI()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
