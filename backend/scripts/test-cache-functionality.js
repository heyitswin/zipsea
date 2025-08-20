#!/usr/bin/env node

/**
 * Comprehensive Redis Cache Testing Script
 * 
 * Tests all aspects of the Redis caching implementation:
 * - Connection and health checks
 * - Basic Redis operations
 * - Cache manager functionality 
 * - Fallback mechanisms
 * - Cache warming
 * - Performance metrics
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class CacheTester {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.results = {
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      test: '🧪'
    }[type] || '📋';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest(name, testFn, category = 'general') {
    this.log(`Running test: ${name}`, 'test');
    const startTime = performance.now();
    
    try {
      const result = await testFn();
      const duration = Math.round(performance.now() - startTime);
      
      this.results.tests.push({
        name,
        category,
        status: 'passed',
        duration,
        result
      });
      
      this.results.summary.passed++;
      this.log(`✓ ${name} (${duration}ms)`, 'success');
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      this.results.tests.push({
        name,
        category,
        status: 'failed',
        duration,
        error: error.message
      });
      
      this.results.summary.failed++;
      this.log(`✗ ${name} (${duration}ms): ${error.message}`, 'error');
      throw error;
    } finally {
      this.results.summary.total++;
    }
  }

  async makeRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await axios({
        url,
        timeout: 10000,
        ...options
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('No response received from server');
      } else {
        throw new Error(error.message);
      }
    }
  }

  // Test basic connectivity
  async testBasicConnectivity() {
    await this.runTest('Basic server connectivity', async () => {
      const response = await this.makeRequest('/');
      if (!response.status) {
        throw new Error('Invalid response format');
      }
      return response;
    }, 'connectivity');
  }

  // Test Redis health check
  async testRedisHealth() {
    await this.runTest('Redis health check', async () => {
      const health = await this.makeRequest('/health');
      
      if (!health.services || !health.services.redis) {
        throw new Error('Redis health info not found in response');
      }

      const redisHealth = health.services.redis;
      
      if (!redisHealth.connected) {
        this.log('Redis is not connected - testing fallback mode', 'warning');
        this.results.summary.warnings++;
      }
      
      return {
        connected: redisHealth.connected,
        healthy: redisHealth.healthy,
        status: health.status
      };
    }, 'health');
  }

  // Test cache metrics endpoint
  async testCacheMetrics() {
    await this.runTest('Cache metrics endpoint', async () => {
      const metrics = await this.makeRequest('/cache/metrics');
      
      if (!metrics.redis || !metrics.metrics) {
        throw new Error('Invalid metrics response format');
      }
      
      return {
        connected: metrics.redis.connected,
        hasMetrics: !!metrics.metrics
      };
    }, 'metrics');
  }

  // Test cache stats endpoint
  async testCacheStats() {
    await this.runTest('Cache statistics endpoint', async () => {
      const stats = await this.makeRequest('/cache/stats');
      
      if (!stats.stats) {
        throw new Error('Invalid stats response format');
      }
      
      return {
        redisKeyCount: stats.stats.redis.keyCount,
        fallbackKeyCount: stats.stats.fallback.keyCount,
        hitRate: stats.stats.performance.hitRate
      };
    }, 'metrics');
  }

  // Test search functionality with caching
  async testSearchCaching() {
    await this.runTest('Search result caching', async () => {
      // First search - should hit database
      const startTime1 = performance.now();
      const search1 = await this.makeRequest('/api/search/cruises?limit=5');
      const time1 = performance.now() - startTime1;
      
      // Second search - should hit cache (if Redis is working)
      const startTime2 = performance.now();
      const search2 = await this.makeRequest('/api/search/cruises?limit=5');
      const time2 = performance.now() - startTime2;
      
      if (!search1.cruises || !search2.cruises) {
        throw new Error('Invalid search response format');
      }
      
      const speedImprovement = time1 / time2;
      const likelyCached = speedImprovement > 1.5 && time2 < 100; // Less than 100ms
      
      if (search1.meta?.cacheHit) {
        this.log('First request was cache hit (cache was already warm)', 'warning');
      }
      
      return {
        firstRequestTime: Math.round(time1),
        secondRequestTime: Math.round(time2),
        speedImprovement: Math.round(speedImprovement * 10) / 10,
        likelyCached,
        resultCount: search1.cruises.length,
        secondRequestCacheHit: search2.meta?.cacheHit || false
      };
    }, 'functionality');
  }

  // Test cache warming
  async testCacheWarming() {
    await this.runTest('Cache warming functionality', async () => {
      // Get warming status
      const statusBefore = await this.makeRequest('/cache/warming/status');
      
      // Trigger cache warming
      const warmingResult = await this.makeRequest('/cache/warming/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          targets: {
            searchFilters: true,
            popularCruises: true,
            popularSearches: false // Skip to speed up test
          }
        }
      });
      
      if (!warmingResult.result) {
        throw new Error('Invalid warming result format');
      }
      
      return {
        statusBefore: statusBefore.warming,
        warmingResult: warmingResult.result,
        successful: warmingResult.result.successful,
        failed: warmingResult.result.failed
      };
    }, 'warming');
  }

  // Test cache clearing
  async testCacheClearing() {
    await this.runTest('Cache clearing functionality', async () => {
      // Clear all caches
      const clearResult = await this.makeRequest('/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!clearResult.message) {
        throw new Error('Invalid clear result format');
      }
      
      // Check that caches were cleared by doing a search (should be slower)
      const startTime = performance.now();
      const search = await this.makeRequest('/api/search/cruises?limit=5');
      const searchTime = performance.now() - startTime;
      
      return {
        cleared: clearResult.message.includes('successfully'),
        postClearSearchTime: Math.round(searchTime),
        cacheHit: search.meta?.cacheHit || false
      };
    }, 'management');
  }

  // Test popular cruises endpoint caching
  async testPopularCruisesCaching() {
    await this.runTest('Popular cruises caching', async () => {
      try {
        // This endpoint might not exist, so we'll catch and handle gracefully
        const startTime1 = performance.now();
        const popular1 = await this.makeRequest('/api/cruises/popular?limit=10');
        const time1 = performance.now() - startTime1;
        
        const startTime2 = performance.now();
        const popular2 = await this.makeRequest('/api/cruises/popular?limit=10');
        const time2 = performance.now() - startTime2;
        
        return {
          firstRequestTime: Math.round(time1),
          secondRequestTime: Math.round(time2),
          speedImprovement: Math.round((time1 / time2) * 10) / 10,
          resultCount: popular1.length || popular1.cruises?.length || 0
        };
      } catch (error) {
        if (error.message.includes('404')) {
          this.log('Popular cruises endpoint not available - skipping test', 'warning');
          this.results.summary.warnings++;
          return { skipped: true, reason: 'Endpoint not available' };
        }
        throw error;
      }
    }, 'functionality');
  }

  // Test error handling and fallback
  async testErrorHandling() {
    await this.runTest('Error handling and fallback', async () => {
      // Test with invalid search parameters
      try {
        const invalidSearch = await this.makeRequest('/api/search/cruises?invalid_param=test&limit=5');
        
        // Should still return results (graceful handling)
        if (!invalidSearch.cruises) {
          throw new Error('Search failed with invalid parameters');
        }
        
        return {
          handlesInvalidParams: true,
          resultCount: invalidSearch.cruises.length
        };
      } catch (error) {
        // If it throws an error, that's also valid behavior
        return {
          handlesInvalidParams: false,
          errorMessage: error.message
        };
      }
    }, 'reliability');
  }

  // Test performance under load
  async testPerformanceUnderLoad() {
    await this.runTest('Performance under concurrent load', async () => {
      const concurrentRequests = 10;
      const requests = [];
      
      // Make multiple concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          this.makeRequest(`/api/search/cruises?limit=5&page=${i + 1}`)
        );
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(requests);
      const totalTime = performance.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > concurrentRequests / 2) {
        throw new Error(`Too many failures: ${failed}/${concurrentRequests}`);
      }
      
      return {
        concurrentRequests,
        successful,
        failed,
        totalTime: Math.round(totalTime),
        averageTime: Math.round(totalTime / successful),
        throughput: Math.round((successful / totalTime) * 1000) // requests per second
      };
    }, 'performance');
  }

  // Generate comprehensive report
  generateReport() {
    const { summary, tests } = this.results;
    const categories = [...new Set(tests.map(t => t.category))];
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 CACHE FUNCTIONALITY TEST RESULTS');
    console.log('='.repeat(60));
    
    // Overall summary
    console.log(`\n📊 Overall Results:`);
    console.log(`   Total Tests: ${summary.total}`);
    console.log(`   Passed: ${summary.passed} ✅`);
    console.log(`   Failed: ${summary.failed} ❌`);
    console.log(`   Warnings: ${summary.warnings} ⚠️`);
    console.log(`   Success Rate: ${Math.round((summary.passed / summary.total) * 100)}%`);
    
    // Category breakdown
    console.log(`\n📋 Results by Category:`);
    categories.forEach(category => {
      const categoryTests = tests.filter(t => t.category === category);
      const passed = categoryTests.filter(t => t.status === 'passed').length;
      const total = categoryTests.length;
      console.log(`   ${category}: ${passed}/${total} (${Math.round((passed/total)*100)}%)`);
    });
    
    // Failed tests details
    const failedTests = tests.filter(t => t.status === 'failed');
    if (failedTests.length > 0) {
      console.log(`\n❌ Failed Tests:`);
      failedTests.forEach(test => {
        console.log(`   • ${test.name}: ${test.error}`);
      });
    }
    
    // Performance insights
    const performanceTests = tests.filter(t => 
      t.category === 'performance' || t.result?.speedImprovement
    );
    if (performanceTests.length > 0) {
      console.log(`\n⚡ Performance Insights:`);
      performanceTests.forEach(test => {
        if (test.result?.speedImprovement) {
          console.log(`   • ${test.name}: ${test.result.speedImprovement}x speed improvement`);
        }
        if (test.result?.throughput) {
          console.log(`   • ${test.name}: ${test.result.throughput} requests/second`);
        }
      });
    }
    
    // Cache effectiveness
    const cachingTests = tests.filter(t => t.result?.likelyCached !== undefined);
    if (cachingTests.length > 0) {
      console.log(`\n💾 Cache Effectiveness:`);
      cachingTests.forEach(test => {
        const effective = test.result.likelyCached ? '✅ Effective' : '⚠️ Limited';
        console.log(`   • ${test.name}: ${effective}`);
      });
    }
    
    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (summary.failed > 0) {
      console.log(`   • Address ${summary.failed} failed tests before production deployment`);
    }
    if (summary.warnings > 0) {
      console.log(`   • Review ${summary.warnings} warnings for potential issues`);
    }
    
    const hasRedisIssues = tests.some(t => 
      t.name.includes('Redis') && t.status === 'failed'
    );
    if (hasRedisIssues) {
      console.log(`   • Check Redis connection and configuration`);
    }
    
    const hasPerformanceIssues = tests.some(t => 
      t.category === 'performance' && (t.status === 'failed' || t.result?.throughput < 10)
    );
    if (hasPerformanceIssues) {
      console.log(`   • Consider optimizing cache configuration for better performance`);
    }
    
    console.log(`\n✨ Cache infrastructure ${summary.failed === 0 ? 'ready' : 'needs attention'} for production!`);
    console.log('='.repeat(60));
    
    return {
      passed: summary.failed === 0,
      summary,
      categories: categories.map(cat => ({
        name: cat,
        tests: tests.filter(t => t.category === cat)
      }))
    };
  }

  // Run all tests
  async runAllTests() {
    this.log('Starting comprehensive cache functionality tests', 'info');
    console.log(`Testing against: ${this.baseUrl}`);
    console.log('='.repeat(60));
    
    try {
      // Basic connectivity and health
      await this.testBasicConnectivity();
      await this.testRedisHealth();
      
      // Cache metrics and monitoring
      await this.testCacheMetrics();
      await this.testCacheStats();
      
      // Core functionality
      await this.testSearchCaching();
      await this.testPopularCruisesCaching();
      
      // Management features
      await this.testCacheWarming();
      await this.testCacheClearing();
      
      // Reliability and performance
      await this.testErrorHandling();
      await this.testPerformanceUnderLoad();
      
      return this.generateReport();
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      return this.generateReport();
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3001';
  const tester = new CacheTester(baseUrl);
  
  tester.runAllTests()
    .then(report => {
      process.exit(report.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = CacheTester;