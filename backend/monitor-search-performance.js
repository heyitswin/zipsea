#!/usr/bin/env node

/**
 * Search Performance Monitor
 * Monitors and reports on search API performance
 */

import { queryOptimizer } from './src/db/query-optimizer.js';
import { db } from './src/db/connection.js';
import { logger } from './src/config/logger.js';

const PERFORMANCE_THRESHOLDS = {
  responseTime: 200, // ms
  cacheHitRatio: 90, // %
  indexUsageRatio: 80, // %
  slowQueryTime: 100 // ms
};

class PerformanceMonitor {
  
  async runPerformanceCheck() {
    console.log('🔍 Starting Search Performance Analysis');
    console.log('=' .repeat(50));
    
    try {
      const report = await queryOptimizer.generatePerformanceReport();
      
      await this.analyzeIndexUsage(report.indexUsage);
      await this.analyzeSlowQueries(report.slowQueries);
      await this.analyzeCacheHitRatio(report.cacheHitRatio);
      await this.analyzeTableStats(report.tableStats);
      await this.showSuggestions(report.suggestions);
      
      console.log('\n📊 Performance Summary');
      console.log('=' .repeat(50));
      
      const score = await this.calculatePerformanceScore(report);
      console.log(`Overall Performance Score: ${score}/100`);
      
      if (score >= 90) {
        console.log('🎉 Excellent performance!');
      } else if (score >= 75) {
        console.log('👍 Good performance with room for improvement');
      } else if (score >= 60) {
        console.log('⚠️ Performance needs attention');
      } else {
        console.log('🚨 Performance issues detected - immediate action required');
      }
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      process.exit(1);
    }
  }
  
  async analyzeIndexUsage(indexUsage) {
    console.log('\n📈 Index Usage Analysis');
    console.log('-' .repeat(30));
    
    if (!indexUsage || indexUsage.length === 0) {
      console.log('⚠️ No index usage data available');
      return;
    }
    
    const totalIndexes = indexUsage.length;
    const usedIndexes = indexUsage.filter(idx => idx.idx_scan > 0).length;
    const usageRatio = (usedIndexes / totalIndexes) * 100;
    
    console.log(`Indexes in use: ${usedIndexes}/${totalIndexes} (${usageRatio.toFixed(1)}%)`);
    
    // Show top performing indexes
    const topIndexes = indexUsage
      .filter(idx => idx.idx_scan > 0)
      .sort((a, b) => b.idx_scan - a.idx_scan)
      .slice(0, 5);
    
    console.log('\nTop 5 Most Used Indexes:');
    topIndexes.forEach((idx, i) => {
      console.log(`${i + 1}. ${idx.indexname} (${idx.tablename}): ${idx.idx_scan.toLocaleString()} scans, ${idx.size_mb}MB`);
    });
    
    // Show potentially unused indexes
    const unusedIndexes = indexUsage
      .filter(idx => idx.idx_scan === 0 && idx.size_mb > 1)
      .sort((a, b) => b.size_mb - a.size_mb);
    
    if (unusedIndexes.length > 0) {
      console.log('\n⚠️ Potentially Unused Large Indexes:');
      unusedIndexes.slice(0, 3).forEach(idx => {
        console.log(`- ${idx.indexname} (${idx.tablename}): ${idx.size_mb}MB, 0 scans`);
      });
    }
    
    return usageRatio;
  }
  
  async analyzeSlowQueries(slowQueries) {
    console.log('\n🐌 Slow Query Analysis');
    console.log('-' .repeat(30));
    
    if (!slowQueries || slowQueries.length === 0) {
      console.log('✅ No slow query data available (pg_stat_statements may not be enabled)');
      return 100;
    }
    
    const slowQueriesOverThreshold = slowQueries.filter(q => q.avgTime > PERFORMANCE_THRESHOLDS.slowQueryTime);
    
    if (slowQueriesOverThreshold.length === 0) {
      console.log('✅ No slow queries detected');
      return 100;
    }
    
    console.log(`❌ Found ${slowQueriesOverThreshold.length} slow queries:`);
    
    slowQueriesOverThreshold.slice(0, 3).forEach((query, i) => {
      console.log(`\n${i + 1}. Average Time: ${query.avgTime}ms`);
      console.log(`   Calls: ${query.calls.toLocaleString()}`);
      console.log(`   Total Time: ${query.totalTime.toLocaleString()}ms`);
      console.log(`   Hit Rate: ${query.hitPercent || 0}%`);
      console.log(`   Query: ${query.query.substring(0, 100)}...`);
    });
    
    const avgSlowTime = slowQueriesOverThreshold.reduce((sum, q) => sum + q.avgTime, 0) / slowQueriesOverThreshold.length;
    return Math.max(0, 100 - (avgSlowTime - PERFORMANCE_THRESHOLDS.slowQueryTime));
  }
  
