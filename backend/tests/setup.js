"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const connection_1 = require("../src/db/connection");
const redis_1 = __importDefault(require("../src/cache/redis"));
// Global test setup
(0, globals_1.beforeAll)(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    // Connect to test database
    const isConnected = await (0, connection_1.testConnection)();
    if (!isConnected) {
        throw new Error('Failed to connect to test database');
    }
    // Connect to Redis
    try {
        await redis_1.default.connect();
    }
    catch (error) {
        console.warn('Redis connection failed in tests:', error);
    }
});
// Global test teardown
(0, globals_1.afterAll)(async () => {
    // Close database connection
    await (0, connection_1.closeConnection)();
    // Close Redis connection
    try {
        await redis_1.default.disconnect();
    }
    catch (error) {
        console.warn('Redis disconnection failed in tests:', error);
    }
});
// Test isolation
(0, globals_1.beforeEach)(async () => {
    // Clear Redis cache before each test
    try {
        await redis_1.default.flushAll();
    }
    catch (error) {
        // Redis may not be available in CI
    }
});
(0, globals_1.afterEach)(async () => {
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
//# sourceMappingURL=setup.js.map