/**
 * Improved FTP Service with Connection Pooling and Circuit Breaker
 * 
 * This service addresses the critical FTP issues:
 * - Uses connection pooling to avoid overwhelming FTP server
 * - Implements circuit breaker pattern for failing connections
 * - Better error handling and reporting
 * - Rate limiting to prevent 100% failure rates
 */

import { logger } from '../config/logger';
import { env } from '../config/environment';
import Client = require('ftp');

// Simple connection pool without the complex pool service
interface SimplePooledConnection {
  client: Client;
  inUse: boolean;
  lastUsed: Date;
  id: number;
}

export interface FTPCircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
  halfOpenAttempts: number;
}

export class ImprovedFTPService {
  private circuitBreakers = new Map<string, FTPCircuitBreakerState>();
  private readonly FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
  private readonly RESET_TIMEOUT = 60000; // Reset after 1 minute
  private readonly HALF_OPEN_MAX_ATTEMPTS = 3;
  
  // Simple connection pool
  private connectionPool: SimplePooledConnection[] = [];
  private readonly MAX_POOL_SIZE = 3; // Keep it small to avoid overwhelming FTP
  private connectionCounter = 0;
  
  // Rate limiting
  private requestQueue: Array<{ resolve: Function; reject: Function; operation: Function }> = [];
  private activeRequests = 0;
  private readonly MAX_CONCURRENT_REQUESTS = 3; // Reduced from 5
  private readonly REQUEST_DELAY = 500; // Increased to 500ms between requests
  
