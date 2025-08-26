import * as ftp from 'basic-ftp';
import { env } from '../config/environment';
import logger from '../config/logger';

interface PooledConnection {
  client: ftp.Client;
  inUse: boolean;
  lastUsed: Date;
  id: number;
}

/**
 * FTP Connection Pool Manager
 * Maintains persistent FTP connections for efficient bulk operations
 */
export class FTPConnectionPool {
  private pool: PooledConnection[] = [];
  private readonly maxConnections = 5;
  private readonly connectionTimeout = 30000; // 30 seconds
  private readonly idleTimeout = 300000; // 5 minutes
  private connectionCounter = 0;

  constructor() {
    // Cleanup idle connections every minute
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  /**
   * Get an available connection from the pool or create a new one
   */
  async getConnection(): Promise<ftp.Client> {
    // Try to find an available connection
    const available = this.pool.find(conn => !conn.inUse);
    
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      logger.debug(`Reusing FTP connection #${available.id}`);
      return available.client;
    }

    // Create new connection if pool isn't full
    if (this.pool.length < this.maxConnections) {
      const client = await this.createConnection();
      const connection: PooledConnection = {
        client,
        inUse: true,
        lastUsed: new Date(),
        id: ++this.connectionCounter
      };
      this.pool.push(connection);
      logger.info(`Created new FTP connection #${connection.id} (pool size: ${this.pool.length})`);
      return client;
    }

    // Wait for a connection to become available
    logger.warn('FTP pool exhausted, waiting for available connection...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const conn = this.pool.find(c => !c.inUse);
        if (conn) {
          clearInterval(checkInterval);
          conn.inUse = true;
          conn.lastUsed = new Date();
          resolve(conn.client);
        }
      }, 100);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(client: ftp.Client): void {
    const connection = this.pool.find(conn => conn.client === client);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();
      logger.debug(`Released FTP connection #${connection.id}`);
    }
  }

  /**
   * Create a new FTP connection
   */
  private async createConnection(): Promise<ftp.Client> {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    
    try {
      await client.access({
        host: env.TRAVELTEK_FTP_HOST,
        user: env.TRAVELTEK_FTP_USER,
        password: env.TRAVELTEK_FTP_PASS,
        secure: false,
        connTimeout: this.connectionTimeout
      });
      
      return client;
    } catch (error) {
      logger.error('Failed to create FTP connection:', error);
      throw error;
    }
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.pool.length; i++) {
      const conn = this.pool[i];
      if (!conn.inUse && (now - conn.lastUsed.getTime()) > this.idleTimeout) {
        try {
          conn.client.close();
          toRemove.push(i);
          logger.debug(`Closed idle FTP connection #${conn.id}`);
        } catch (error) {
          logger.error(`Error closing idle connection #${conn.id}:`, error);
        }
      }
    }

    // Remove closed connections from pool
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.pool.splice(toRemove[i], 1);
    }

    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} idle connections (pool size: ${this.pool.length})`);
    }
  }

  /**
   * Download multiple files efficiently using a single connection
   */
  async downloadBatch(filePaths: string[]): Promise<Map<string, Buffer>> {
    const client = await this.getConnection();
    const results = new Map<string, Buffer>();
    const errors: string[] = [];

    try {
      for (const filePath of filePaths) {
        try {
          const stream = await client.downloadTo(null, filePath);
          
          // Convert stream to buffer
          const chunks: Buffer[] = [];
          await new Promise((resolve, reject) => {
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', resolve);
            stream.on('error', reject);
          });
          
          results.set(filePath, Buffer.concat(chunks));
        } catch (error) {
          logger.warn(`Failed to download ${filePath}:`, error);
          errors.push(filePath);
        }
      }
    } finally {
      this.releaseConnection(client);
    }

    if (errors.length > 0) {
      logger.warn(`Failed to download ${errors.length}/${filePaths.length} files`);
    }

    return results;
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all FTP connections...');
    for (const conn of this.pool) {
      try {
        conn.client.close();
      } catch (error) {
        logger.error(`Error closing connection #${conn.id}:`, error);
      }
    }
    this.pool = [];
  }
}

// Export singleton instance
export const ftpConnectionPool = new FTPConnectionPool();