import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { testConnection, closeConnection } from '../src/db/connection';
import redisClient from '../src/cache/redis';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Connect to test database
  const isConnected = await testConnection();
  if (!isConnected) {
    throw new Error('Failed to connect to test database');
  }
  
  // Connect to Redis
  try {
    await redisClient.connect();
  } catch (error) {
    console.warn('Redis connection failed in tests:', error);
  }
});

// Global test teardown
afterAll(async () => {
  // Close database connection
  await closeConnection();
  
  // Close Redis connection
  try {
    await redisClient.disconnect();
  } catch (error) {
    console.warn('Redis disconnection failed in tests:', error);
  }
});

// Test isolation
beforeEach(async () => {
  // Clear Redis cache before each test
  try {
    await redisClient.flushAll();
  } catch (error) {
    // Redis may not be available in CI
  }
});

afterEach(async () => {
  // Additional cleanup if needed
});

// Mock implementations for external services
jest.mock('../src/services/traveltek/ftp-client', () => ({
  FtpClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    downloadFile: jest.fn().mockResolvedValue('{}'),
    listFiles: jest.fn().mockResolvedValue([]),
  })),
}));

// Increase test timeout for integration tests
jest.setTimeout(30000);