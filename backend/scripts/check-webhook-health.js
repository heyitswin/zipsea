#!/usr/bin/env node

/**
 * Check webhook processing health and recent updates
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { sql: sqlTemplate } = require('drizzle-orm');
const postgres = require('postgres');
require('dotenv').config();

const schema = require('../dist/db/schema');
const { cruises, cruiseLines, ships, pricing } = schema;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(sql, { schema });

async function checkWebhookHealth() {
  try {
    console.log('🔍 Webhook Health Check');
    console.log('========================\n');
    
    // Check cruise lines mentioned in Slack
    const lineIds = [5, 91, 73, 24];
    
    for (const lineId of lineIds) {
      console.log(`\n📊 Cruise Line ${lineId}:`);
      
      // Get cruise line info
      const lineInfo = await db
        .select({
          id: cruiseLines.id,
          name: cruiseLines.name,
          code: cruiseLines.code
        })
        .from(cruiseLines)
        .where(sqlTemplate`${cruiseLines.id} = ${lineId}`)
        .limit(1);
      
      if (lineInfo.length > 0) {
        console.log(`   Name: ${lineInfo[0].name}`);
        console.log(`   Code: ${lineInfo[0].code}`);
      } else {
        console.log(`   ⚠️  Cruise line not found`);
        continue;
      }
      
      // Check recent updates for this cruise line
      const recentCruises = await db
        .select({
          id: cruises.id,
          name: cruises.name,
          updated_at: cruises.updated_at,
          last_synced: cruises.last_synced,
          sailing_date: cruises.sailing_date,
          has_pricing: sqlTemplate`EXISTS (SELECT 1 FROM ${pricing} WHERE ${pricing.cruise_id} = ${cruises.id})`.as('has_pricing')
        })
        .from(cruises)
        .where(sqlTemplate`${cruises.cruise_line_id} = ${lineId}`)
        .orderBy(sqlTemplate`${cruises.updated_at} DESC`)
        .limit(5);
      
      console.log(`\n   Recent cruises (${recentCruises.length} shown):`);
      for (const cruise of recentCruises) {
        const updatedAgo = cruise.updated_at 
          ? Math.round((Date.now() - new Date(cruise.updated_at).getTime()) / (1000 * 60 * 60))
          : null;
        
        console.log(`   - ${cruise.id}: ${cruise.name || 'No name'}`);
        console.log(`     Sailing: ${cruise.sailing_date ? new Date(cruise.sailing_date).toISOString().split('T')[0] : 'N/A'}`);
        console.log(`     Updated: ${updatedAgo !== null ? `${updatedAgo} hours ago` : 'Never'}`);
        console.log(`     Has pricing: ${cruise.has_pricing ? '✅' : '❌'}`);
      }
      
      // Count total cruises and recent updates
      const stats = await db
        .select({
          total: sqlTemplate`COUNT(*)`.as('total'),
          with_pricing: sqlTemplate`COUNT(DISTINCT ${cruises.id}) FILTER (WHERE EXISTS (SELECT 1 FROM ${pricing} WHERE ${pricing.cruise_id} = ${cruises.id}))`.as('with_pricing'),
          updated_today: sqlTemplate`COUNT(*) FILTER (WHERE ${cruises.updated_at} > NOW() - INTERVAL '24 hours')`.as('updated_today'),
          updated_week: sqlTemplate`COUNT(*) FILTER (WHERE ${cruises.updated_at} > NOW() - INTERVAL '7 days')`.as('updated_week')
        })
        .from(cruises)
        .where(sqlTemplate`${cruises.cruise_line_id} = ${lineId}`);
      
      console.log(`\n   Statistics:`);
      console.log(`   - Total cruises: ${stats[0].total}`);
      console.log(`   - With pricing: ${stats[0].with_pricing}`);
      console.log(`   - Updated in last 24h: ${stats[0].updated_today}`);
      console.log(`   - Updated in last 7d: ${stats[0].updated_week}`);
    }
    
    // Check overall webhook processing
    console.log('\n\n🌐 Overall Webhook Health:');
    console.log('============================\n');
    
    // Recent updates across all cruise lines
    const overallStats = await db
      .select({
        total_cruises: sqlTemplate`COUNT(DISTINCT ${cruises.id})`.as('total_cruises'),
        updated_24h: sqlTemplate`COUNT(DISTINCT ${cruises.id}) FILTER (WHERE ${cruises.updated_at} > NOW() - INTERVAL '24 hours')`.as('updated_24h'),
        updated_7d: sqlTemplate`COUNT(DISTINCT ${cruises.id}) FILTER (WHERE ${cruises.updated_at} > NOW() - INTERVAL '7 days')`.as('updated_7d'),
        with_pricing: sqlTemplate`COUNT(DISTINCT ${cruises.id}) FILTER (WHERE EXISTS (SELECT 1 FROM ${pricing} WHERE ${pricing.cruise_id} = ${cruises.id}))`.as('with_pricing'),
        total_pricing: sqlTemplate`COUNT(*)`.as('total_pricing')
      })
      .from(cruises);
    
    console.log(`Total cruises: ${overallStats[0].total_cruises}`);
    console.log(`With pricing data: ${overallStats[0].with_pricing}`);
    console.log(`Total pricing records: ${overallStats[0].total_pricing}`);
    console.log(`Updated in last 24h: ${overallStats[0].updated_24h}`);
    console.log(`Updated in last 7d: ${overallStats[0].updated_7d}`);
    
    // Check for common issues
    console.log('\n\n⚠️  Potential Issues:');
    console.log('====================\n');
    
    // Check for cruises without required fields
    const issues = await db
      .select({
        missing_names: sqlTemplate`COUNT(*) FILTER (WHERE ${cruises.name} IS NULL OR ${cruises.name} = '')`.as('missing_names'),
        missing_file_path: sqlTemplate`COUNT(*) FILTER (WHERE ${cruises.traveltek_file_path} IS NULL OR ${cruises.traveltek_file_path} = '')`.as('missing_file_path'),
        old_data: sqlTemplate`COUNT(*) FILTER (WHERE ${cruises.updated_at} < NOW() - INTERVAL '30 days' OR ${cruises.updated_at} IS NULL)`.as('old_data')
      })
      .from(cruises);
    
    console.log(`Cruises without names: ${issues[0].missing_names}`);
    console.log(`Cruises without file paths: ${issues[0].missing_file_path}`);
    console.log(`Cruises not updated in 30+ days: ${issues[0].old_data}`);
    
    // Check error patterns
    console.log('\n\n🔍 Why Updates May Be Failing:');
    console.log('================================\n');
    console.log('Common reasons for webhook failures:');
    console.log('1. Cruise not found in database (new cruise ID from Traveltek)');
    console.log('2. Missing required fields (ports, dates, etc.)');
    console.log('3. Database schema mismatch');
    console.log('4. FTP file not accessible');
    console.log('5. Invalid pricing data format');
    
    // Check if cruise lines have proper names
    console.log('\n\n📝 Cruise Line Names Check:');
    const lineNames = await db
      .select({
        id: cruiseLines.id,
        name: cruiseLines.name
      })
      .from(cruiseLines)
      .where(sqlTemplate`${cruiseLines.id} IN (5, 91, 73, 24)`);
    
    for (const line of lineNames) {
      const isGeneric = line.name.startsWith('CL') || line.name.startsWith('Line ');
      console.log(`   ${line.id}: ${line.name} ${isGeneric ? '⚠️  (needs update)' : '✅'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkWebhookHealth();