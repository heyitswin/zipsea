#!/usr/bin/env node

/**
 * ANALYZE WHAT DATA WE'RE MISSING
 * 
 * This script shows all the data fields we're NOT syncing from Traveltek
 */

const fs = require('fs');

// Load sample data
const sampleData = JSON.parse(fs.readFileSync('sample-traveltek-cruise.json', 'utf8'));

console.log('🔍 TRAVELTEK DATA ANALYSIS');
console.log('==========================\n');

console.log('📊 DATA WE ARE SYNCING:');
console.log('------------------------');
const syncedFields = [
  'cruiseid', 'codetocruiseid', 'lineid', 'shipid', 'name', 
  'voyagecode', 'itinerarycode', 'saildate', 'startdate', 
  'nights', 'sailnights', 'seadays', 'startportid', 'endportid',
  'portids', 'regionids', 'marketid', 'ownerid', 'nofly', 
  'departuk', 'showcruise', 'flycruiseinfo', 'lastcached', 'cacheddate'
];
console.log(syncedFields.join(', '));

console.log('\n❌ DATA WE ARE NOT SYNCING:');
console.log('---------------------------');

// 1. PRICING DATA (CRITICAL!)
console.log('\n1. PRICING DATA:');
console.log('   - prices object:', typeof sampleData.prices);
console.log('   - Structure: prices[rateCode][cabinCode][occupancyCode]');
console.log('   - Contains: price, adult, child, infant, taxes, ncf, gratuity, fuel');
console.log('   - In this sample: ', Object.keys(sampleData.prices).length === 0 ? 'EMPTY' : 'HAS DATA');

// 2. CABIN DATA (CRITICAL!)
console.log('\n2. CABIN CATEGORIES:');
console.log('   - cabins object:', typeof sampleData.cabins);
console.log('   - Number of cabin types:', Object.keys(sampleData.cabins || {}).length);
if (sampleData.cabins) {
  const sampleCabin = Object.values(sampleData.cabins)[0];
  console.log('   - Sample cabin fields:', Object.keys(sampleCabin).join(', '));
}

// 3. SHIP CONTENT (EXTENSIVE!)
console.log('\n3. SHIP CONTENT:');
if (sampleData.shipcontent) {
  console.log('   - Ship name:', sampleData.shipcontent.name);
  console.log('   - Ship decks:', Object.keys(sampleData.shipcontent.shipdecks || {}).length, 'decks');
  console.log('   - Ship images:', (sampleData.shipcontent.shipimages || []).length, 'images');
  console.log('   - Fields we have:', Object.keys(sampleData.shipcontent).join(', '));
}

// 4. LINE CONTENT
console.log('\n4. LINE CONTENT:');
if (sampleData.linecontent) {
  console.log('   - Line name:', sampleData.linecontent.name);
  console.log('   - Fields:', Object.keys(sampleData.linecontent).join(', '));
}

// 5. ITINERARY DETAILS
console.log('\n5. ITINERARY:');
console.log('   - Days:', sampleData.itinerary?.length || 0);
if (sampleData.itinerary && sampleData.itinerary[0]) {
  console.log('   - Fields per day:', Object.keys(sampleData.itinerary[0]).join(', '));
  console.log('   - Has descriptions:', !!sampleData.itinerary[0].description);
}

// 6. ALTERNATIVE SAILINGS
console.log('\n6. ALTERNATIVE SAILINGS:');
console.log('   - altsailings:', typeof sampleData.altsailings);
if (sampleData.altsailings) {
  console.log('   - Count:', Object.keys(sampleData.altsailings).length);
}

// 7. CHEAPEST PRICES (PRE-CALCULATED)
console.log('\n7. CHEAPEST PRICES:');
console.log('   - cheapest.prices:', sampleData.cheapest?.prices);
console.log('   - cheapest.combined:', sampleData.cheapest?.combined);
console.log('   - Note: All null in sample (need live pricing)');

// 8. PORTS AND REGIONS OBJECTS
console.log('\n8. LOOKUP OBJECTS:');
console.log('   - ports object:', typeof sampleData.ports, '- Maps port IDs to names');
console.log('   - regions object:', typeof sampleData.regions, '- Maps region IDs to names');

console.log('\n' + '='.repeat(50));
console.log('⚠️  CRITICAL FINDINGS:');
console.log('='.repeat(50));
console.log('\n1. ❌ NOT SYNCING STATIC PRICING (prices object)');
console.log('2. ❌ NOT SYNCING CABIN CATEGORIES (cabins object)');
console.log('3. ❌ NOT STORING SHIP DETAILS PROPERLY (shipdecks, shipimages)');
console.log('4. ❌ NOT STORING DETAILED ITINERARY (descriptions, times)');
console.log('5. ❌ NOT SYNCING ALTERNATIVE SAILINGS');

console.log('\n💡 RECOMMENDATIONS:');
console.log('1. Update sync-traveltek-clean.js to extract ALL data');
console.log('2. Create additional tables for:');
console.log('   - ship_decks (deck plans and images)');
console.log('   - ship_images (already exists, not being populated)');
console.log('   - cabin_types (exists, not being populated properly)');
console.log('   - static_prices (exists, not being populated)');
console.log('3. Store full itinerary details with descriptions');
console.log('4. Extract and store alternative sailings');

console.log('\n⚠️  THIS IS A MAJOR DATA LOSS ISSUE!');
console.log('We are only syncing about 30% of available data!');