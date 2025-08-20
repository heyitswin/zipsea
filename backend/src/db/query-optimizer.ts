import { sql } from 'drizzle-orm';
import { db } from './connection';
import { logger } from '../config/logger';

/**
 * Database Query Optimizer
 * Provides utilities for monitoring and optimizing search query performance
 */

export interface QueryStats {
  query: string;
  executionTime: number;
  planTime: number;
  totalCost: number;
  rows: number;
  bufferHits: number;
  bufferReads: number;
  indexScans: number;
  seqScans: number;
}

export interface IndexUsageStats {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_tup_read: number;
  idx_tup_fetch: number;
  idx_scan: number;
  size_mb: number;
}

export interface SlowQuery {
  query: string;
  avgTime: number;
  calls: number;
  totalTime: number;
  rows: number;
  hitPercent: number;
}

export class QueryOptimizer {
  
  /**
   * Analyze query performance and get execution plan
   */
  async analyzeQuery(query: string): Promise<any> {
    try {
      const result = await db.execute(sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`));
      return result[0];
    } catch (error) {
      logger.error('Failed to analyze query:', error);
      throw error;
    }
  }

  /**
   * Get detailed query execution statistics
   */
  async getQueryStats(query: string): Promise<QueryStats> {
    try {
      const startTime = Date.now();
      
      // Get execution plan with detailed stats
      const explainResult = await db.execute(
        sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`)
      );
      
      const plan = explainResult[0]['QUERY PLAN'][0];
      const executionTime = Date.now() - startTime;
      
      return {
        query,
        executionTime,
        planTime: plan['Planning Time'],
        totalCost: plan['Plan']['Total Cost'],
        rows: plan['Plan']['Actual Rows'],
        bufferHits: this.extractBufferStats(plan, 'Shared Hit Blocks') || 0,
        bufferReads: this.extractBufferStats(plan, 'Shared Read Blocks') || 0,
        indexScans: this.countIndexScans(plan['Plan']) || 0,
        seqScans: this.countSeqScans(plan['Plan']) || 0
      };
    } catch (error) {
      logger.error('Failed to get query stats:', error);
      throw error;
    }
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats(): Promise<IndexUsageStats[]> {
    try {
      const result = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan,
          pg_size_pretty(pg_relation_size(indexrelid)) as size,
          round(pg_relation_size(indexrelid) / 1024.0 / 1024.0, 2) as size_mb
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('cruises', 'cheapest_pricing', 'cruise_lines', 'ships', 'ports', 'regions')
        ORDER BY idx_scan DESC, size_mb DESC;
      `));
      
      return result as IndexUsageStats[];
    } catch (error) {
      logger.error('Failed to get index usage stats:', error);
      throw error;
    }
  }

  /**
   * Get slow query statistics from pg_stat_statements
   */
  async getSlowQueries(limit: number = 10): Promise<SlowQuery[]> {
    try {
      // Check if pg_stat_statements extension is available
      const extensionCheck = await db.execute(sql.raw(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as has_extension;
      `));
      
      if (!extensionCheck[0]?.has_extension) {
        logger.warn('pg_stat_statements extension not available');
        return [];
      }

      const result = await db.execute(sql.raw(`
        SELECT 
          query,
          round(mean_exec_time, 2) as avg_time,
          calls,
          round(total_exec_time, 2) as total_time,
          rows,
          round(
            (shared_blks_hit::float / NULLIF(shared_blks_hit + shared_blks_read, 0)) * 100, 
            2
          ) as hit_percent
        FROM pg_stat_statements
        WHERE query LIKE '%cruises%' 
        OR query LIKE '%search%'
        OR query LIKE '%cheapest_pricing%'
        ORDER BY mean_exec_time DESC
        LIMIT ${limit};
      `));
      
