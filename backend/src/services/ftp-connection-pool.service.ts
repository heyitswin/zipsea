import * as ftp from 'basic-ftp';
import { slackService } from './slack.service';

interface ConnectionPoolOptions {
  maxConnections: number;
  minConnections: number;
  connectionTTL: number;
  idleTimeout: number;
  keepAliveInterval: number;
  ftpConfig: {
    host: string;
    user: string;
    password: string;
    secure: boolean;
    timeout?: number;
  };
}

interface PooledConnection {
  client: ftp.Client;
  id: string;
  createdAt: Date;
  lastUsed: Date;
  inUse: boolean;
  keepAliveTimer?: NodeJS.Timeout;
}

export class FTPConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private connectionQueue: ((conn: PooledConnection) => void)[] = [];
  private options: ConnectionPoolOptions;
  private isShuttingDown = false;
  private maintenanceTimer?: NodeJS.Timeout;

  constructor(options: Partial<ConnectionPoolOptions> = {}) {
    this.options = {
      maxConnections: options.maxConnections || 3,
      minConnections: options.minConnections || 1,
      connectionTTL: options.connectionTTL || 10 * 60 * 1000, // 10 minutes
      idleTimeout: options.idleTimeout || 2 * 60 * 1000, // 2 minutes
      keepAliveInterval: options.keepAliveInterval || 30 * 1000, // 30 seconds
      ftpConfig: options.ftpConfig || {
        host: process.env.FTP_HOST!,
        user: process.env.FTP_USER!,
        password: process.env.FTP_PASSWORD!,
        secure: false,
        timeout: 60000,
      },
    };

    this.initialize();
  }

  private async initialize() {
    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      await this.createConnection();
    }

    // Start maintenance timer
    this.maintenanceTimer = setInterval(() => this.performMaintenance(), 30000);
  }

  private async createConnection(): Promise<PooledConnection | null> {
    if (this.connections.size >= this.options.maxConnections) {
      return null;
    }

    try {
      const client = new ftp.Client();
      client.ftp.verbose = false;

      await client.access(this.options.ftpConfig);

      const connection: PooledConnection = {
        client,
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        lastUsed: new Date(),
        inUse: false,
      };

      // Set up keep-alive
      connection.keepAliveTimer = setInterval(async () => {
        if (!connection.inUse) {
          try {
            await client.pwd(); // Simple command to keep connection alive
          } catch (error) {
            console.error(`Keep-alive failed for connection ${connection.id}`);
            this.removeConnection(connection.id);
          }
        }
      }, this.options.keepAliveInterval);

      this.connections.set(connection.id, connection);
      return connection;
    } catch (error) {
      console.error('Failed to create FTP connection:', error);
      await slackService.sendError('Failed to create FTP connection', error as Error);
      return null;
    }
  }

  async getConnection(): Promise<PooledConnection> {
    // Find available connection
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = new Date();
        return conn;
      }
    }

    // Try to create new connection if under limit
    if (this.connections.size < this.options.maxConnections) {
      const newConn = await this.createConnection();
      if (newConn) {
        newConn.inUse = true;
        return newConn;
      }
    }

    // Wait for available connection
    return new Promise((resolve) => {
      this.connectionQueue.push(resolve);
    });
  }

  releaseConnection(connectionId: string) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.inUse = false;
    conn.lastUsed = new Date();

    // Check if anyone is waiting
    const waiter = this.connectionQueue.shift();
    if (waiter) {
      conn.inUse = true;
      waiter(conn);
    }
  }

  private async removeConnection(connectionId: string) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    if (conn.keepAliveTimer) {
      clearInterval(conn.keepAliveTimer);
    }

    try {
      conn.client.close();
    } catch (error) {
      console.error(`Error closing connection ${connectionId}:`, error);
    }

    this.connections.delete(connectionId);
  }

  private async performMaintenance() {
    if (this.isShuttingDown) return;

    const now = Date.now();

    for (const [id, conn] of this.connections.entries()) {
      // Remove old connections
      if (now - conn.createdAt.getTime() > this.options.connectionTTL) {
        if (!conn.inUse) {
          await this.removeConnection(id);
          continue;
        }
      }

      // Remove idle connections (keep minimum)
      if (this.connections.size > this.options.minConnections) {
        if (!conn.inUse && now - conn.lastUsed.getTime() > this.options.idleTimeout) {
          await this.removeConnection(id);
        }
      }
    }

    // Ensure minimum connections
    while (this.connections.size < this.options.minConnections && !this.isShuttingDown) {
      await this.createConnection();
    }
  }

  async shutdown() {
    this.isShuttingDown = true;

    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    // Close all connections
    for (const id of this.connections.keys()) {
      await this.removeConnection(id);
    }

    // Clear queue
    this.connectionQueue = [];
  }

  getStats() {
    const connections = Array.from(this.connections.values());
    return {
      total: connections.length,
      inUse: connections.filter(c => c.inUse).length,
      idle: connections.filter(c => !c.inUse).length,
      queueLength: this.connectionQueue.length,
      connections: connections.map(c => ({
        id: c.id,
        inUse: c.inUse,
        age: Date.now() - c.createdAt.getTime(),
        idleTime: c.inUse ? 0 : Date.now() - c.lastUsed.getTime(),
      })),
    };
  }
}

export const ftpConnectionPool = new FTPConnectionPool();
