import * as ftp from 'basic-ftp';
import { Client as FTPClient } from 'basic-ftp';
import { EventEmitter } from 'events';
import logger from '../config/logger';
import { env } from '../config/environment';

interface PooledConnection {
  id: string;
  client: FTPClient;
  inUse: boolean;
  lastUsed: Date;
  createdAt: Date;
  keepAliveTimer?: NodeJS.Timeout;
}

interface ConnectionPoolOptions {
  maxConnections: number;
  minConnections: number;
  connectionTTL: number; // Max lifetime of a connection in ms
  idleTimeout: number; // Time before idle connection is closed
  keepAliveInterval: number; // Send NOOP to keep connection alive
  acquireTimeout: number; // Max time to wait for available connection
}

/**
 * FTP Connection Pool Manager
 * Manages a pool of FTP connections with keep-alive, automatic cleanup, and efficient reuse
 */
export class FTPConnectionPool extends EventEmitter {
  private pool: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<(conn: PooledConnection | null) => void> = [];
  private options: ConnectionPoolOptions;
  private cleanupTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(options?: Partial<ConnectionPoolOptions>) {
    super();

    this.options = {
      maxConnections: 3, // Keep low to avoid overwhelming FTP server
      minConnections: 1,
      connectionTTL: 10 * 60 * 1000, // 10 minutes
      idleTimeout: 2 * 60 * 1000, // 2 minutes
      keepAliveInterval: 30 * 1000, // 30 seconds
      acquireTimeout: 30 * 1000, // 30 seconds
      ...options,
    };

    // Start cleanup timer
    this.startCleanupTimer();

    // Initialize minimum connections
    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.options.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        logger.warn('Failed to create initial connection:', error);
      }
    }
  }

  private async createConnection(): Promise<PooledConnection> {
    const client = new FTPClient();
    const connectionId = `ftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Configure client
      client.ftp.verbose = false;
      client.ftp.timeout = 30000;

      // Connect to FTP server
      await client.access({
        host: env.TRAVELTEK_FTP_HOST!,
        user: env.TRAVELTEK_FTP_USER!,
        password: env.TRAVELTEK_FTP_PASSWORD!,
        secure: false,
        secureOptions: { rejectUnauthorized: false },
      });

      logger.info(`[Pool] Created new FTP connection: ${connectionId}`);

      const connection: PooledConnection = {
        id: connectionId,
        client,
        inUse: false,
        lastUsed: new Date(),
        createdAt: new Date(),
      };

      // Set up keep-alive
      this.setupKeepAlive(connection);

      // Add to pool
      this.pool.set(connectionId, connection);

      this.emit('connectionCreated', connectionId);

      return connection;
    } catch (error) {
      logger.error(`[Pool] Failed to create connection ${connectionId}:`, error);
      client.close();
      throw error;
    }
  }

  private setupKeepAlive(connection: PooledConnection): void {
    // Clear existing timer if any
    if (connection.keepAliveTimer) {
      clearInterval(connection.keepAliveTimer);
    }

    // Set up new keep-alive timer
    connection.keepAliveTimer = setInterval(async () => {
      if (!connection.inUse && !this.isShuttingDown) {
        try {
          // Send NOOP command to keep connection alive
          await connection.client.pwd();
          connection.lastUsed = new Date();
          logger.debug(`[Pool] Keep-alive sent for ${connection.id}`);
        } catch (error) {
          logger.warn(`[Pool] Keep-alive failed for ${connection.id}, removing from pool`);
          await this.removeConnection(connection.id);
        }
      }
    }, this.options.keepAliveInterval);
  }

  public async acquire(): Promise<PooledConnection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = Date.now();

    while (Date.now() - startTime < this.options.acquireTimeout) {
      // Try to find an available connection
      for (const [id, conn] of this.pool) {
        if (!conn.inUse && this.isConnectionHealthy(conn)) {
          conn.inUse = true;
          conn.lastUsed = new Date();
          logger.debug(`[Pool] Acquired existing connection: ${id}`);
          return conn;
        }
      }

      // If pool not at max, create new connection
      if (this.pool.size < this.options.maxConnections) {
        try {
          const newConn = await this.createConnection();
          newConn.inUse = true;
          return newConn;
        } catch (error) {
          logger.error('[Pool] Failed to create new connection:', error);
        }
      }

      // Wait for a connection to become available
      await new Promise<void>(resolve => {
        const timeoutId = setTimeout(() => {
          const index = this.waitingQueue.indexOf(resolve as any);
          if (index > -1) {
            this.waitingQueue.splice(index, 1);
          }
          resolve();
        }, 1000);

        this.waitingQueue.push(conn => {
          clearTimeout(timeoutId);
          resolve();
        });
      });
    }

    throw new Error(`Failed to acquire connection within ${this.options.acquireTimeout}ms`);
  }

  public release(connectionId: string): void {
    const connection = this.pool.get(connectionId);
    if (!connection) {
      logger.warn(`[Pool] Attempted to release unknown connection: ${connectionId}`);
      return;
    }

    connection.inUse = false;
    connection.lastUsed = new Date();
    logger.debug(`[Pool] Released connection: ${connectionId}`);

    // Notify waiting requests
    const waiter = this.waitingQueue.shift();
    if (waiter) {
      waiter(connection);
    }

    this.emit('connectionReleased', connectionId);
  }

  private isConnectionHealthy(connection: PooledConnection): boolean {
    const now = Date.now();
    const age = now - connection.createdAt.getTime();
    const idleTime = now - connection.lastUsed.getTime();

    // Check if connection is too old
    if (age > this.options.connectionTTL) {
      logger.debug(`[Pool] Connection ${connection.id} exceeded TTL`);
      return false;
    }

    // Check if connection has been idle too long
    if (idleTime > this.options.idleTimeout) {
      logger.debug(`[Pool] Connection ${connection.id} exceeded idle timeout`);
      return false;
    }

    return true;
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.pool.get(connectionId);
    if (!connection) return;

    // Clear keep-alive timer
    if (connection.keepAliveTimer) {
      clearInterval(connection.keepAliveTimer);
    }

    // Close FTP connection
    try {
      connection.client.close();
    } catch (error) {
      logger.warn(`[Pool] Error closing connection ${connectionId}:`, error);
    }

    // Remove from pool
    this.pool.delete(connectionId);
    logger.info(`[Pool] Removed connection: ${connectionId}`);

    this.emit('connectionRemoved', connectionId);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const connectionsToRemove: string[] = [];

      for (const [id, conn] of this.pool) {
        if (!conn.inUse && !this.isConnectionHealthy(conn)) {
          connectionsToRemove.push(id);
        }
      }

      // Remove unhealthy connections
      for (const id of connectionsToRemove) {
        await this.removeConnection(id);
      }

      // Ensure minimum connections
      while (this.pool.size < this.options.minConnections && !this.isShuttingDown) {
        try {
          await this.createConnection();
        } catch (error) {
          logger.warn('[Pool] Failed to maintain minimum connections:', error);
          break;
        }
      }

      logger.debug(`[Pool] Cleanup complete. Active connections: ${this.pool.size}`);
    }, 30000); // Run cleanup every 30 seconds
  }

  public async shutdown(): Promise<void> {
    logger.info('[Pool] Shutting down connection pool...');
    this.isShuttingDown = true;

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Clear all keep-alive timers and close connections
    const closePromises: Promise<void>[] = [];
    for (const [id, conn] of this.pool) {
      closePromises.push(this.removeConnection(id));
    }

    await Promise.all(closePromises);

    // Clear waiting queue
    this.waitingQueue.forEach(waiter => waiter(null));
    this.waitingQueue = [];

    logger.info('[Pool] Connection pool shutdown complete');
  }

  public getStats() {
    const connections = Array.from(this.pool.values());
    return {
      total: this.pool.size,
      inUse: connections.filter(c => c.inUse).length,
      idle: connections.filter(c => !c.inUse).length,
      waiting: this.waitingQueue.length,
      connections: connections.map(c => ({
        id: c.id,
        inUse: c.inUse,
        age: Date.now() - c.createdAt.getTime(),
        idleTime: Date.now() - c.lastUsed.getTime(),
      })),
    };
  }
}

// Singleton instance
export const ftpConnectionPool = new FTPConnectionPool();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await ftpConnectionPool.shutdown();
});

process.on('SIGINT', async () => {
  await ftpConnectionPool.shutdown();
});