  constructor() {
    this.processQueue();
    // Cleanup idle connections
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  /**
   * Get cruise data file with circuit breaker and pooling
   */
  async getCruiseDataFile(filePath: string): Promise<any> {
    const operation = async () => {
      return await this.executeWithCircuitBreaker('ftp-main', async () => {
        const client = await this.getConnection();
        
        try {
          logger.debug(`🔄 Fetching FTP file: ${filePath}`);
          
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.releaseConnection(client);
              reject(new Error(`FTP timeout after 30s for file: ${filePath}`));
            }, 30000);

            client.get(filePath, (err, stream) => {
              clearTimeout(timeout);
              
              if (err) {
                this.releaseConnection(client);
                logger.error(`❌ FTP get error for ${filePath}:`, {
                  error: err.message,
                  code: err.code,
                  filePath
                });
                reject(new Error(`FTP error: ${err.message} (${err.code || 'unknown'})`));
                return;
              }

              let data = '';
              let dataReceived = false;

              stream.on('data', (chunk: Buffer) => {
                dataReceived = true;
                data += chunk.toString();
              });

              stream.on('end', () => {
                this.releaseConnection(client);
                
                if (!dataReceived) {
                  reject(new Error(`No data received for file: ${filePath}`));
                  return;
                }
                
                try {
                  const jsonData = JSON.parse(data);
                  logger.debug(`✅ Successfully fetched FTP file: ${filePath} (${data.length} bytes)`);
                  resolve(jsonData);
                } catch (parseError) {
                  reject(new Error(`JSON parse error for ${filePath}: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`));
                }
              });

              stream.on('error', (streamError) => {
                this.releaseConnection(client);
                reject(new Error(`Stream error for ${filePath}: ${streamError instanceof Error ? streamError.message : 'Stream error'}`));
              });
            });
          });
        } catch (error) {
          this.releaseConnection(client);
          throw error;
        }
      });
    };

    return this.queueRequest(operation);
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  private async executeWithCircuitBreaker<T>(
    circuitName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitName);
    const now = Date.now();

    // Check if circuit is open
    if (circuit.isOpen) {
      if (now - circuit.lastFailureTime > this.RESET_TIMEOUT) {
        // Try to reset to half-open
        circuit.isOpen = false;
        circuit.halfOpenAttempts = 0;
        logger.info(`🔄 Circuit breaker ${circuitName} reset to half-open`);
      } else {
        throw new Error(`Circuit breaker ${circuitName} is OPEN - FTP service temporarily unavailable`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit if it was failing
      if (circuit.failureCount > 0) {
        circuit.failureCount = 0;
        circuit.halfOpenAttempts = 0;
        logger.info(`✅ Circuit breaker ${circuitName} reset after successful operation`);
      }
      
      return result;
    } catch (error) {
      circuit.failureCount++;
      circuit.lastFailureTime = now;
      
      logger.warn(`⚠️ Circuit breaker ${circuitName} failure ${circuit.failureCount}/${this.FAILURE_THRESHOLD}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Check if we should open the circuit
      if (circuit.failureCount >= this.FAILURE_THRESHOLD) {
        circuit.isOpen = true;
        logger.error(`🚨 Circuit breaker ${circuitName} OPENED after ${circuit.failureCount} failures`);
      }
      
      throw error;
    }
  }

  /**
   * Queue requests to avoid overwhelming FTP server
   */
  private queueRequest<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, operation });
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    setInterval(async () => {
      if (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
        const request = this.requestQueue.shift();
        if (request) {
          this.activeRequests++;
          
          try {
            const result = await request.operation();
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          } finally {
            this.activeRequests--;
          }
        }
      }
    }, this.REQUEST_DELAY);
  }

  /**
   * Get or create circuit breaker state
   */
  private getOrCreateCircuit(name: string): FTPCircuitBreakerState {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, {
        failureCount: 0,
        lastFailureTime: 0,
        isOpen: false,
        halfOpenAttempts: 0
      });
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Health check with detailed status
   */
  async healthCheck(): Promise<{
    connected: boolean;
    circuitStatus: Record<string, any>;
    queueStatus: { pending: number; active: number };
    error?: string;
  }> {
    try {
      // Try a simple operation
      await this.executeWithCircuitBreaker('health-check', async () => {
        const client = await this.getConnection();
        try {
          // Just check if we can list root directory
          return new Promise((resolve, reject) => {
            client.list('.', (err, list) => {
              this.releaseConnection(client);
              if (err) reject(err);
              else resolve(list);
            });
          });
        } catch (error) {
          this.releaseConnection(client);
          throw error;
        }
      });

      const circuitStatus: Record<string, any> = {};
      for (const [name, state] of this.circuitBreakers.entries()) {
        circuitStatus[name] = {
          isOpen: state.isOpen,
          failureCount: state.failureCount,
          lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime).toISOString() : null
        };
      }

      return {
        connected: true,
        circuitStatus,
        queueStatus: {
          pending: this.requestQueue.length,
          active: this.activeRequests
        }
      };
    } catch (error) {
      const circuitStatus: Record<string, any> = {};
      for (const [name, state] of this.circuitBreakers.entries()) {
        circuitStatus[name] = {
          isOpen: state.isOpen,
          failureCount: state.failureCount,
          lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime).toISOString() : null
        };
      }

      return {
        connected: false,
        circuitStatus,
        queueStatus: {
          pending: this.requestQueue.length,
          active: this.activeRequests
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  resetCircuitBreaker(circuitName: string): boolean {
    const circuit = this.circuitBreakers.get(circuitName);
    if (circuit) {
      circuit.failureCount = 0;
      circuit.isOpen = false;
      circuit.halfOpenAttempts = 0;
      circuit.lastFailureTime = 0;
      logger.info(`🔄 Manually reset circuit breaker: ${circuitName}`);
      return true;
    }
    return false;
  }

  /**
   * Get current statistics
   */
  getStats(): {
    circuitBreakers: Record<string, FTPCircuitBreakerState>;
    queueLength: number;
    activeRequests: number;
  } {
    const circuits: Record<string, FTPCircuitBreakerState> = {};
    for (const [name, state] of this.circuitBreakers.entries()) {
      circuits[name] = { ...state };
    }

    return {
      circuitBreakers: circuits,
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests
    };
  }

  /**
   * Get FTP connection from pool
   */
  private async getConnection(): Promise<Client> {
    // Try to find available connection
    const available = this.connectionPool.find(conn => !conn.inUse);
    
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      logger.debug(`♻️ Reusing FTP connection #${available.id}`);
      return available.client;
    }

    // Create new connection if pool not full
    if (this.connectionPool.length < this.MAX_POOL_SIZE) {
      const client = await this.createConnection();
      const connection: SimplePooledConnection = {
        client,
        inUse: true,
        lastUsed: new Date(),
        id: ++this.connectionCounter
      };
      this.connectionPool.push(connection);
      logger.info(`🔗 Created new FTP connection #${connection.id} (pool size: ${this.connectionPool.length})`);
      return client;
    }

    // Wait for available connection (simple approach)
    logger.warn('⏳ FTP pool exhausted, waiting for connection...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const conn = this.connectionPool.find(c => !c.inUse);
        if (conn) {
          clearInterval(checkInterval);
          conn.inUse = true;
          conn.lastUsed = new Date();
          logger.debug(`♻️ Got available FTP connection #${conn.id}`);
          resolve(conn.client);
        }
      }, 100);
    });
  }

  /**
   * Release connection back to pool
   */
  private releaseConnection(client: Client): void {
    const connection = this.connectionPool.find(conn => conn.client === client);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();
      logger.debug(`📤 Released FTP connection #${connection.id}`);
    }
  }

  /**
   * Create new FTP connection
   */
  private async createConnection(): Promise<Client> {
    if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
      const missingCreds = [];
      if (!env.TRAVELTEK_FTP_HOST) missingCreds.push('TRAVELTEK_FTP_HOST');
      if (!env.TRAVELTEK_FTP_USER) missingCreds.push('TRAVELTEK_FTP_USER');
      if (!env.TRAVELTEK_FTP_PASSWORD) missingCreds.push('TRAVELTEK_FTP_PASSWORD');
      
      throw new Error(`Missing FTP credentials: ${missingCreds.join(', ')}`);
    }

    const client = new Client();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('FTP connection timeout'));
      }, 30000);

      client.on('ready', () => {
        clearTimeout(timeout);
        logger.debug('✅ FTP connection established');
        resolve(client);
      });

      client.on('error', (err: any) => {
        clearTimeout(timeout);
        logger.error('❌ FTP connection error:', {
          message: err.message,
          code: err.code
        });
        reject(err);
      });

      try {
        client.connect({
          host: env.TRAVELTEK_FTP_HOST,
          user: env.TRAVELTEK_FTP_USER,
          password: env.TRAVELTEK_FTP_PASSWORD,
          connTimeout: 30000,
          pasvTimeout: 30000,
          keepalive: 30000
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const toRemove: number[] = [];

    for (let i = 0; i < this.connectionPool.length; i++) {
      const conn = this.connectionPool[i];
      if (!conn.inUse && (now - conn.lastUsed.getTime()) > IDLE_TIMEOUT) {
        try {
          conn.client.end();
          toRemove.push(i);
          logger.debug(`🧹 Closed idle FTP connection #${conn.id}`);
        } catch (error) {
          logger.error(`Error closing idle connection #${conn.id}:`, error);
        }
      }
    }

    // Remove closed connections
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.connectionPool.splice(toRemove[i], 1);
    }

    if (toRemove.length > 0) {
      logger.info(`🧹 Cleaned up ${toRemove.length} idle FTP connections (pool size: ${this.connectionPool.length})`);
    }
  }
}

// Export singleton instance
export const improvedFTPService = new ImprovedFTPService();