      return result as SlowQuery[];
    } catch (error) {
      logger.warn('Failed to get slow queries (pg_stat_statements may not be enabled):', error);
      return [];
    }
  }

  /**
   * Analyze table statistics for search-related tables
   */
  async getTableStatistics(): Promise<any[]> {
    try {
      const result = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze,
          vacuum_count,
          autovacuum_count,
          analyze_count,
          autoanalyze_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        AND tablename IN ('cruises', 'cheapest_pricing', 'cruise_lines', 'ships', 'ports', 'regions')
        ORDER BY tablename;
      `));
      
      return result;
    } catch (error) {
      logger.error('Failed to get table statistics:', error);
      throw error;
    }
  }

  /**
   * Check for missing indexes based on query patterns
   */
  async suggestIndexes(): Promise<string[]> {
    const suggestions: string[] = [];
    
    try {
      // Check for sequential scans on large tables
      const seqScans = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          n_live_tup
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        AND seq_scan > idx_scan * 2
        AND n_live_tup > 1000
        ORDER BY seq_tup_read DESC;
      `));
      
      for (const table of seqScans) {
        suggestions.push(
          `Consider adding indexes to ${table.tablename} - high sequential scan ratio: ${table.seq_scan} seq vs ${table.idx_scan} idx`
        );
      }

      // Check for unused indexes
      const unusedIndexes = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND idx_scan < 10
        AND pg_relation_size(indexrelid) > 1024 * 1024  -- Larger than 1MB
        ORDER BY pg_relation_size(indexrelid) DESC;
      `));
      
      for (const index of unusedIndexes) {
        suggestions.push(
          `Consider removing unused index ${index.indexname} on ${index.tablename} (${index.size}, ${index.idx_scan} scans)`
        );
      }

      return suggestions;
    } catch (error) {
      logger.error('Failed to suggest indexes:', error);
      return [];
    }
  }

  /**
   * Optimize search query cache hit ratio
   */
  async getCacheHitRatio(): Promise<{ table: string; hit_ratio: number }[]> {
    try {
      const result = await db.execute(sql.raw(`
        SELECT 
          schemaname || '.' || tablename as table,
          round(
            (heap_blks_hit::float / NULLIF(heap_blks_hit + heap_blks_read, 0)) * 100, 
            2
          ) as hit_ratio
        FROM pg_statio_user_tables
        WHERE schemaname = 'public'
        AND tablename IN ('cruises', 'cheapest_pricing', 'cruise_lines', 'ships', 'ports', 'regions')
        ORDER BY hit_ratio ASC;
      `));
      
      return result as { table: string; hit_ratio: number }[];
    } catch (error) {
      logger.error('Failed to get cache hit ratio:', error);
      throw error;
    }
  }

  /**
   * Run VACUUM ANALYZE on search tables for optimal performance
   */
  async optimizeTables(): Promise<void> {
    const tables = ['cruises', 'cheapest_pricing', 'cruise_lines', 'ships', 'ports', 'regions'];
    
    try {
      for (const table of tables) {
        logger.info(`Analyzing table: ${table}`);
        await db.execute(sql.raw(`ANALYZE ${table};`));
      }
      
      logger.info('Table optimization completed');
    } catch (error) {
      logger.error('Failed to optimize tables:', error);
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<{
    indexUsage: IndexUsageStats[];
    slowQueries: SlowQuery[];
    tableStats: any[];
    cacheHitRatio: { table: string; hit_ratio: number }[];
    suggestions: string[];
  }> {
    try {
      const [indexUsage, slowQueries, tableStats, cacheHitRatio, suggestions] = await Promise.all([
        this.getIndexUsageStats(),
        this.getSlowQueries(),
        this.getTableStatistics(),
        this.getCacheHitRatio(),
        this.suggestIndexes()
      ]);

      return {
        indexUsage,
        slowQueries,
        tableStats,
        cacheHitRatio,
        suggestions
      };
    } catch (error) {
      logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  // Private helper methods

  private extractBufferStats(plan: any, statName: string): number {
    if (plan[statName]) return plan[statName];
    
    let total = 0;
    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        total += this.extractBufferStats(subPlan, statName);
      }
    }
    return total;
  }

  private countIndexScans(plan: any): number {
    let count = 0;
    
    if (plan['Node Type'] && plan['Node Type'].includes('Index')) {
      count = 1;
    }
    
    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        count += this.countIndexScans(subPlan);
      }
    }
    
    return count;
  }

  private countSeqScans(plan: any): number {
    let count = 0;
    
    if (plan['Node Type'] === 'Seq Scan') {
      count = 1;
    }
    
    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        count += this.countSeqScans(subPlan);
      }
    }
    
    return count;
  }
}

// Singleton instance
export const queryOptimizer = new QueryOptimizer();