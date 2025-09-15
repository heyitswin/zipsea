/**
 * Database Configuration
 * Optimized settings for PostgreSQL connection pooling
 */

export const databaseConfig = {
  // Connection pool settings optimized for memory management
  pool: {
    // Maximum number of connections in the pool
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,

    // Minimum number of connections to maintain
    min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 2,

    // Maximum time (ms) to wait for a connection
    connectionTimeoutMillis: 5000,

    // Maximum time (ms) a connection can be idle before being released
    idleTimeoutMillis: 30000,

    // How often to run eviction checks (ms)
    evictionRunIntervalMillis: 60000,

    // Maximum lifetime of a connection (ms) - 30 minutes
    maxLifetimeMillis: 1800000,
  },

  // Batch processing specific settings
  batchProcessing: {
    // Use separate smaller pool for batch operations
    max: 5,
    min: 1,

    // Shorter timeouts for batch operations
    idleTimeoutMillis: 10000,

    // Recycle connections after each batch
    recycleAfterOperations: 100,
  },

  // Query timeouts
  queryTimeouts: {
    default: 30000, // 30 seconds
    batch: 120000,  // 2 minutes for batch operations
    report: 300000, // 5 minutes for reports
  },

  // Memory optimization settings
  optimization: {
    // Release connections aggressively after batch operations
    aggressiveRelease: true,

    // Run cleanup after batch sync
    runCleanupAfterBatch: true,

    // Days to keep cruise data
    dataRetentionDays: 7,

    // Days to keep departed cruises
    departedCruiseRetentionDays: 30,
  }
};

export default databaseConfig;
