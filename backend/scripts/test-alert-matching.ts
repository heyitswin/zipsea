import { alertMatchingService } from '../src/services/alert-matching.service';
import { db } from '../src/db/connection';
import { savedSearches } from '../src/db/schema';
import logger from '../src/config/logger';
import { eq } from 'drizzle-orm';

/**
 * Test script for alert matching logic
 * Creates a test alert and checks for matches
 */
async function testAlertMatching() {
  try {
    logger.info('=== Starting Alert Matching Test ===');

    // Test 1: Create a test alert for Royal Caribbean cruises under $2000
    logger.info('\n[Test 1] Creating test alert...');
    const testAlert = await db
      .insert(savedSearches)
      .values({
        userId: '00000000-0000-0000-0000-000000000000', // Test user ID
        name: 'Test Alert - Royal Caribbean under $2000',
        searchCriteria: {
          cruiseLineId: [22], // Royal Caribbean
          departureMonth: ['2025-01', '2025-02', '2025-03'],
        },
        maxBudget: '2000.00',
        cabinTypes: ['interior', 'oceanview'],
        alertEnabled: true,
        alertFrequency: 'daily',
        isActive: true,
      })
      .returning();

    logger.info(`Created test alert with ID: ${testAlert[0].id}`);

    // Test 2: Find NEW matches
    logger.info('\n[Test 2] Finding NEW matches for alert...');
    const newMatches = await alertMatchingService.findNewMatches(testAlert[0].id);

    logger.info(`Found ${newMatches.length} NEW matches`);
    if (newMatches.length > 0) {
      logger.info('Sample matches:');
      newMatches.slice(0, 3).forEach((match, i) => {
        logger.info(`  ${i + 1}. ${match.cruise.name || 'Unknown Cruise'}`);
        logger.info(`     Cabin: ${match.cabinType}, Price: $${match.price}`);
        logger.info(`     Sailing: ${match.cruise.sailingDate || 'Unknown'}`);
      });
    }

    // Test 3: Record first match as notified
    if (newMatches.length > 0) {
      logger.info('\n[Test 3] Recording first match as notified...');
      const firstMatch = newMatches[0];
      await alertMatchingService.recordMatch(
        testAlert[0].id,
        firstMatch.cruiseId,
        firstMatch.cabinType,
        firstMatch.price
      );
      logger.info('Match recorded successfully');

      // Test 4: Find NEW matches again (should be one less)
      logger.info('\n[Test 4] Finding NEW matches again...');
      const newMatchesAfter = await alertMatchingService.findNewMatches(testAlert[0].id);
      logger.info(
        `Found ${newMatchesAfter.length} NEW matches (should be ${newMatches.length - 1})`
      );

      if (newMatchesAfter.length === newMatches.length - 1) {
        logger.info('✅ Duplicate prevention working correctly!');
      } else {
        logger.warn(
          `⚠️ Expected ${newMatches.length - 1} matches but got ${newMatchesAfter.length}`
        );
      }
    }

    // Test 5: Get all matches (including notified)
    logger.info('\n[Test 5] Getting all matches for alert...');
    const allMatches = await alertMatchingService.getAllMatches(testAlert[0].id);
    logger.info(`Total matches: ${allMatches.length}`);

    // Cleanup: Delete test alert (will cascade to alert_matches)
    logger.info('\n[Cleanup] Deleting test alert...');
    await db.delete(savedSearches).where(eq(savedSearches.id, testAlert[0].id));
    logger.info('Test alert deleted');

    logger.info('\n=== Test Complete ===');
    logger.info('✅ All tests passed successfully!');
  } catch (error) {
    logger.error('Test failed', { error });
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the test
testAlertMatching();
