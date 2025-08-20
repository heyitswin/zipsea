#!/usr/bin/env node

/**
 * Detailed FTP Test - Navigate directories and test file download
 * Run this in Render shell to fully test FTP functionality
 */

const FTP = require('ftp');
const path = require('path');

// Manual configuration for testing
const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  secureOptions: { rejectUnauthorized: false },
  connTimeout: 30000,
  pasvTimeout: 30000,
  keepalive: 10000,
  debug: function(msg) {
    console.log('[FTP DEBUG]', msg);
  }
};

console.log('🔬 Detailed Traveltek FTP Test');
console.log('================================');
console.log(`Host: ${ftpConfig.host}`);
console.log(`User: ${ftpConfig.user ? ftpConfig.user.substring(0, 3) + '***' : 'NOT SET'}`);
console.log(`Password: ${ftpConfig.password ? '***SET***' : 'NOT SET'}`);
console.log('');

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found in environment variables');
  process.exit(1);
}

const client = new FTP();
let testResults = {
  connection: false,
  listRoot: false,
  navigateYear: false,
  navigateMonth: false,
  navigateLine: false,
  navigateShip: false,
  listFiles: false,
  downloadFile: false,
  parseJSON: false
};

// Helper function to list directory
async function listDirectory(dirPath) {
  return new Promise((resolve, reject) => {
    client.list(dirPath, (err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list || []);
      }
    });
  });
}

