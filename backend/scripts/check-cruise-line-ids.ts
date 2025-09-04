#!/usr/bin/env tsx

import { db } from '../src/db/connection';
import { cruiseLines } from '../src/db/schema';
import { sql } from 'drizzle-orm';
import { logger } from '../src/config/logger';

async function checkCruiseLineIds() {
  try {
    console.log('🔍 Checking cruise line IDs for Royal Caribbean and AmaWaterways...');
    
    // Query for Royal Caribbean and AmaWaterways
    const lines = await db
      .select({
        id: cruiseLines.id,
        name: cruiseLines.name
      })
      .from(cruiseLines)
      .where(
        sql`${cruiseLines.name} ILIKE '%royal%caribbean%' 
            OR ${cruiseLines.name} ILIKE '%ama%waterways%' 
            OR ${cruiseLines.name} ILIKE '%ama%' 
            OR ${cruiseLines.name} ILIKE '%waterways%'`
      );
    
    console.log('📋 Found cruise lines:', lines);
    
    // Also show all cruise lines for context
    console.log('\n📋 All cruise lines:');
    const allLines = await db
      .select({
        id: cruiseLines.id,
        name: cruiseLines.name
      })
      .from(cruiseLines)
      .orderBy(cruiseLines.id);
    
    allLines.forEach(line => {
      console.log(`  ${line.id}: ${line.name}`);
    });
    
  } catch (error) {
    logger.error('❌ Error checking cruise line IDs:', error);
  } finally {
    process.exit(0);
  }
}

checkCruiseLineIds();