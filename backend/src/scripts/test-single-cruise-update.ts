#!/usr/bin/env ts-node

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from '../services/ftp-connection-pool.service';
import logger from '../config/logger';
import { Writable } from 'stream';

async function testSingleCruiseUpdate() {
  logger.info('🧪 Testing single cruise file download and update...');
  
  let connection;
  
  try {
    // Test with cruise line 3 (one that's failing)
    const lineId = 3;
    const year = 2025;
    const month = '08';
    
    connection = await ftpConnectionPool.getConnection();
    logger.info('✅ Connected to FTP');
    
    // Try to list ship directories for line 3
    const basePath = `${year}/${month}/${lineId}`;
    logger.info(`📁 Checking path: ${basePath}`);
    
    const shipDirs = await connection.list(basePath);
    const directories = shipDirs.filter(item => item.type === 2);
    
    if (directories.length === 0) {
      logger.error('No ship directories found');
      return;
    }
    
    // Get first ship
    const firstShip = directories[0];
    const shipId = parseInt(firstShip.name);
    const shipPath = `${basePath}/${firstShip.name}`;
    
    logger.info(`🚢 Testing with ship ${shipId}`);
    
    // List cruise files
    const files = await connection.list(shipPath);
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      logger.error('No JSON files found');
      return;
    }
    
    // Download first file
    const testFile = jsonFiles[0];
    const filePath = `${shipPath}/${testFile.name}`;
    const codetocruiseid = parseInt(testFile.name.replace('.json', ''));
    
    logger.info(`📥 Downloading: ${filePath}`);
    logger.info(`   File size: ${testFile.size} bytes`);
    logger.info(`   Code to cruise ID: ${codetocruiseid}`);
    
    // Download file
    const chunks: Buffer[] = [];
    const writableStream = new Writable({
      write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        chunks.push(chunk);
        callback();
      }
    });
    
    await connection.downloadTo(writableStream, filePath);
    
    const buffer = Buffer.concat(chunks);
    const content = buffer.toString();
    
    logger.info(`✅ Downloaded ${buffer.length} bytes`);
    
    // Parse JSON
    const data = JSON.parse(content);
    
    logger.info('📊 Data structure:');
    logger.info(`   cruiseid: ${data.cruiseid}`);
    logger.info(`   saildate: ${data.saildate || data.startdate}`);
    logger.info(`   returndate: ${data.returndate || data.enddate}`);
    logger.info(`   nights: ${data.nights || data.duration}`);
    logger.info(`   Prices:`);
    logger.info(`     cheapestinside: ${data.cheapestinside}`);
    logger.info(`     cheapestoutside: ${data.cheapestoutside}`);
    logger.info(`     cheapestbalcony: ${data.cheapestbalcony}`);
    logger.info(`     cheapestsuite: ${data.cheapestsuite}`);
    
    if (data.cachedprices) {
      logger.info(`   Cached prices:`);
      logger.info(`     inside: ${data.cachedprices.inside}`);
      logger.info(`     outside: ${data.cachedprices.outside}`);
      logger.info(`     balcony: ${data.cachedprices.balcony}`);
      logger.info(`     suite: ${data.cachedprices.suite}`);
    }
    
    // Extract prices
    const prices = {
      interior: data.cheapestinside ? parseFloat(data.cheapestinside) : null,
      oceanview: data.cheapestoutside ? parseFloat(data.cheapestoutside) : null,
      balcony: data.cheapestbalcony ? parseFloat(data.cheapestbalcony) : null,
      suite: data.cheapestsuite ? parseFloat(data.cheapestsuite) : null
    };
    
    logger.info('\n🔄 Attempting database update...');
    
    // Try update by ID
    logger.info(`   Trying to update cruise with ID ${codetocruiseid}`);
    
    const updateResult = await db.execute(sql`
      UPDATE cruises
      SET 
        interior_cheapest_price = ${prices.interior},
        oceanview_cheapest_price = ${prices.oceanview},
        balcony_cheapest_price = ${prices.balcony},
        suite_cheapest_price = ${prices.suite},
        needs_price_update = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${codetocruiseid}
      RETURNING id, cruise_id, name
    `);
    
    if (updateResult.length > 0) {
      logger.info(`✅ Successfully updated cruise ${codetocruiseid}`);
      logger.info(`   Database cruise: ${JSON.stringify(updateResult[0])}`);
    } else {
      logger.warn(`⚠️ No cruise found with ID ${codetocruiseid}`);
      
      // Try by cruise_id
      const cruiseid = String(data.cruiseid);
      const sailingDate = data.saildate || data.startdate;
      
      logger.info(`   Trying cruise_id ${cruiseid} + date ${sailingDate}`);
      
      const altResult = await db.execute(sql`
        UPDATE cruises
        SET 
          interior_cheapest_price = ${prices.interior},
          oceanview_cheapest_price = ${prices.oceanview},
          balcony_cheapest_price = ${prices.balcony},
          suite_cheapest_price = ${prices.suite},
          needs_price_update = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE cruise_id = ${cruiseid}
          AND DATE(sailing_date) = DATE(${sailingDate})
          AND cruise_line_id = ${lineId}
        RETURNING id, cruise_id, name
      `);
      
      if (altResult.length > 0) {
        logger.info(`✅ Updated by cruise_id match: ${JSON.stringify(altResult[0])}`);
      } else {
        logger.error(`❌ No cruise found with cruise_id ${cruiseid} and date ${sailingDate}`);
        
        // Check if any cruises exist for this line
        const lineCheck = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM cruises 
          WHERE cruise_line_id = ${lineId}
        `);
        
        logger.info(`   Total cruises for line ${lineId}: ${lineCheck[0].count}`);
        
        // Check if this specific cruise exists with different ID
        const cruiseCheck = await db.execute(sql`
          SELECT id, cruise_id, sailing_date, name
          FROM cruises
          WHERE cruise_line_id = ${lineId}
            AND sailing_date >= CURRENT_DATE
          ORDER BY sailing_date
          LIMIT 5
        `);
        
        logger.info(`   Sample cruises for line ${lineId}:`);
        cruiseCheck.forEach(c => {
          logger.info(`     ID: ${c.id}, cruise_id: ${c.cruise_id}, date: ${c.sailing_date}`);
        });
      }
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  } finally {
    if (connection) {
      ftpConnectionPool.releaseConnection(connection);
      logger.info('\n✅ Connection released');
    }
  }
  
  process.exit(0);
}

testSingleCruiseUpdate().catch(console.error);