// Helper function to download file content
async function downloadFile(filePath) {
  return new Promise((resolve, reject) => {
    client.get(filePath, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve(data);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  });
}

// Main test function
async function runDetailedTest() {
  try {
    // Step 1: List root directory
    console.log('📁 Step 1: Listing root directory...');
    const rootList = await listDirectory('/');
    testResults.listRoot = true;
    
    const years = rootList.filter(item => 
      item.type === 'd' && /^\d{4}$/.test(item.name)
    ).map(item => item.name).sort();
    
    console.log(`✅ Found ${years.length} year directories: ${years.join(', ')}`);
    
    if (years.length === 0) {
      throw new Error('No year directories found');
    }
    
    // Step 2: Navigate to current or recent year
    const currentYear = new Date().getFullYear().toString();
    const yearToUse = years.includes(currentYear) ? currentYear : years[years.length - 1];
    console.log(`\n📁 Step 2: Navigating to year ${yearToUse}...`);
    
    const yearList = await listDirectory(yearToUse);
    testResults.navigateYear = true;
    
    const months = yearList.filter(item => 
      item.type === 'd' && /^\d{2}$/.test(item.name)
    ).map(item => item.name).sort();
    
    console.log(`✅ Found ${months.length} month directories: ${months.join(', ')}`);
    
    if (months.length === 0) {
      throw new Error(`No month directories found in ${yearToUse}`);
    }
    
    // Step 3: Navigate to a month
    const monthToUse = months[months.length - 1]; // Use most recent month
    const monthPath = `${yearToUse}/${monthToUse}`;
    console.log(`\n📁 Step 3: Navigating to month ${monthPath}...`);
    
    const monthList = await listDirectory(monthPath);
    testResults.navigateMonth = true;
    
    const lineIds = monthList.filter(item => item.type === 'd').map(item => item.name);
    console.log(`✅ Found ${lineIds.length} cruise line directories`);
    if (lineIds.length > 0) {
      console.log(`   First few: ${lineIds.slice(0, 5).join(', ')}`);
    }
    
    if (lineIds.length === 0) {
      throw new Error(`No cruise line directories found in ${monthPath}`);
    }
    
    // Step 4: Navigate to a cruise line
    const lineId = lineIds[0];
    const linePath = `${monthPath}/${lineId}`;
    console.log(`\n📁 Step 4: Navigating to cruise line ${linePath}...`);
    
    const lineList = await listDirectory(linePath);
    testResults.navigateLine = true;
    
    const shipIds = lineList.filter(item => item.type === 'd').map(item => item.name);
    console.log(`✅ Found ${shipIds.length} ship directories`);
    if (shipIds.length > 0) {
      console.log(`   First few: ${shipIds.slice(0, 5).join(', ')}`);
    }
    
    if (shipIds.length === 0) {
      throw new Error(`No ship directories found in ${linePath}`);
    }
    
    // Step 5: Navigate to a ship and list JSON files
    const shipId = shipIds[0];
    const shipPath = `${linePath}/${shipId}`;
    console.log(`\n📁 Step 5: Listing files in ship directory ${shipPath}...`);
    
    const shipList = await listDirectory(shipPath);
    testResults.navigateShip = true;
    
    const jsonFiles = shipList.filter(item => 
      item.type === '-' && item.name.endsWith('.json')
    );
    testResults.listFiles = jsonFiles.length > 0;
    
    console.log(`✅ Found ${jsonFiles.length} JSON files`);
    if (jsonFiles.length > 0) {
      console.log(`   First few: ${jsonFiles.slice(0, 3).map(f => f.name).join(', ')}`);
      console.log(`   File sizes: ${jsonFiles.slice(0, 3).map(f => `${f.name}: ${f.size} bytes`).join(', ')}`);
    }
    
    if (jsonFiles.length === 0) {
      console.log('⚠️  No JSON files found in this directory');
      return testResults;
    }
    
    // Step 6: Try to download and parse a JSON file
    const testFile = jsonFiles[0];
    const filePath = `${shipPath}/${testFile.name}`;
    console.log(`\n📥 Step 6: Downloading test file ${filePath}...`);
    console.log(`   File size: ${testFile.size} bytes`);
    
    const fileContent = await downloadFile(filePath);
    testResults.downloadFile = true;
    console.log(`✅ Downloaded ${fileContent.length} bytes`);
    
    // Step 7: Try to parse as JSON
    console.log(`\n🔍 Step 7: Parsing JSON content...`);
    const jsonData = JSON.parse(fileContent);
    testResults.parseJSON = true;
    
    console.log('✅ Successfully parsed JSON!');
    console.log('📊 Sample data structure:');
    console.log(`   Cruise ID: ${jsonData.cruiseid || 'N/A'}`);
    console.log(`   Name: ${jsonData.name || 'N/A'}`);
    console.log(`   Ship ID: ${jsonData.shipid || 'N/A'}`);
    console.log(`   Line ID: ${jsonData.lineid || 'N/A'}`);
    console.log(`   Sail Date: ${jsonData.saildate || 'N/A'}`);
    console.log(`   Nights: ${jsonData.nights || 'N/A'}`);
    console.log(`   Has Prices: ${jsonData.prices ? 'Yes' : 'No'}`);
    console.log(`   Has Cabins: ${jsonData.cabins ? 'Yes' : 'No'}`);
    
    return testResults;
    
  } catch (error) {
    console.error(`\n❌ Test failed at step: ${error.message}`);
    console.error('Full error:', error);
    return testResults;
  }
}

// Set timeout for the entire operation
const timeout = setTimeout(() => {
  console.error('❌ Test timeout after 60 seconds');
  client.end();
  process.exit(1);
}, 60000);

// Handle connection events
client.on('ready', async () => {
  console.log('✅ Successfully connected to FTP server!\n');
  testResults.connection = true;
  
  try {
    const results = await runDetailedTest();
    
    // Print summary
    console.log('\n');
    console.log('=' .repeat(50));
    console.log('📋 TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`✅ Connection established: ${results.connection}`);
    console.log(`${results.listRoot ? '✅' : '❌'} List root directory: ${results.listRoot}`);
    console.log(`${results.navigateYear ? '✅' : '❌'} Navigate to year: ${results.navigateYear}`);
    console.log(`${results.navigateMonth ? '✅' : '❌'} Navigate to month: ${results.navigateMonth}`);
    console.log(`${results.navigateLine ? '✅' : '❌'} Navigate to cruise line: ${results.navigateLine}`);
    console.log(`${results.navigateShip ? '✅' : '❌'} Navigate to ship: ${results.navigateShip}`);
    console.log(`${results.listFiles ? '✅' : '❌'} List JSON files: ${results.listFiles}`);
    console.log(`${results.downloadFile ? '✅' : '❌'} Download file: ${results.downloadFile}`);
    console.log(`${results.parseJSON ? '✅' : '❌'} Parse JSON: ${results.parseJSON}`);
    
    const passedTests = Object.values(results).filter(v => v).length;
    const totalTests = Object.keys(results).length;
    
    console.log('\n');
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! FTP is fully functional.');
      console.log('The sync process should be able to download and parse cruise data.');
    } else {
      console.log(`⚠️  ${passedTests}/${totalTests} tests passed.`);
      console.log('Some FTP functionality may be limited.');
    }
    
  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    clearTimeout(timeout);
    client.end();
    process.exit(0);
  }
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.error('❌ FTP Connection Error:', err.message);
  
  if (err.message.includes('530')) {
    console.error('🔐 Authentication failed');
  } else if (err.message.includes('ECONNREFUSED')) {
    console.error('🔌 Connection refused');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('⏱️ Connection timeout');
  }
  
  client.end();
  process.exit(1);
});

// Attempt connection
console.log('🔄 Attempting to connect...\n');
client.connect(ftpConfig);