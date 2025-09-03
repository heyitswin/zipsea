#!/usr/bin/env tsx

/**
 * Comprehensive Test Suite for Real-time Webhook Processing System
 * 
 * This script provides various ways to test the new webhook system:
 * 1. Test endpoint simulation
 * 2. Direct webhook calls
 * 3. System status monitoring
 * 4. Performance testing
 */

import axios from 'axios';
import { program } from 'commander';

const API_BASE = process.env.API_BASE || 'https://zipsea-production.onrender.com/api';
const WEBHOOK_BASE = `${API_BASE}/webhooks`;

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp: string;
}

class WebhookSystemTester {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * 1. Test Internal Simulation Endpoint
   */
  async testInternalSimulation(lineId: number): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🧨 Testing internal simulation for line ${lineId}...`);
      
      const response = await axios.post(`${WEBHOOK_BASE}/test-simulate`, {
        lineId: lineId
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: `Internal simulation test successful (${processingTime}ms)`,
        data: {
          ...response.data,
          testType: 'internal_simulation',
          processingTime
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Internal simulation failed: ${error.message}`,
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 2. Test Real Webhook Endpoint (Simulates Traveltek)
   */
  async testRealWebhookEndpoint(lineId: number): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Testing real webhook endpoint for line ${lineId}...`);
      
      // Simulate actual Traveltek webhook payload
      const traveltekPayload = {
        event: 'cruiseline_pricing_updated',
        lineid: lineId,
        marketid: 0,
        currency: 'USD',
        description: `TEST: Real webhook simulation for line ${lineId}`,
        source: 'test_traveltek_simulation',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const response = await axios.post(`${WEBHOOK_BASE}/traveltek/cruiseline-pricing-updated`, traveltekPayload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TraveltekWebhookTest/1.0'
        }
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: `Real webhook endpoint test successful (${processingTime}ms)`,
        data: {
          ...response.data,
          testType: 'real_webhook_endpoint',
          payload: traveltekPayload,
          processingTime
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Real webhook test failed: ${error.message}`,
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 3. Test Generic Webhook Endpoint
   */
  async testGenericWebhookEndpoint(lineId: number): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📨 Testing generic webhook endpoint for line ${lineId}...`);
      
      const genericPayload = {
        event_type: 'cruiseline_pricing_updated',
        lineid: lineId,
        marketId: 0,
        currency: 'USD',
        description: `TEST: Generic webhook for line ${lineId}`,
        paths: [`/data/line/${lineId}/updates`],
        source: 'test_generic_webhook'
      };

      const response = await axios.post(`${WEBHOOK_BASE}/traveltek`, genericPayload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GenericWebhookTest/1.0'
        }
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: `Generic webhook test successful (${processingTime}ms)`,
        data: {
          ...response.data,
          testType: 'generic_webhook',
          payload: genericPayload,
          processingTime
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Generic webhook test failed: ${error.message}`,
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 4. Check Webhook System Status
   */
  async checkSystemStatus(): Promise<TestResult> {
    try {
      console.log('📊 Checking webhook system status...');
      
      const [healthResponse, statusResponse] = await Promise.all([
        axios.get(`${WEBHOOK_BASE}/traveltek/health`),
        axios.get(`${WEBHOOK_BASE}/traveltek/status`)
      ]);

      return {
        success: true,
        message: 'System status check successful',
        data: {
          health: healthResponse.data,
          status: statusResponse.data,
          systemHealthy: healthResponse.data.status === 'healthy',
          testType: 'system_status'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `System status check failed: ${error.message}`,
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 5. Test Line ID Mapping
   */
  async testLineMapping(lineId: number): Promise<TestResult> {
    try {
      console.log(`🔍 Testing line ID mapping for ${lineId}...`);
      
      const [mappingResponse, debugResponse] = await Promise.all([
        axios.get(`${WEBHOOK_BASE}/traveltek/mapping-test?lineId=${lineId}`),
        axios.get(`${WEBHOOK_BASE}/traveltek/debug?lineId=${lineId}`)
      ]);

      return {
        success: true,
        message: 'Line mapping test successful',
        data: {
          mapping: mappingResponse.data,
          debug: debugResponse.data,
          testType: 'line_mapping'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Line mapping test failed: ${error.message}`,
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 6. Performance Test with Multiple Requests
   */
  async performanceTest(lineId: number, concurrency: number = 3): Promise<TestResult> {
    try {
      console.log(`⚡ Running performance test with ${concurrency} concurrent requests...`);
      
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.testInternalSimulation(lineId));
      }
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      return {
        success: successful > 0,
        message: `Performance test completed: ${successful}/${concurrency} successful`,
        data: {
          concurrency,
          totalRequests: concurrency,
          successful,
          failed,
          totalTimeMs: totalTime,
          averageTimeMs: totalTime / concurrency,
          results,
          testType: 'performance_test'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Performance test failed: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 7. Full System Test (All Methods)
   */
  async fullSystemTest(lineId: number): Promise<TestResult[]> {
    console.log(`🔄 Running full system test for line ${lineId}...\n`);
    
    const tests = [
      { name: 'System Status', method: () => this.checkSystemStatus() },
      { name: 'Line Mapping', method: () => this.testLineMapping(lineId) },
      { name: 'Internal Simulation', method: () => this.testInternalSimulation(lineId) },
      { name: 'Real Webhook Endpoint', method: () => this.testRealWebhookEndpoint(lineId) },
      { name: 'Generic Webhook', method: () => this.testGenericWebhookEndpoint(lineId) },
      { name: 'Performance Test', method: () => this.performanceTest(lineId, 2) }
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      console.log(`\n--- Running ${test.name} ---`);
      try {
        const result = await test.method();
        results.push(result);
        
        if (result.success) {
          console.log(`✅ ${test.name}: ${result.message}`);
        } else {
          console.log(`❌ ${test.name}: ${result.message}`);
        }
        
        // Wait 2 seconds between tests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        const errorResult: TestResult = {
          success: false,
          message: `${test.name} test crashed: ${error.message}`,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        results.push(errorResult);
        console.log(`💥 ${test.name}: ${errorResult.message}`);
      }
    }

    return results;
  }

  /**
   * Generate curl command for manual testing
   */
  generateCurlCommand(lineId: number): string {
    const payload = {
      event: 'cruiseline_pricing_updated',
      lineid: lineId,
      marketid: 0,
      currency: 'USD',
      description: `CURL TEST: Cruise line pricing update for line ${lineId}`,
      source: 'curl_test',
      timestamp: Math.floor(Date.now() / 1000)
    };

    return `curl -X POST "${WEBHOOK_BASE}/traveltek/cruiseline-pricing-updated" \\
  -H "Content-Type: application/json" \\
  -H "User-Agent: CurlTest/1.0" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  }

  /**
   * Print test summary
   */
  printTestSummary(results: TestResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 WEBHOOK SYSTEM TEST SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((successful / results.length) * 100)}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.message}`);
      });
    }
    
    console.log('\n📊 WHAT TO LOOK FOR IN SLACK:');
    console.log('1. 🔄 "Real-time Webhook Processing Started" messages');
    console.log('2. ✅ "Real-time Webhook Processing Completed" with actual FTP results');
    console.log('3. Numbers showing actual cruises updated vs. FTP failures');
    console.log('4. Processing times (should be much faster than old batch system)');
    
    console.log('\n🚀 KEY DIFFERENCES FROM OLD SYSTEM:');
    console.log('- ❌ NO MORE: "X cruises marked for update" (flag setting)');
    console.log('- ✅ NOW SHOWS: "X cruises actually updated" (real FTP results)');
    console.log('- ⚡ Real-time parallel processing (10 workers)');
    console.log('- 📊 Accurate FTP success/failure rates');
    
    console.log('\n='.repeat(60));
  }
}

// CLI Commands
async function main() {
  program
    .name('webhook-test')
    .description('Test the real-time webhook processing system')
    .version('1.0.0');

  program
    .command('simulate')
    .description('Test internal simulation endpoint')
    .argument('<lineId>', 'Cruise line ID to test')
    .action(async (lineId) => {
      const tester = new WebhookSystemTester();
      const result = await tester.testInternalSimulation(parseInt(lineId));
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('webhook')
    .description('Test real webhook endpoint')
    .argument('<lineId>', 'Cruise line ID to test')
    .action(async (lineId) => {
      const tester = new WebhookSystemTester();
      const result = await tester.testRealWebhookEndpoint(parseInt(lineId));
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('status')
    .description('Check webhook system status')
    .action(async () => {
      const tester = new WebhookSystemTester();
      const result = await tester.checkSystemStatus();
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('mapping')
    .description('Test line ID mapping')
    .argument('<lineId>', 'Cruise line ID to test mapping for')
    .action(async (lineId) => {
      const tester = new WebhookSystemTester();
      const result = await tester.testLineMapping(parseInt(lineId));
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('performance')
    .description('Run performance test')
    .argument('<lineId>', 'Cruise line ID to test')
    .option('-c, --concurrency <number>', 'Number of concurrent requests', '3')
    .action(async (lineId, options) => {
      const tester = new WebhookSystemTester();
      const result = await tester.performanceTest(parseInt(lineId), parseInt(options.concurrency));
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('full')
    .description('Run full system test suite')
    .argument('<lineId>', 'Cruise line ID to test')
    .action(async (lineId) => {
      const tester = new WebhookSystemTester();
      const results = await tester.fullSystemTest(parseInt(lineId));
      tester.printTestSummary(results);
    });

  program
    .command('curl')
    .description('Generate curl command for manual testing')
    .argument('<lineId>', 'Cruise line ID to generate curl for')
    .action(async (lineId) => {
      const tester = new WebhookSystemTester();
      const curlCmd = tester.generateCurlCommand(parseInt(lineId));
      console.log('\n📋 CURL COMMAND FOR MANUAL TESTING:');
      console.log('='.repeat(50));
      console.log(curlCmd);
      console.log('\n💡 TIP: Run this command in your terminal to manually trigger a webhook');
    });

  await program.parseAsync();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WebhookSystemTester };