  async analyzeCacheHitRatio(cacheHitRatio) {
    console.log('\n💾 Cache Hit Ratio Analysis');
    console.log('-' .repeat(30));
    
    if (!cacheHitRatio || cacheHitRatio.length === 0) {
      console.log('⚠️ No cache hit ratio data available');
      return 80; // Assume reasonable default
    }
    
    let totalScore = 0;
    let validTables = 0;
    
    cacheHitRatio.forEach(table => {
      const ratio = table.hit_ratio || 0;
      const status = ratio >= PERFORMANCE_THRESHOLDS.cacheHitRatio ? '✅' : '⚠️';
      
      console.log(`${status} ${table.table}: ${ratio}%`);
      
      if (ratio > 0) {
        totalScore += ratio;
        validTables++;
      }
    });
    
    const avgHitRatio = validTables > 0 ? totalScore / validTables : 0;
    
    if (avgHitRatio >= PERFORMANCE_THRESHOLDS.cacheHitRatio) {
      console.log(`✅ Overall cache hit ratio: ${avgHitRatio.toFixed(1)}%`);
    } else {
      console.log(`⚠️ Overall cache hit ratio: ${avgHitRatio.toFixed(1)}% (below ${PERFORMANCE_THRESHOLDS.cacheHitRatio}% threshold)`);
      console.log('💡 Consider increasing shared_buffers or work_mem');
    }
    
    return avgHitRatio;
  }
  
  async analyzeTableStats(tableStats) {
    console.log('\n📊 Table Statistics');
    console.log('-' .repeat(30));
    
    if (!tableStats || tableStats.length === 0) {
      console.log('⚠️ No table statistics available');
      return;
    }
    
    tableStats.forEach(table => {
      const deadTupleRatio = table.live_tuples > 0 ? (table.dead_tuples / table.live_tuples) * 100 : 0;
      const needsVacuum = deadTupleRatio > 10;
      
      console.log(`\n📋 ${table.tablename}:`);
      console.log(`   Live tuples: ${table.live_tuples?.toLocaleString() || 0}`);
      console.log(`   Dead tuples: ${table.dead_tuples?.toLocaleString() || 0} (${deadTupleRatio.toFixed(1)}%)`);
      console.log(`   Last analyze: ${table.last_autoanalyze || table.last_analyze || 'Never'}`);
      
      if (needsVacuum) {
        console.log(`   ⚠️ High dead tuple ratio - consider VACUUM`);
      } else {
        console.log(`   ✅ Good tuple ratio`);
      }
    });
  }
  
  async showSuggestions(suggestions) {
    console.log('\n💡 Performance Suggestions');
    console.log('-' .repeat(30));
    
    if (!suggestions || suggestions.length === 0) {
      console.log('✅ No specific suggestions at this time');
      return;
    }
    
    suggestions.forEach((suggestion, i) => {
      console.log(`${i + 1}. ${suggestion}`);
    });
  }
  
  async calculatePerformanceScore(report) {
    let score = 100;
    
    // Index usage score (25 points)
    const indexUsageRatio = report.indexUsage.length > 0 ? 
      (report.indexUsage.filter(idx => idx.idx_scan > 0).length / report.indexUsage.length) * 100 : 100;
    if (indexUsageRatio < PERFORMANCE_THRESHOLDS.indexUsageRatio) {
      score -= (PERFORMANCE_THRESHOLDS.indexUsageRatio - indexUsageRatio) * 0.25;
    }
    
    // Cache hit ratio score (25 points)
    const avgCacheHitRatio = report.cacheHitRatio.length > 0 ?
      report.cacheHitRatio.reduce((sum, table) => sum + (table.hit_ratio || 0), 0) / report.cacheHitRatio.length : 90;
    if (avgCacheHitRatio < PERFORMANCE_THRESHOLDS.cacheHitRatio) {
      score -= (PERFORMANCE_THRESHOLDS.cacheHitRatio - avgCacheHitRatio) * 0.25;
    }
    
    // Slow queries score (25 points)
    const slowQueriesOverThreshold = report.slowQueries.filter(q => q.avgTime > PERFORMANCE_THRESHOLDS.slowQueryTime);
    if (slowQueriesOverThreshold.length > 0) {
      score -= Math.min(25, slowQueriesOverThreshold.length * 5);
    }
    
    // Table health score (25 points)
    let deadTupleIssues = 0;
    report.tableStats.forEach(table => {
      const deadTupleRatio = table.live_tuples > 0 ? (table.dead_tuples / table.live_tuples) * 100 : 0;
      if (deadTupleRatio > 10) deadTupleIssues++;
    });
    if (deadTupleIssues > 0) {
      score -= Math.min(25, deadTupleIssues * 5);
    }
    
    return Math.max(0, Math.round(score));
  }
  
  async runContinuousMonitoring(intervalMinutes = 5) {
    console.log(`🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)`);
    console.log('Press Ctrl+C to stop');
    
    const monitor = async () => {
      try {
        console.log(`\n[${new Date().toISOString()}] Running performance check...`);
        await this.runPerformanceCheck();
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    };
    
    // Run initial check
    await monitor();
    
    // Set up interval
    setInterval(monitor, intervalMinutes * 60 * 1000);
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

const monitor = new PerformanceMonitor();

async function main() {
  try {
    switch (command) {
      case 'continuous':
        const interval = parseInt(args[1]) || 5;
        await monitor.runContinuousMonitoring(interval);
        break;
      case 'optimize':
        console.log('🔧 Running table optimization...');
        await queryOptimizer.optimizeTables();
        console.log('✅ Optimization completed');
        break;
      default:
        await monitor.runPerformanceCheck();
        break;
    }
  } catch (error) {
    console.error('❌ Monitor failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Monitoring stopped');
  process.exit(0);
});

// Check if this is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}