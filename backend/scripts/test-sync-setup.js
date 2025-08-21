#!/usr/bin/env node

/**
 * TEST SYNC SETUP
 * 
 * This script validates that the environment is properly configured
 * for the Traveltek sync and tests all connections before running
 * the actual sync process.
 */

require('dotenv').config();

const CONFIG = {
  ftp: {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  sync: {
    year: process.env.SYNC_YEAR || new Date().getFullYear().toString(),
    month: process.env.SYNC_MONTH || String(new Date().getMonth() + 1).padStart(2, '0'),
  }
};

console.log('🧪 TESTING TRAVELTEK SYNC SETUP');
console.log('================================');
console.log();

// Test 1: Environment Variables
console.log('1. ENVIRONMENT VARIABLES');
console.log('   FTP Host:', CONFIG.ftp.host);
console.log('   FTP User:', CONFIG.ftp.user ? CONFIG.ftp.user.substring(0, 3) + '***' : '❌ NOT SET');
console.log('   FTP Password:', CONFIG.ftp.password ? '✅ SET' : '❌ NOT SET');
console.log('   Database URL:', CONFIG.database.url ? '✅ SET' : '❌ NOT SET');
console.log('   Sync Period:', `${CONFIG.sync.year}/${CONFIG.sync.month}`);
console.log();

// Test 2: Required Dependencies
console.log('2. DEPENDENCIES');
try {
  require('postgres');
  console.log('   postgres: ✅ Available');
} catch {
  console.log('   postgres: ❌ Missing - run: npm install postgres');
}

try {
  require('ftp');
  console.log('   ftp: ✅ Available');
} catch {
  console.log('   ftp: ❌ Missing - run: npm install ftp');
}

try {
  require('dotenv');
  console.log('   dotenv: ✅ Available');
} catch {
  console.log('   dotenv: ❌ Missing - run: npm install dotenv');
}
console.log();

// Test 3: Database Connection
console.log('3. DATABASE CONNECTION');
if (!CONFIG.database.url) {
  console.log('   ❌ Cannot test - DATABASE_URL not set');
} else {
  try {
    const postgres = require('postgres');
    const sql = postgres(CONFIG.database.url, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
      ssl: { rejectUnauthorized: false },
    });
    
    (async () => {
      try {
        await sql`SELECT 1`;
        console.log('   ✅ Database connection successful');
        
        // Test schema
        const schemaTest = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name IN ('cruises', 'cruise_lines', 'ships', 'ports')
        `;
        console.log(`   ✅ Found ${schemaTest.length} required tables`);
        
        await sql.end();
        
        testComplete();
      } catch (error) {
        console.log('   ❌ Database connection failed:', error.message);
        testComplete();
      }
    })();
  } catch (error) {
    console.log('   ❌ Database setup error:', error.message);
    testComplete();
  }
}

// Test 4: FTP Connection
async function testFTP() {
  console.log();
  console.log('4. FTP CONNECTION');
  
  if (!CONFIG.ftp.user || !CONFIG.ftp.password) {
    console.log('   ❌ Cannot test - FTP credentials not set');
    return;
  }
  
  try {
    const Client = require('ftp');
    const client = new Client();
    
    const connected = await new Promise((resolve, reject) => {
      client.on('ready', () => {
        console.log('   ✅ FTP connection successful');
        resolve(true);
      });
      
      client.on('error', (err) => {
        console.log('   ❌ FTP connection failed:', err.message);
        resolve(false);
      });
      
      client.connect({
        host: CONFIG.ftp.host,
        user: CONFIG.ftp.user,
        password: CONFIG.ftp.password,
        connTimeout: 10000,
        pasvTimeout: 10000,
      });
    });
    
    if (connected) {
      // Test directory access
      try {
        const { promisify } = require('util');
        const list = promisify(client.list.bind(client));
        const files = await list('.');
        console.log(`   ✅ Found ${files.length} items in root directory`);
        
        // Test specific year/month access
        try {
          const monthFiles = await list(`${CONFIG.sync.year}/${CONFIG.sync.month}`);
          console.log(`   ✅ Found ${monthFiles.length} items in ${CONFIG.sync.year}/${CONFIG.sync.month}`);
        } catch (monthError) {
          console.log(`   ⚠️  Could not access ${CONFIG.sync.year}/${CONFIG.sync.month}:`, monthError.message);
        }
      } catch (listError) {
        console.log('   ⚠️  Could not list files:', listError.message);
      }
    }
    
    client.end();
  } catch (error) {
    console.log('   ❌ FTP setup error:', error.message);
  }
}

function testComplete() {
  setTimeout(() => {
    testFTP().then(() => {
      console.log();
      console.log('🎯 SETUP TEST COMPLETE');
      console.log('=====================');
      console.log();
      console.log('If all tests passed, you can run the sync with:');
      console.log(`   SYNC_YEAR=${CONFIG.sync.year} SYNC_MONTH=${CONFIG.sync.month} node scripts/sync-traveltek-clean.js`);
      console.log();
      console.log('To run in test mode first (recommended):');
      console.log(`   TEST_MODE=true SYNC_YEAR=${CONFIG.sync.year} SYNC_MONTH=${CONFIG.sync.month} node scripts/sync-traveltek-clean.js`);
      console.log();
    }).catch(error => {
      console.error('Error during FTP test:', error);
    });
  }, 100);
}