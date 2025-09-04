#!/usr/bin/env node

/**
 * RENDER FTP CREDENTIAL DIAGNOSTIC SCRIPT (JavaScript version)
 *
 * This script is specifically designed to run on Render to diagnose
 * FTP credential loading issues in the production environment.
 *
 * Usage on Render:
 *   Add to package.json scripts:
 *   "render-ftp-diagnostic": "node scripts/render-ftp-diagnostic.js"
 *
 *   Then run via Render shell or manual deployment:
 *   npm run script:render-ftp-diagnostic
 */

const ftp = require('basic-ftp');

// Simple logger for production environment
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args)
};

async function testFtpConnection(host, user, password) {
  const startTime = Date.now();

  try {
    logger.info('🔌 Testing actual FTP connection...');

    const client = new ftp.Client();
    client.ftp.verbose = false;

    // Set short timeout for quick diagnostic
    const connectPromise = client.access({
      host,
      user,
      password,
      secure: false
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000);
    });

    await Promise.race([connectPromise, timeoutPromise]);

    // Test basic operation
    await client.pwd();

    await client.close();

    const duration = Date.now() - startTime;
    logger.info(`✅ FTP connection successful in ${duration}ms`);

    return { success: true, duration };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ FTP connection failed after ${duration}ms: ${errorMsg}`);

    return { success: false, error: errorMsg, duration };
  }
}

async function runRenderFtpDiagnostic() {
  logger.info('🚀 RENDER FTP CREDENTIAL DIAGNOSTIC');
  logger.info('=====================================');

  const result = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'undefined',
    credentialsFound: {
      host: false,
      user: false,
      password: false
    },
    credentialDetails: {},
    renderInfo: {
      nodeEnv: process.env.NODE_ENV || 'undefined',
      renderServiceName: process.env.RENDER_SERVICE_NAME,
      renderCommitSha: process.env.RENDER_GIT_COMMIT
    }
  };

  // Check Render-specific environment info
  logger.info('\n🏗️ RENDER ENVIRONMENT INFO:');
  logger.info(`Service Name: ${result.renderInfo.renderServiceName || 'NOT SET'}`);
  logger.info(`Commit SHA: ${result.renderInfo.renderCommitSha || 'NOT SET'}`);
  logger.info(`NODE_ENV: ${result.renderInfo.nodeEnv}`);
  logger.info(`Is Render: ${process.env.RENDER ? 'YES' : 'NO'}`);

  // Check all environment variables that might be relevant
  logger.info('\n🔍 ENVIRONMENT VARIABLE SCAN:');
  const envKeys = Object.keys(process.env);
  const ftpRelatedKeys = envKeys.filter(key =>
    key.toLowerCase().includes('ftp') ||
    key.toLowerCase().includes('traveltek') ||
    key.toLowerCase().includes('host') ||
    key.toLowerCase().includes('user') ||
    key.toLowerCase().includes('password')
  );

  logger.info(`Total env vars: ${envKeys.length}`);
  logger.info(`FTP-related env vars: ${ftpRelatedKeys.length}`);
  if (ftpRelatedKeys.length > 0) {
    logger.info('FTP-related keys found:', ftpRelatedKeys.join(', '));
  }

  // Check specific FTP credentials
  logger.info('\n📋 FTP CREDENTIAL CHECK:');

  // Host
  if (process.env.TRAVELTEK_FTP_HOST) {
    result.credentialsFound.host = true;
    result.credentialDetails.hostLength = process.env.TRAVELTEK_FTP_HOST.length;
    result.credentialDetails.hostPreview = process.env.TRAVELTEK_FTP_HOST.substring(0, 15) + '***';
    logger.info(`✅ TRAVELTEK_FTP_HOST: SET (length: ${result.credentialDetails.hostLength})`);
    logger.info(`   Preview: ${result.credentialDetails.hostPreview}`);
  } else {
    logger.info('❌ TRAVELTEK_FTP_HOST: MISSING');
  }

  // User
  if (process.env.TRAVELTEK_FTP_USER) {
    result.credentialsFound.user = true;
    result.credentialDetails.userLength = process.env.TRAVELTEK_FTP_USER.length;
    result.credentialDetails.userPreview = process.env.TRAVELTEK_FTP_USER.substring(0, 8) + '***';
    logger.info(`✅ TRAVELTEK_FTP_USER: SET (length: ${result.credentialDetails.userLength})`);
    logger.info(`   Preview: ${result.credentialDetails.userPreview}`);
  } else {
    logger.info('❌ TRAVELTEK_FTP_USER: MISSING');
  }

  // Password
  if (process.env.TRAVELTEK_FTP_PASSWORD) {
    result.credentialsFound.password = true;
    result.credentialDetails.passwordLength = process.env.TRAVELTEK_FTP_PASSWORD.length;
    logger.info(`✅ TRAVELTEK_FTP_PASSWORD: SET (length: ${result.credentialDetails.passwordLength})`);
  } else {
    logger.info('❌ TRAVELTEK_FTP_PASSWORD: MISSING');
  }

  // Attempt actual FTP connection if all credentials are present
  if (result.credentialsFound.host && result.credentialsFound.user && result.credentialsFound.password) {
    logger.info('\n🔌 ATTEMPTING ACTUAL FTP CONNECTION TEST:');
    result.connectionTest = await testFtpConnection(
      process.env.TRAVELTEK_FTP_HOST,
      process.env.TRAVELTEK_FTP_USER,
      process.env.TRAVELTEK_FTP_PASSWORD
    );
  } else {
    logger.info('\n❌ SKIPPING FTP CONNECTION TEST: Missing credentials');
  }

  // Final diagnosis
  logger.info('\n🎯 FINAL DIAGNOSIS:');
  const allCredentialsPresent = result.credentialsFound.host && result.credentialsFound.user && result.credentialsFound.password;

  if (!allCredentialsPresent) {
    logger.info('❌ CRITICAL: FTP credentials are MISSING from Render environment');
    logger.info('❌ This explains the "FTP connection failed (control socket)" errors');
    logger.info('');
    logger.info('🔧 SOLUTION:');
    logger.info('   1. Go to Render Dashboard → Your Backend Service → Environment');
    logger.info('   2. Add these exact environment variables:');
    logger.info('      TRAVELTEK_FTP_HOST=<ftp-server-address>');
    logger.info('      TRAVELTEK_FTP_USER=<ftp-username>');
    logger.info('      TRAVELTEK_FTP_PASSWORD=<ftp-password>');
    logger.info('   3. Redeploy the service');
    logger.info('');
    logger.info('⚠️ NOTE: The user says the credentials ARE in Render, but this diagnostic');
    logger.info('         shows they are NOT loading into the application. Check:');
    logger.info('         - Variable names are exactly correct (case-sensitive)');
    logger.info('         - No extra spaces in variable names or values');
    logger.info('         - Variables are added to the correct service');

  } else if (result.connectionTest && !result.connectionTest.success) {
    logger.info('⚠️ CREDENTIALS FOUND but FTP CONNECTION FAILED');
    logger.info('   This suggests the credentials are incorrect or there are network issues');
    logger.info(`   Error: ${result.connectionTest.error}`);
    logger.info('');
    logger.info('🔧 POSSIBLE SOLUTIONS:');
    logger.info('   1. Verify the FTP host address is correct');
    logger.info('   2. Verify the username and password are correct');
    logger.info('   3. Check if the FTP server is accessible from Render\'s network');
    logger.info('   4. Verify if the FTP server requires specific ports or SSL settings');

  } else if (result.connectionTest && result.connectionTest.success) {
    logger.info('✅ EXCELLENT: All credentials found AND FTP connection successful!');
    logger.info('   The FTP setup is working correctly in this environment');
    logger.info('   If there are still issues, they may be intermittent or context-specific');

  } else {
    logger.info('✅ All credentials found, but connection test was not performed');
  }

  logger.info('\n✅ Render FTP diagnostic completed!');

  return result;
}

async function main() {
  try {
    const result = await runRenderFtpDiagnostic();

    // Log summary for easy identification in logs
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 DIAGNOSTIC SUMMARY');
    logger.info('='.repeat(80));
    logger.info(`Environment: ${result.environment}`);
    logger.info(`Timestamp: ${result.timestamp}`);
    logger.info(`Host Credential: ${result.credentialsFound.host ? '✅ FOUND' : '❌ MISSING'}`);
    logger.info(`User Credential: ${result.credentialsFound.user ? '✅ FOUND' : '❌ MISSING'}`);
    logger.info(`Password Credential: ${result.credentialsFound.password ? '✅ FOUND' : '❌ MISSING'}`);

    if (result.connectionTest) {
      logger.info(`FTP Connection Test: ${result.connectionTest.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    return result;

  } catch (error) {
    logger.error('❌ Render FTP diagnostic failed:', error);
    throw error;
  }
}

// Run the diagnostic
main().catch(error => {
  logger.error('Diagnostic failed:', error);
  process.exit(1);
});
