#!/usr/bin/env npx tsx

/**
 * Database Connection Test Script
 * 
 * This script tests the database connection and identifies connection issues
 * that are preventing webhook processing.
 */

import { sql } from 'drizzle-orm';
import { db } from '../src/db/connection';
import { logger } from '../src/config/logger';

interface TestResult {
  test: string;
  passed: boolean;
  details: any;
  duration: number;
}

class DatabaseConnectionTester {
  private results: TestResult[] = [];

  async runTests(): Promise<void> {
    console.log('🧪 Database Connection Test');
    console.log('============================');
    console.log('Testing database connectivity for webhook processing\n');

    try {
      // Test 1: Basic connection test
      await this.testBasicConnection();
      
      // Test 2: Simple query test
      await this.testSimpleQuery();
      
      // Test 3: Cruise info query test (what webhook uses)
      await this.testCruiseInfoQuery();
      
      // Test 4: Timeout test
      await this.testQueryTimeout();
      
      // Print summary
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test 1: Basic database connection
   */
  private async testBasicConnection(): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 TEST 1: Basic Database Connection');
    console.log('-----------------------------------');

    try {
      const result = await db.execute(sql`SELECT NOW() as current_time`);
      
      console.log('✅ Database connection successful');
      console.log(`   Current time: ${result[0]?.current_time}`);

      this.results.push({
        test: 'Basic Database Connection',
        passed: true,
        details: { currentTime: result[0]?.current_time },
        duration: Date.now() - startTime
      });

      console.log('✅ TEST 1: PASSED\n');

    } catch (error) {
      console.error('❌ Database connection failed:', error);
      this.results.push({
        test: 'Basic Database Connection',
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
        },
        duration: Date.now() - startTime
      });
      console.log('❌ TEST 1: FAILED\n');
    }
  }

  /**
   * Test 2: Simple query test
   */
  private async testSimpleQuery(): Promise<void> {
    const startTime = Date.now();
    console.log('📋 TEST 2: Simple Query Test');
    console.log('----------------------------');

    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_cruises,
          COUNT(DISTINCT cruise_line_id) as total_lines
        FROM cruises 
        WHERE is_active = true
      `);
      
      console.log('✅ Simple query successful');
      console.log(`   Total active cruises: ${result[0]?.total_cruises}`);
      console.log(`   Total cruise lines: ${result[0]?.total_lines}`);

      this.results.push({
        test: 'Simple Query Test',
        passed: true,
        details: { 
          totalCruises: result[0]?.total_cruises,
          totalLines: result[0]?.total_lines
        },
        duration: Date.now() - startTime
      });

      console.log('✅ TEST 2: PASSED\n');

    } catch (error) {
      console.error('❌ Simple query failed:', error);
      this.results.push({
        test: 'Simple Query Test',
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
        },
        duration: Date.now() - startTime
      });
      console.log('❌ TEST 2: FAILED\n');
    }
  }

  /**
   * Test 3: Cruise info query (what webhook actually uses)
   */
  private async testCruiseInfoQuery(): Promise<void> {
    const startTime = Date.now();
    console.log('🚢 TEST 3: Cruise Info Query (Webhook Query)');
    console.log('---------------------------------------------');

    try {
      // Test Royal Caribbean (line 22)
      const lineId = 22;
      const limit = 10;
      
      const result = await db.execute(sql`
        SELECT 
          c.id,
          c.cruise_id as cruiseCode,
          COALESCE(s.name, 'Unknown_Ship') as shipName,
          c.sailing_date as sailingDate
        FROM cruises c
        LEFT JOIN ships s ON s.id = c.ship_id
        WHERE c.cruise_line_id = ${lineId}
          AND c.sailing_date >= CURRENT_DATE 
          AND c.sailing_date <= CURRENT_DATE + INTERVAL '2 years'
          AND c.is_active = true
        ORDER BY c.sailing_date ASC
        LIMIT ${limit}
      `);
      
      console.log('✅ Cruise info query successful');
      console.log(`   Line ID: ${lineId} (Royal Caribbean)`);
      console.log(`   Results found: ${result.length}`);
      
      if (result.length > 0) {
        console.log(`   Sample results:`);
        result.slice(0, 3).forEach((cruise, index) => {
          console.log(`     ${index + 1}. Cruise ${cruise.id} - ${cruise.shipName} - ${cruise.sailingDate}`);
        });
      }

      this.results.push({
        test: 'Cruise Info Query',
        passed: true,
        details: { 
          lineId,
          resultCount: result.length,
          sampleResults: result.slice(0, 3)
        },
        duration: Date.now() - startTime
      });

      console.log('✅ TEST 3: PASSED\n');

    } catch (error) {
      console.error('❌ Cruise info query failed:', error);
      this.results.push({
        test: 'Cruise Info Query',
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
        },
        duration: Date.now() - startTime
      });
      console.log('❌ TEST 3: FAILED\n');
    }
  }

  /**
   * Test 4: Timeout test
   */
  private async testQueryTimeout(): Promise<void> {
    const startTime = Date.now();
    console.log('⏱️ TEST 4: Query Timeout Test');
    console.log('-----------------------------');

    try {
      const timeoutMs = 10000; // 10 seconds
      
      // Create a timeout wrapper
      const queryPromise = db.execute(sql`
        SELECT COUNT(*) as count FROM cruises WHERE is_active = true
      `);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      console.log('✅ Query completed within timeout');
      console.log(`   Result: ${result[0]?.count} active cruises`);
      console.log(`   Duration: ${Date.now() - startTime}ms`);

      this.results.push({
        test: 'Query Timeout Test',
        passed: true,
        details: { 
          result: result[0]?.count,
          timeoutMs,
          actualDuration: Date.now() - startTime
        },
        duration: Date.now() - startTime
      });

      console.log('✅ TEST 4: PASSED\n');

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Query timeout test failed after ${duration}ms:`, error);
      
