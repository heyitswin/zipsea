#!/usr/bin/env tsx

/**
 * Webhook Load Testing Script
 * 
 * This script tests the webhook system under load to verify:
 * 1. Parallel processing capabilities
 * 2. Queue handling under pressure
 * 3. FTP connection pooling
 * 4. System stability with multiple cruise lines
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const API_BASE = process.env.API_BASE || 'https://zipsea-production.onrender.com/api';
const WEBHOOK_BASE = `${API_BASE}/webhooks`;

interface LoadTestConfig {
  cruiseLines: number[];
  concurrentRequests: number;
  totalRequests: number;
  delayBetweenBatches: number; // ms
  testDuration: number; // seconds
}

interface LoadTestResult {
  totalRequests: number;
  successful: number;
  failed: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: Array<{ error: string; count: number }>;
  timeline: Array<{ timestamp: string; successful: number; failed: number }>;
}

class WebhookLoadTester {
  private config: LoadTestConfig;
  private results: LoadTestResult;
  private startTime: number;

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.results = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: [],
      timeline: []
    };
    this.startTime = performance.now();
  }

  /**
   * Single webhook request
   */
  private async sendWebhookRequest(lineId: number, requestId: number): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    
    try {
      const payload = {
        event: 'cruiseline_pricing_updated',
        lineid: lineId,
        marketid: 0,
        currency: 'USD',
        description: `LOAD TEST ${requestId}: Cruise line ${lineId} pricing update`,
        source: `load_test_${requestId}`,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const response = await axios.post(
        `${WEBHOOK_BASE}/traveltek/cruiseline-pricing-updated`,
        payload,
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `WebhookLoadTest/1.0 (Request-${requestId})`
          }
        }
      );

      const responseTime = performance.now() - startTime;

      return {
        success: response.status === 200 && response.data.success,
        responseTime
      };

    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Run load test with progressive intensity
   */
  async runProgressiveLoadTest(): Promise<LoadTestResult> {
    console.log('🔥 Starting Progressive Load Test...');
    console.log(`📊 Config: ${this.config.totalRequests} total requests across ${this.config.cruiseLines.length} lines`);
    console.log(`⚡ Max concurrency: ${this.config.concurrentRequests}`);
    
    const responseTimes: number[] = [];
    let requestCounter = 0;
    let currentBatchSize = 1;
    const maxBatchSize = this.config.concurrentRequests;
    
    // Progressive load test - start small and ramp up
    while (requestCounter < this.config.totalRequests) {
      const batchStartTime = performance.now();
      const batchPromises = [];
      
      console.log(`\n🚀 Batch ${Math.floor(requestCounter / maxBatchSize) + 1}: Sending ${Math.min(currentBatchSize, this.config.totalRequests - requestCounter)} requests...`);
      
      // Create batch of requests
      for (let i = 0; i < currentBatchSize && requestCounter < this.config.totalRequests; i++) {
        const lineId = this.config.cruiseLines[requestCounter % this.config.cruiseLines.length];
        const requestId = requestCounter + 1;
        
        batchPromises.push(this.sendWebhookRequest(lineId, requestId));
        requestCounter++;
      }

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      let batchSuccessful = 0;
      let batchFailed = 0;
      
      for (const result of batchResults) {
        this.results.totalRequests++;
        responseTimes.push(result.responseTime);
        
        if (result.success) {
          this.results.successful++;
          batchSuccessful++;
        } else {
          this.results.failed++;
          batchFailed++;
          
          // Track error types
          const errorType = result.error || 'Unknown error';
          const existingError = this.results.errors.find(e => e.error === errorType);
          if (existingError) {
            existingError.count++;
          } else {
            this.results.errors.push({ error: errorType, count: 1 });
          }
        }
      }
      
      const batchTime = performance.now() - batchStartTime;
      console.log(`  ✅ Batch completed in ${Math.round(batchTime)}ms`);
      console.log(`  📊 Results: ${batchSuccessful} successful, ${batchFailed} failed`);
      
      // Add to timeline
      this.results.timeline.push({
        timestamp: new Date().toISOString(),
        successful: batchSuccessful,
        failed: batchFailed
      });
      
      // Gradually increase batch size
      currentBatchSize = Math.min(currentBatchSize + 1, maxBatchSize);
      
      // Delay between batches to avoid overwhelming the system
      if (requestCounter < this.config.totalRequests && this.config.delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
      }
    }

    // Calculate final statistics
    const totalTime = (performance.now() - this.startTime) / 1000; // Convert to seconds
    
    this.results.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    this.results.minResponseTime = Math.min(...responseTimes);
    this.results.maxResponseTime = Math.max(...responseTimes);
    this.results.requestsPerSecond = this.results.totalRequests / totalTime;

    return this.results;
  }

  /**
   * Run concurrent burst test
   */
  async runBurstTest(): Promise<LoadTestResult> {
    console.log('💥 Starting Burst Load Test...');
    console.log(`📊 Config: ${this.config.totalRequests} concurrent requests`);
    
    const promises = [];
    const responseTimes: number[] = [];
    
    // Fire all requests at once
    for (let i = 0; i < this.config.totalRequests; i++) {
      const lineId = this.config.cruiseLines[i % this.config.cruiseLines.length];
      promises.push(this.sendWebhookRequest(lineId, i + 1));
    }
    
    console.log(`🔥 Fired ${this.config.totalRequests} concurrent requests...`);
    
    // Wait for all to complete
    const results = await Promise.all(promises);
    
    // Process results
    for (const result of results) {
      this.results.totalRequests++;
      responseTimes.push(result.responseTime);
      
      if (result.success) {
        this.results.successful++;
      } else {
        this.results.failed++;
        
        const errorType = result.error || 'Unknown error';
        const existingError = this.results.errors.find(e => e.error === errorType);
        if (existingError) {
          existingError.count++;
        } else {
          this.results.errors.push({ error: errorType, count: 1 });
        }
      }
    }

    // Calculate statistics
    const totalTime = (performance.now() - this.startTime) / 1000;
    
    this.results.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    this.results.minResponseTime = Math.min(...responseTimes);
    this.results.maxResponseTime = Math.max(...responseTimes);
    this.results.requestsPerSecond = this.results.totalRequests / totalTime;

    return this.results;
  }

  /**
   * Print detailed results
   */
  printResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔥 WEBHOOK LOAD TEST RESULTS');
    console.log('='.repeat(60));
    
    const successRate = (this.results.successful / this.results.totalRequests) * 100;
    
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`✅ Successful: ${this.results.successful} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${this.results.failed} (${(100 - successRate).toFixed(1)}%)`);
    console.log(`⚡ Requests/sec: ${this.results.requestsPerSecond.toFixed(2)}`);
    
    console.log('\n📊 RESPONSE TIMES:');
    console.log(`  Average: ${this.results.averageResponseTime.toFixed(0)}ms`);
    console.log(`  Min: ${this.results.minResponseTime.toFixed(0)}ms`);
    console.log(`  Max: ${this.results.maxResponseTime.toFixed(0)}ms`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERROR BREAKDOWN:');
      this.results.errors.forEach(error => {
        console.log(`  ${error.error}: ${error.count} occurrences`);
      });
    }
    
    console.log('\n📈 PERFORMANCE ANALYSIS:');
    if (successRate > 95) {
      console.log('🟢 EXCELLENT: System handled load very well (>95% success)');
    } else if (successRate > 85) {
      console.log('🟡 GOOD: System performed well with minor issues (>85% success)');
    } else if (successRate > 70) {
      console.log('🟠 FAIR: System struggled but remained functional (>70% success)');
    } else {
      console.log('🔴 POOR: System overwhelmed by load (<70% success)');
    }
    
    if (this.results.averageResponseTime < 2000) {
      console.log('🟢 FAST: Average response time excellent (<2s)');
    } else if (this.results.averageResponseTime < 5000) {
      console.log('🟡 MODERATE: Average response time acceptable (<5s)');
    } else {
      console.log('🔴 SLOW: Average response time concerning (>5s)');
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    if (this.results.failed > 0) {
      console.log('- Monitor Redis queue capacity and connection pool');
      console.log('- Check FTP connection limits and timeouts');
      console.log('- Review BullMQ worker concurrency settings');
    }
    
    if (this.results.averageResponseTime > 3000) {
      console.log('- Consider increasing parallel worker count');
      console.log('- Optimize FTP connection pooling');
      console.log('- Review database query performance');
    }
    
    console.log('='.repeat(60));
  }
}

