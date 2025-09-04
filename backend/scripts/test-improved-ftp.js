/**
 * Test script for improved FTP service
 * 
 * This script tests the new FTP service with:
 * - Connection pooling
 * - Circuit breaker pattern  
 * - Rate limiting
 * - Better error handling
 */

const { improvedFTPService } = require('../dist/services/improved-ftp.service');
const logger = require('../dist/config/logger').logger;

async function testImprovedFTP() {
  logger.info('🧪 Testing improved FTP service...');
  
  try {
    // Test 1: Health Check
    logger.info('1. Testing FTP health check...');
    const healthCheck = await improvedFTPService.healthCheck();
    logger.info('Health check result:', healthCheck);
    
    if (!healthCheck.connected) {
      logger.error('❌ FTP health check failed:', healthCheck.error);
      return;
    }
    
    // Test 2: Single file download
    logger.info('2. Testing single file download...');
    try {
      // Try to download a test file (this will likely fail but we want to see the error handling)
      const testFilePath = '2024/01/3/123/test.json';
      const fileData = await improvedFTPService.getCruiseDataFile(testFilePath);
      logger.info('File download succeeded:', testFilePath);
    } catch (error) {
      logger.info('File download failed (expected):', error.message);
    }
    
    // Test 3: Multiple concurrent requests to test pooling
    logger.info('3. Testing concurrent requests (connection pooling)...');
    const testPaths = [
      '2024/01/3/123/test1.json',
      '2024/01/3/123/test2.json',
      '2024/01/3/123/test3.json',
      '2024/01/5/456/test4.json',
      '2024/01/5/456/test5.json'
    ];
    
    const promises = testPaths.map(path => 
      improvedFTPService.getCruiseDataFile(path).catch(err => ({
        error: err.message,
        path
      }))
    );
    
    const results = await Promise.all(promises);
    logger.info('Concurrent requests completed:', results.length);
    
    // Test 4: Get service stats
    logger.info('4. Getting service statistics...');
    const stats = improvedFTPService.getStats();
    logger.info('FTP Service stats:', {
      circuitBreakers: Object.keys(stats.circuitBreakers).length,
      queueLength: stats.queueLength,
      activeRequests: stats.activeRequests
    });
    
    // Test 5: Final health check
    logger.info('5. Final health check...');
    const finalHealth = await improvedFTPService.healthCheck();
    logger.info('Final health status:', {
      connected: finalHealth.connected,
      circuitBreakerCount: Object.keys(finalHealth.circuitStatus).length,
      queueStatus: finalHealth.queueStatus
    });
    
    logger.info('✅ FTP service test completed successfully');
    
  } catch (error) {
    logger.error('❌ FTP service test failed:', error);
  }
  
  // Exit after a short delay to allow logs to flush
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

// Run the test
testImprovedFTP();