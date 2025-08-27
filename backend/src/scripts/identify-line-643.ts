#!/usr/bin/env ts-node

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from '../services/ftp-connection-pool.service';
import logger from '../config/logger';

/**
 * Script to identify what cruise line 643 actually is
 * Uses multiple methods to determine the cruise line
 */
class Line643Identifier {
  
  /**
   * Main identification process
   */
  async identifyLine643(): Promise<void> {
    logger.info('🔍 Starting Line 643 identification process...');
    
    // Method 1: Check database
    await this.checkDatabase();
    
    // Method 2: Check FTP structure
    await this.checkFTPStructure();
    
    // Method 3: Analyze actual cruise data files
    await this.analyzeCruiseFiles();
    
    // Method 4: Check recent webhook events
    await this.checkWebhookHistory();
    
    logger.info('🏁 Line 643 identification complete');
  }

  /**
   * Method 1: Check what's in the database
   */
  private async checkDatabase(): Promise<void> {
    logger.info('\n📊 Method 1: Database Analysis');
    logger.info('=' + '='.repeat(40));
    
    try {
      // Check if line 643 exists
      const lineExists = await db.execute(sql`
        SELECT id, name, code, description, engine_name, short_name
        FROM cruise_lines
        WHERE id = 643
      `);
      
      if (lineExists.rows.length > 0) {
        logger.info('✅ Line 643 found in database:', lineExists.rows[0]);
      } else {
        logger.info('❌ Line 643 NOT found in cruise_lines table');
      }
      
      // Check cruises for line 643
      const cruises643 = await db.execute(sql`
        SELECT COUNT(*) as total,
               MIN(sailing_date) as earliest_sail,
               MAX(sailing_date) as latest_sail,
               COUNT(DISTINCT ship_id) as ship_count
        FROM cruises
        WHERE cruise_line_id = 643
      `);
      
      if (cruises643.rows[0]?.total > 0) {
        logger.info('✅ Found cruises for line 643:', cruises643.rows[0]);
        
        // Get sample cruise details
        const sampleCruises = await db.execute(sql`
          SELECT c.id, c.cruise_id, c.name, c.sailing_date, s.name as ship_name
          FROM cruises c
          LEFT JOIN ships s ON c.ship_id = s.id
          WHERE c.cruise_line_id = 643
          ORDER BY c.sailing_date DESC
          LIMIT 5
        `);
        
        logger.info('📋 Sample cruises for line 643:');
        sampleCruises.rows.forEach(cruise => {
          logger.info(`  - ${cruise.id}: ${cruise.name} on ${cruise.ship_name} (${cruise.sailing_date})`);
        });
      } else {
        logger.info('❌ No cruises found for line 643');
      }
      
      // Check if line 643 has any pending updates (from recent webhook)
      const pendingUpdates = await db.execute(sql`
        SELECT COUNT(*) as count,
               MAX(price_update_requested_at) as latest_request
        FROM cruises
        WHERE cruise_line_id = 643 AND needs_price_update = true
      `);
      
      if (pendingUpdates.rows[0]?.count > 0) {
        logger.info(`✅ Line 643 has ${pendingUpdates.rows[0].count} cruises marked for update`);
        logger.info(`   Latest request: ${pendingUpdates.rows[0].latest_request}`);
      } else {
        logger.info('❌ No pending updates for line 643');
      }
      
    } catch (error) {
      logger.error('❌ Database analysis failed:', error);
    }
  }

  /**
   * Method 2: Check FTP structure for line 643
   */
  private async checkFTPStructure(): Promise<void> {
    logger.info('\n📁 Method 2: FTP Structure Analysis');
    logger.info('=' + '='.repeat(40));
    
    try {
      const connection = await ftpConnectionPool.getConnection();
      
      try {
        // Check current year/month
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        
        const pathsToCheck = [
          `${year}/${month}/643`,
          `${year}/${String(now.getMonth()).padStart(2, '0')}/643`, // Previous month
        ];
        
        for (const path of pathsToCheck) {
          logger.info(`🔍 Checking FTP path: ${path}`);
          
          try {
            const contents = await connection.list(path);
            
            if (contents.length > 0) {
              logger.info(`✅ Found ${contents.length} items in ${path}`);
              
              // List ship directories
              const shipDirs = contents.filter(item => item.type === 2); // directories
              logger.info(`   Ship directories: ${shipDirs.map(d => d.name).join(', ')}`);
              
              // Check first ship directory for files
              if (shipDirs.length > 0) {
                const firstShipPath = `${path}/${shipDirs[0].name}`;
                const files = await connection.list(firstShipPath);
                const jsonFiles = files.filter(f => f.name.endsWith('.json'));
                
                logger.info(`   Ship ${shipDirs[0].name}: ${jsonFiles.length} JSON files`);
                
                // Download a sample file to analyze
                if (jsonFiles.length > 0) {
                  await this.analyzeSampleFile(connection, `${firstShipPath}/${jsonFiles[0].name}`);
                }
              }
              
              break; // Found data, no need to check other paths
            } else {
              logger.info(`❌ No contents found in ${path}`);
            }
            
          } catch (err) {
            logger.warn(`⚠️ Cannot access ${path}: ${err}`);
          }
        }
        
      } finally {
        ftpConnectionPool.releaseConnection(connection);
      }
      
    } catch (error) {
      logger.error('❌ FTP analysis failed:', error);
    }
  }

