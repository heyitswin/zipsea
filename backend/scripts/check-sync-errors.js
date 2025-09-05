#!/usr/bin/env node

/**
 * Check sync errors and diagnose issues
 * Run this on Render to see what's failing
 */

const fs = require('fs');
const path = require('path');

console.log('📋 Checking Sync Errors and Status');
console.log('==================================\n');

// Check error log
const errorLogPath = './sync-errors.log';
if (fs.existsSync(errorLogPath)) {
  console.log('📄 Error Log Contents:');
  console.log('-'.repeat(50));
  const errors = fs.readFileSync(errorLogPath, 'utf8');

  // Get last 20 lines for recent errors
  const lines = errors.split('\n').filter(l => l.trim());
  const recentErrors = lines.slice(-20);

  console.log('Recent errors (last 20):');
  recentErrors.forEach(line => console.log(line));

  // Analyze error patterns
  console.log('\n📊 Error Analysis:');
  console.log('-'.repeat(50));

  const errorTypes = {};
  lines.forEach(line => {
    if (line.includes('ECONNREFUSED')) errorTypes['Connection Refused'] = (errorTypes['Connection Refused'] || 0) + 1;
    if (line.includes('ETIMEDOUT')) errorTypes['Timeout'] = (errorTypes['Timeout'] || 0) + 1;
    if (line.includes('ENOTFOUND')) errorTypes['Host Not Found'] = (errorTypes['Host Not Found'] || 0) + 1;
    if (line.includes('parse')) errorTypes['JSON Parse Error'] = (errorTypes['JSON Parse Error'] || 0) + 1;
    if (line.includes('530')) errorTypes['FTP Login Failed (530)'] = (errorTypes['FTP Login Failed (530)'] || 0) + 1;
    if (line.includes('550')) errorTypes['FTP File Not Found (550)'] = (errorTypes['FTP File Not Found (550)'] || 0) + 1;
    if (line.includes('Cannot read properties')) errorTypes['Data Structure Error'] = (errorTypes['Data Structure Error'] || 0) + 1;
  });

  Object.entries(errorTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} occurrences`);
  });

} else {
  console.log('❌ No error log found at ./sync-errors.log');
}

// Check checkpoint
console.log('\n📍 Checkpoint Status:');
console.log('-'.repeat(50));

const checkpointPath = './sync-checkpoint.json';
if (fs.existsSync(checkpointPath)) {
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));

  console.log(`Last processed month: ${checkpoint.lastProcessedMonth || 'None'}`);
  console.log(`Files processed: ${checkpoint.totalFilesProcessed || 0}`);
  console.log(`Total errors: ${checkpoint.errors ? checkpoint.errors.length : 0}`);

  if (checkpoint.errors && checkpoint.errors.length > 0) {
    console.log('\n🔍 Sample errors from checkpoint (last 5):');
    const sampleErrors = checkpoint.errors.slice(-5);
    sampleErrors.forEach(err => {
      console.log(`  ${err.time}: ${err.file}`);
      console.log(`    Error: ${err.error}`);
    });
  }
} else {
  console.log('No checkpoint file found');
}

// Check FTP credentials
console.log('\n🔑 Environment Variables Check:');
console.log('-'.repeat(50));

const ftpHost = process.env.TRAVELTEK_FTP_HOST;
const ftpUser = process.env.TRAVELTEK_FTP_USER;
const ftpPass = process.env.TRAVELTEK_FTP_PASSWORD;
const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

console.log(`FTP Host: ${ftpHost ? '✅ Set' : '❌ NOT SET'} ${ftpHost ? `(${ftpHost})` : ''}`);
console.log(`FTP User: ${ftpUser ? '✅ Set' : '❌ NOT SET'} ${ftpUser ? `(${ftpUser.substring(0, 3)}***)` : ''}`);
console.log(`FTP Pass: ${ftpPass ? '✅ Set' : '❌ NOT SET'} ${ftpPass ? '(***hidden***)' : ''}`);
console.log(`Database: ${dbUrl ? '✅ Set' : '❌ NOT SET'}`);

// Quick FTP test
console.log('\n🔌 Testing FTP Connection:');
console.log('-'.repeat(50));

const ftp = require('basic-ftp');

async function testFtp() {
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enable verbose logging

  try {
    await client.access({
      host: ftpHost || 'ftpeu1prod.traveltek.net',
      user: ftpUser,
      password: ftpPass,
      secure: false,
      timeout: 10000
    });

    console.log('✅ FTP connection successful!');

    // Try to list root directory
    const list = await client.list('/');
    console.log(`📁 Root directory has ${list.length} items`);

    // Check if 2025 directory exists
    const has2025 = list.some(item => item.name === '2025');
    console.log(`📅 2025 directory: ${has2025 ? '✅ Exists' : '❌ Not found'}`);

    if (has2025) {
      const list2025 = await client.list('/2025');
      console.log(`📁 /2025 has ${list2025.length} items`);

      const has09 = list2025.some(item => item.name === '09');
      console.log(`📅 /2025/09 directory: ${has09 ? '✅ Exists' : '❌ Not found'}`);

      if (has09) {
        const list09 = await client.list('/2025/09');
        console.log(`📁 /2025/09 has ${list09.length} cruise lines`);

        // Sample first cruise line
        if (list09.length > 0 && list09[0].type === 2) {
          const firstLine = list09[0].name;
          const lineList = await client.list(`/2025/09/${firstLine}`);
          console.log(`📁 Line ${firstLine} has ${lineList.length} ships`);
        }
      }
    }

  } catch (error) {
    console.error('❌ FTP connection failed:', error.message);
    if (error.code) console.error('   Error code:', error.code);
    console.error('\n🔍 Full error details:');
    console.error(error);
  } finally {
    await client.close();
  }
}

testFtp().then(() => {
  console.log('\n✅ Diagnostics complete');

  console.log('\n📋 Recommendations:');
  if (!ftpUser || !ftpPass) {
    console.log('1. ❌ FTP credentials are missing! Set TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD');
  }
  console.log('2. Check the error patterns above to identify the main issue');
  console.log('3. If connection issues, verify FTP credentials and network access');
  console.log('4. If parse errors, may need to handle different data formats');
  console.log('5. To view full error log: cat sync-errors.log');
  console.log('6. To clear and restart: rm sync-checkpoint.json sync-errors.log');
});
