#!/usr/bin/env node

/**
 * Test script to verify line 22 (Royal Caribbean) discovers ALL months through 2027
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { getWebhookProcessorSimple } = require('../dist/services/webhook-processor-simple.service');

async function testLine22FullScan() {
  console.log('='.repeat(60));
  console.log('Testing Line 22 (Royal Caribbean) Full Scan');
  console.log('Expected: Should find cruises from 2025/09 through 2027/12');
  console.log('='.repeat(60));

  const processor = getWebhookProcessorSimple();

  try {
    console.log('\n📝 Starting file discovery for Line 22...\n');

    // Just run discovery, don't process files
    const files = await processor.discoverFiles(22);

    // Analyze the results
    const monthsFound = {};
    let totalFiles = 0;

    files.forEach(file => {
      const monthKey = `${file.year}/${file.month}`;
      if (!monthsFound[monthKey]) {
        monthsFound[monthKey] = 0;
      }
      monthsFound[monthKey]++;
      totalFiles++;
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthsFound).sort();

    console.log('\n📊 DISCOVERY RESULTS:');
    console.log('='.repeat(40));
    console.log(`Total Files Found: ${totalFiles}`);
    console.log(`Months Covered: ${sortedMonths.length}`);
    console.log(`Date Range: ${sortedMonths[0]} to ${sortedMonths[sortedMonths.length - 1]}`);

    console.log('\n📅 Files by Month:');
    console.log('-'.repeat(40));
    sortedMonths.forEach(month => {
      console.log(`${month}: ${monthsFound[month].toString().padStart(4)} files`);
    });

    // Check if we have data through 2027
    const has2027Data = sortedMonths.some(m => m.startsWith('2027'));
    const lastMonth = sortedMonths[sortedMonths.length - 1];

    console.log('\n✅ VERIFICATION:');
    console.log('-'.repeat(40));
    if (has2027Data && lastMonth === '2027/12') {
      console.log('✅ SUCCESS: Found data through December 2027');
    } else {
      console.log(`⚠️  WARNING: Last month found is ${lastMonth}`);
      console.log('   Expected data through 2027/12');
    }

    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`\nTotal Size: ${sizeMB} MB`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

// Run the test
testLine22FullScan().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
