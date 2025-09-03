#!/usr/bin/env ts-node

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';
import { logger } from '../src/config/logger';

async function checkBatchSyncStatus() {
  try {
    console.log('🔍 Checking batch sync status...\n');

    // 1. Check current cruise counts and needs_price_update flags
    const cruiseStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN needs_price_update = true THEN 1 END) as needs_update,
        COUNT(CASE WHEN needs_price_update = false THEN 1 END) as updated,
        COUNT(CASE WHEN sailing_date >= CURRENT_DATE THEN 1 END) as future_cruises,
        COUNT(CASE WHEN sailing_date >= CURRENT_DATE AND needs_price_update = true THEN 1 END) as future_needs_update
      FROM cruises
    `);

    console.log('📊 Overall Cruise Statistics:');
    console.log(`Total cruises: ${cruiseStats[0].total_cruises}`);
    console.log(`Future cruises: ${cruiseStats[0].future_cruises}`);
    console.log(`Needs price update: ${cruiseStats[0].needs_update} (${cruiseStats[0].future_needs_update} future)`);
    console.log(`Already updated: ${cruiseStats[0].updated}`);
    console.log('');

    // 2. Check cruise lines that need updates
    const lineStats = await db.execute(sql`
      SELECT 
        cruise_line_id,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN needs_price_update = true THEN 1 END) as needs_update,
        COUNT(CASE WHEN needs_price_update = false THEN 1 END) as updated
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
      GROUP BY cruise_line_id
      ORDER BY needs_update DESC, cruise_line_id
    `);

    console.log('📋 Cruise Lines Status (Future Cruises Only):');
    lineStats.forEach(line => {
      const percentage = line.total_cruises > 0 ? 
        Math.round((Number(line.updated) / Number(line.total_cruises)) * 100) : 0;
      console.log(`Line ${line.cruise_line_id}: ${line.needs_update} need update, ${line.updated} updated (${percentage}% complete)`);
    });
    console.log('');

    // 3. Check recent activity (updated in last 24 hours)
    const recentActivity = await db.execute(sql`
      SELECT 
        DATE(updated_at) as update_date,
        COUNT(*) as cruises_updated,
        COUNT(DISTINCT cruise_line_id) as lines_updated
      FROM cruises
      WHERE updated_at >= NOW() - INTERVAL '7 days'
        AND needs_price_update = false
      GROUP BY DATE(updated_at)
      ORDER BY update_date DESC
      LIMIT 10
    `);

    console.log('📈 Recent Update Activity (Last 7 Days):');
    if (recentActivity.length === 0) {
      console.log('No recent cruise updates found');
    } else {
      recentActivity.forEach(day => {
        console.log(`${day.update_date}: ${day.cruises_updated} cruises updated across ${day.lines_updated} lines`);
      });
    }
    console.log('');

    // 4. Check processing limits from V5 service
    console.log('🔧 Current V5 Service Configuration:');
    console.log('MAX_LINES_PER_RUN: 10 (doubled from 5)');
    console.log('MAX_SHIPS_PER_LINE: 6 (doubled from 3)');
    console.log('MAX_FILES_PER_SHIP: 100 (doubled from 50)');
    console.log('MONTHS_TO_SYNC: 24 months');
    console.log('');

    // 5. Estimate processing potential
    const linesToProcess = await db.execute(sql`
      SELECT DISTINCT cruise_line_id
      FROM cruises
      WHERE needs_price_update = true
        AND sailing_date >= CURRENT_DATE
      ORDER BY cruise_line_id
    `);

    console.log('🎯 Next Batch Run Will Process:');
    const actualLinesToProcess = linesToProcess.slice(0, 10); // MAX_LINES_PER_RUN
    console.log(`${actualLinesToProcess.length} cruise lines out of ${linesToProcess.length} total`);
    if (actualLinesToProcess.length > 0) {
      console.log(`Lines: ${actualLinesToProcess.map(l => l.cruise_line_id).join(', ')}`);
    }
    if (linesToProcess.length > 10) {
      console.log(`${linesToProcess.length - 10} lines will wait for next batch runs`);
    }

  } catch (error) {
    console.error('❌ Error checking batch sync status:', error);
  } finally {
    process.exit(0);
  }
}

checkBatchSyncStatus();