      this.results.push({
        test: 'Query Timeout Test',
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : String(error),
          actualDuration: duration
        },
        duration
      });
      console.log('❌ TEST 4: FAILED\n');
    }
  }

  /**
   * Print comprehensive test summary
   */
  private printSummary(): void {
    console.log('='.repeat(60));
    console.log('📊 DATABASE CONNECTION TEST SUMMARY');
    console.log('='.repeat(60));

    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const overallSuccess = passedTests === totalTests;

    console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    console.log(`\n📋 Test Results:`);
    this.results.forEach((result, index) => {
      const duration = Math.round(result.duration);
      console.log(`   ${index + 1}. ${result.test}: ${result.passed ? '✅ PASS' : '❌ FAIL'} (${duration}ms)`);
    });

    console.log(`\n🔍 Analysis:`);
    
    if (!overallSuccess) {
      const failedTests = this.results.filter(r => !r.passed);
      console.log(`\n❌ Issues Found:`);
      
      failedTests.forEach(test => {
        console.log(`   • ${test.test}: ${test.details.error}`);
        
        if (test.details.error?.includes('ENOTFOUND')) {
          console.log(`     → DNS resolution failure - check network connectivity`);
        } else if (test.details.error?.includes('CONNECT_TIMEOUT')) {
          console.log(`     → Connection timeout - check database accessibility`);
        } else if (test.details.error?.includes('timeout')) {
          console.log(`     → Query timeout - database may be overloaded`);
        }
      });
      
      console.log(`\n💡 Recommendations:`);
      console.log(`   1. Check network connectivity to database server`);
      console.log(`   2. Verify DATABASE_URL configuration`);
      console.log(`   3. Check if database server is accessible from current environment`);
      console.log(`   4. Consider using local database for development`);
      console.log(`   5. Check database server load and connection limits`);
      
    } else {
      console.log(`   ✅ Database connectivity is working properly`);
      console.log(`   ✅ All webhook database queries should succeed`);
      console.log(`   ✅ No connection timeout issues detected`);
    }

    console.log(`\n📅 Test completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
  }
}

// Run the test suite
async function main() {
  const tester = new DatabaseConnectionTester();
  await tester.runTests();
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { DatabaseConnectionTester };