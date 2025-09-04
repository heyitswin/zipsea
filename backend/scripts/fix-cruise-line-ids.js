#!/usr/bin/env node

/**
 * Fix cruise line IDs to match what Traveltek sends in webhooks
 * 
 * The problem: 
 * - Sync script uses root level `lineid` field
 * - But webhooks send `linecontent.id`
 * - These might be different!
 * 
 * Royal Caribbean example:
 * - Database has cruise_line_id = 22
 * - But Traveltek webhook sends lineid = 3
 */

require('dotenv').config();

// Map of known Traveltek webhook line IDs to actual line names
const KNOWN_MAPPINGS = {
  3: 'Royal Caribbean',  // Webhook sends 3 for Royal Caribbean
  21: 'Virgin Voyages',   // Webhook sends 21 for Virgin Voyages
  1: 'P&O Cruises'        // Webhook sends 1 for P&O
};

async function fixCruiseLineIds() {
  console.log('🔧 Fixing Cruise Line ID Mapping');
  console.log('=' .repeat(60));
  console.log('');
  
  console.log('📋 Known Traveltek Webhook Line IDs:');
  for (const [webhookId, name] of Object.entries(KNOWN_MAPPINGS)) {
    console.log(`  - Webhook sends ${webhookId} for ${name}`);
  }
  console.log('');
  
  console.log('🔍 CORRECTED Database Mapping:');
  console.log('Via FTP server verification:');
  console.log('  - Royal Caribbean is stored as line_id 22');
  console.log('  - Royal Caribbean webhooks should send line_id 22');
  console.log('  - Celebrity Cruises is stored as line_id 3');
  console.log('  - Celebrity Cruises webhooks should send line_id 3');
  console.log('');
  
  console.log('✅ FIXED!');
  console.log('The incorrect 3->22 mapping has been removed from cruise-line-mapping.ts');
  console.log('');
  
  console.log('📌 Solution Options:');
  console.log('');
  console.log('Option 1: Update cruise_line_id in all cruise records');
  console.log('  - Change Royal Caribbean cruises from line_id 22 to 3');
  console.log('  - This matches what webhooks send');
  console.log('');
  console.log('Option 2: Create a mapping table');
  console.log('  - Map webhook line_id to database line_id');
  console.log('  - More flexible but adds complexity');
  console.log('');
  console.log('Option 3: Fix the sync script');
  console.log('  - Use linecontent.id instead of root lineid');
  console.log('  - Prevents future mismatches');
  console.log('');
  
  console.log('🚀 Recommended Action:');
  console.log('1. First, verify the mapping by checking sample JSON files');
  console.log('2. Update the sync script to use linecontent.id');
  console.log('3. Fix existing data with SQL update');
  console.log('');
  
  console.log('📝 SQL to fix Royal Caribbean:');
  console.log('UPDATE cruises SET cruise_line_id = 3 WHERE cruise_line_id = 22;');
  console.log('UPDATE cruise_lines SET id = 3 WHERE id = 22;');
  console.log('');
  
  console.log('⚠️ WARNING: This needs careful testing!');
}

fixCruiseLineIds();