  /**
   * Analyze a sample cruise file to identify the cruise line
   */
  private async analyzeSampleFile(connection: any, filePath: string): Promise<void> {
    try {
      logger.info(`📄 Analyzing sample file: ${filePath}`);
      
      // Download file
      const { Writable } = require('stream');
      const chunks: Buffer[] = [];
      const writableStream = new Writable({
        write(chunk: Buffer, encoding: string, callback: Function) {
          chunks.push(chunk);
          callback();
        }
      });
      
      await connection.downloadTo(writableStream, filePath);
      const buffer = Buffer.concat(chunks);
      const data = JSON.parse(buffer.toString());
      
      // Extract cruise line information
      logger.info('🔍 Cruise line data from file:');
      logger.info(`   Cruise Line ID: ${data.linecontent?.id || 'N/A'}`);
      logger.info(`   Cruise Line Name: ${data.linecontent?.name || 'N/A'}`);
      logger.info(`   Cruise Line Code: ${data.linecontent?.code || 'N/A'}`);
      logger.info(`   Engine Name: ${data.linecontent?.enginename || 'N/A'}`);
      logger.info(`   Short Name: ${data.linecontent?.shortname || 'N/A'}`);
      
      // Also check other identifiers
      logger.info(`   Top-level Line ID: ${data.lineid || 'N/A'}`);
      logger.info(`   Currency: ${data.currency || 'N/A'}`);
      
      // Ship information
      if (data.ship) {
        logger.info(`   Ship: ${data.ship.name} (ID: ${data.ship.id})`);
      }
      
      // Cruise details
      logger.info(`   Cruise: ${data.cruisename || data.cruisecode || 'N/A'}`);
      logger.info(`   Sailing Date: ${data.saildate || data.startdate || 'N/A'}`);
      logger.info(`   Nights: ${data.nights || 'N/A'}`);
      
    } catch (error) {
      logger.error(`❌ Error analyzing file ${filePath}:`, error);
    }
  }

  /**
   * Method 3: Analyze cruise files for patterns
   */
  private async analyzeCruiseFiles(): Promise<void> {
    logger.info('\n🧬 Method 3: Cruise File Pattern Analysis');
    logger.info('=' + '='.repeat(40));
    
    // This is handled by the sample file analysis above
    logger.info('✅ File analysis completed as part of FTP structure check');
  }

  /**
   * Method 4: Check webhook history for line 643
   */
  private async checkWebhookHistory(): Promise<void> {
    logger.info('\n📨 Method 4: Webhook History Analysis');
    logger.info('=' + '='.repeat(40));
    
    try {
      // Check if webhook_events table exists
      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'webhook_events'
        )
      `);
      
      if (!tableCheck.rows[0]?.exists) {
        logger.warn('⚠️ webhook_events table not found');
        return;
      }
      
      // Check recent webhooks for line 643
      const recentWebhooks = await db.execute(sql`
        SELECT id, event_type, line_id, description, 
               successful_count, failed_count, created_at,
               payload
        FROM webhook_events
        WHERE line_id = 643
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      if (recentWebhooks.rows.length > 0) {
        logger.info(`✅ Found ${recentWebhooks.rows.length} webhook events for line 643:`);
        
        recentWebhooks.rows.forEach(webhook => {
          logger.info(`   ${webhook.created_at}: ${webhook.event_type} - ${webhook.successful_count} success, ${webhook.failed_count} failed`);
          if (webhook.description) {
            logger.info(`     Description: ${webhook.description}`);
          }
        });
        
        // Check the most recent webhook payload for more details
        const latestWebhook = recentWebhooks.rows[0];
        if (latestWebhook.payload) {
          try {
            const payload = typeof latestWebhook.payload === 'string' 
              ? JSON.parse(latestWebhook.payload) 
              : latestWebhook.payload;
              
            logger.info('📋 Latest webhook payload details:');
            logger.info(`   Event: ${payload.event || 'N/A'}`);
            logger.info(`   Line ID: ${payload.lineid || 'N/A'}`);
            logger.info(`   Market ID: ${payload.marketid || 'N/A'}`);
            logger.info(`   Currency: ${payload.currency || 'N/A'}`);
            logger.info(`   Source: ${payload.source || 'N/A'}`);
          } catch (parseError) {
            logger.warn('⚠️ Could not parse webhook payload');
          }
        }
        
      } else {
        logger.info('❌ No webhook events found for line 643');
      }
      
    } catch (error) {
      logger.error('❌ Webhook history analysis failed:', error);
    }
  }

  /**
   * Generate summary and recommendations
   */
  async generateSummary(): Promise<void> {
    logger.info('\n📋 SUMMARY & RECOMMENDATIONS');
    logger.info('=' + '='.repeat(50));
    
    // Based on the analysis, provide recommendations
    logger.info('Recommendations:');
    logger.info('1. Add line 643 to cruise line mapping if it\'s a valid cruise line');
    logger.info('2. Verify FTP access for line 643 directories');
    logger.info('3. Check if line 643 cruises are being created correctly');
    logger.info('4. Monitor webhook processing for line 643');
    logger.info('5. Update CRUISE_LINE_ID_MAPPING if needed');
  }
}

/**
 * Main execution
 */
async function main() {
  const identifier = new Line643Identifier();
  
  try {
    await identifier.identifyLine643();
    await identifier.generateSummary();
    
  } catch (error) {
    logger.error('❌ Line 643 identification failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { Line643Identifier };