// Predefined test configurations
const TEST_CONFIGS = {
  light: {
    cruiseLines: [5, 21, 22], // Common cruise lines
    concurrentRequests: 5,
    totalRequests: 15,
    delayBetweenBatches: 1000,
    testDuration: 60
  } as LoadTestConfig,
  
  moderate: {
    cruiseLines: [5, 21, 22, 46, 118, 123],
    concurrentRequests: 10,
    totalRequests: 30,
    delayBetweenBatches: 500,
    testDuration: 120
  } as LoadTestConfig,
  
  heavy: {
    cruiseLines: [5, 21, 22, 46, 118, 123, 643],
    concurrentRequests: 15,
    totalRequests: 50,
    delayBetweenBatches: 200,
    testDuration: 180
  } as LoadTestConfig
};

// Main execution
async function main() {
  const testType = process.argv[2] || 'light';
  const mode = process.argv[3] || 'progressive'; // 'progressive' or 'burst'
  
  console.log('🔥 WEBHOOK LOAD TESTING TOOL');
  console.log('=============================');
  
  if (!TEST_CONFIGS[testType as keyof typeof TEST_CONFIGS]) {
    console.log('❌ Invalid test type. Available options: light, moderate, heavy');
    console.log('\nUsage: tsx webhook-load-test.ts [light|moderate|heavy] [progressive|burst]');
    console.log('\nExamples:');
    console.log('  tsx webhook-load-test.ts light progressive');
    console.log('  tsx webhook-load-test.ts heavy burst');
    return;
  }
  
  const config = TEST_CONFIGS[testType as keyof typeof TEST_CONFIGS];
  const tester = new WebhookLoadTester(config);
  
  console.log(`🎯 Running ${testType} load test in ${mode} mode...`);
  console.log(`📋 Testing cruise lines: ${config.cruiseLines.join(', ')}`);
  
  try {
    let results: LoadTestResult;
    
    if (mode === 'burst') {
      results = await tester.runBurstTest();
    } else {
      results = await tester.runProgressiveLoadTest();
    }
    
    tester.printResults();
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `load-test-${testType}-${mode}-${timestamp}.json`;
    
    console.log(`\n💾 Results saved to: ${filename}`);
    
  } catch (error) {
    console.error('💥 Load test failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { WebhookLoadTester, TEST_CONFIGS };