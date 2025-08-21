#!/usr/bin/env node

/**
 * PRODUCTION TRAVELTEK SYNC SCRIPT - CORRECTED PRIMARY KEY
 * 
 * This script works with the corrected schema where:
 * - cruises.id = code_to_cruise_id (UNIQUE per sailing) 
 * - cruises.cruise_id = original cruiseid (can be duplicated across sailings)
 * 
 * Key Changes:
 * - Uses code_to_cruise_id as the primary key for cruises table
 * - Allows multiple sailings with same cruise_id but different dates
 * - Prevents duplicate key violations during sync
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { Pool } = require('pg');

console.log('🚢 PRODUCTION TRAVELTEK SYNC - CORRECTED SCHEMA');
console.log('================================================');
console.log('✅ Using code_to_cruise_id as primary key');
console.log('✅ Supports multiple sailings per cruise');
console.log('✅ Production-safe upsert logic\n');

// Configuration
const YEAR = process.env.YEAR || '2025';
const MONTH = process.env.MONTH || '09';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const SKIP_ERRORS = process.env.SKIP_ERRORS === 'true';

const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    port: 21,
    secure: false,
    connTimeout: 60000,
    pasvTimeout: 60000,
    keepalive: 30000
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Progress tracking
const PROGRESS_FILE = `.sync-progress-corrected-${YEAR}-${MONTH}.json`;
let progress = {
    year: YEAR,
    month: MONTH,
    startTime: new Date().toISOString(),
    processedFiles: new Set(),
    failedFiles: [],
    stats: {
        cruisesProcessed: 0,
        cruisesInserted: 0,
        cruisesUpdated: 0,
        duplicateSailings: 0,
        itinerariesProcessed: 0,
        pricingRecordsProcessed: 0,
        errors: 0,
        skippedFiles: 0
    },
    currentBatch: 0,
    totalBatches: 0
};

// Load existing progress
if (fs.existsSync(PROGRESS_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        if (saved.year === YEAR && saved.month === MONTH) {
            progress = { ...progress, ...saved };
            progress.processedFiles = new Set(progress.processedFiles);
            console.log(`📂 Resuming from previous session`);
            console.log(`   Processed: ${progress.processedFiles.size} files`);
            console.log(`   Failed: ${progress.failedFiles.length} files\n`);
        }
    } catch (e) {
        console.warn('⚠️  Could not load progress file, starting fresh');
    }
}

// Save progress periodically
function saveProgress() {
    try {
        const progressData = {
            ...progress,
            processedFiles: [...progress.processedFiles]
        };
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
    } catch (e) {
        console.warn('⚠️  Could not save progress:', e.message);
    }
}

// Utility functions
function parseInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
}

function parseDecimal(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
}

function parseDate(value) {
    if (!value) return null;
    try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

function parseTime(value) {
    if (!value) return null;
    if (value.includes('T')) {
        return value.split('T')[1].split('Z')[0];
    }
    return value;
}

function parseBoolean(value) {
    if (value === 'Y' || value === 'true' || value === true) return true;
    if (value === 'N' || value === 'false' || value === false) return false;
    return null;
}

function parseJsonb(value, defaultVal = '[]') {
    if (!value) return defaultVal;
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch {
            // If it's comma-separated string, convert to array
            const items = value.split(',').map(item => item.trim()).filter(Boolean);
            return JSON.stringify(items);
        }
    }
    return defaultVal;
}

/**
 * Process a single cruise file with corrected schema
 */
async function processCruiseFile(client, filePath, data) {
    const cruiseId = parseInteger(data.cruiseid);
    const codeToCruiseId = parseInteger(data.codetocruiseid);
    
    if (!cruiseId || !codeToCruiseId) {
        console.log(`⚠️  Missing required IDs in ${filePath}, skipping`);
        progress.stats.skippedFiles++;
        return;
    }
    
    try {
        // Check for existing sailings with same cruise_id (different sailings)
        const existingSailings = await client.query(
            'SELECT id, sailing_date FROM cruises WHERE cruise_id = $1 AND id != $2',
            [cruiseId, codeToCruiseId]
        );
        
        if (existingSailings.rows.length > 0) {
            progress.stats.duplicateSailings++;
            console.log(`📅 Cruise ${cruiseId} has ${existingSailings.rows.length + 1} total sailings`);
        }
        
        // CRITICAL: Use code_to_cruise_id as primary key (id field)
        const upsertResult = await client.query(`
            INSERT INTO cruises (
                id,                     -- PRIMARY KEY = code_to_cruise_id
                cruise_id,              -- Original cruiseid (can be duplicated)
                cruise_line_id, ship_id, name, itinerary_code, voyage_code,
                sailing_date, return_date, nights, sail_nights, sea_days,
                embark_port_id, disembark_port_id, region_ids, port_ids,
                market_id, owner_id, no_fly, depart_uk, show_cruise,
                fly_cruise_info, line_content, traveltek_file_path,
                last_cached, cached_date, currency, is_active, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, CURRENT_TIMESTAMP
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                itinerary_code = EXCLUDED.itinerary_code,
                voyage_code = EXCLUDED.voyage_code,
                sailing_date = EXCLUDED.sailing_date,
                return_date = EXCLUDED.return_date,
                nights = EXCLUDED.nights,
                sail_nights = EXCLUDED.sail_nights,
                sea_days = EXCLUDED.sea_days,
                embark_port_id = EXCLUDED.embark_port_id,
                disembark_port_id = EXCLUDED.disembark_port_id,
                region_ids = EXCLUDED.region_ids,
                port_ids = EXCLUDED.port_ids,
                market_id = EXCLUDED.market_id,
                owner_id = EXCLUDED.owner_id,
                no_fly = EXCLUDED.no_fly,
                depart_uk = EXCLUDED.depart_uk,
                show_cruise = EXCLUDED.show_cruise,
                fly_cruise_info = EXCLUDED.fly_cruise_info,
                line_content = EXCLUDED.line_content,
                traveltek_file_path = EXCLUDED.traveltek_file_path,
                last_cached = EXCLUDED.last_cached,
                cached_date = EXCLUDED.cached_date,
                currency = EXCLUDED.currency,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, (xmax = 0) as was_inserted
        `, [
            codeToCruiseId,                    // id (PRIMARY KEY) = code_to_cruise_id
            cruiseId,                          // cruise_id = original cruiseid
            parseInteger(data.lineid),
            parseInteger(data.shipid),
            data.name || null,
            data.itinerarycode || null,
            data.voyagecode || null,
            parseDate(data.saildate),
            parseDate(data.startdate) || parseDate(data.saildate), // fallback
            parseInteger(data.nights),
            parseInteger(data.sailnights),
            parseInteger(data.seadays),
            parseInteger(data.startportid),
            parseInteger(data.endportid),
            parseJsonb(data.regionids),
            parseJsonb(data.portids),
            parseInteger(data.marketid),
            parseInteger(data.ownerid),
            parseBoolean(data.nofly),
            parseBoolean(data.departuk),
            parseBoolean(data.showcruise),
            data.flycruiseinfo || null,
            data.linecontent || null,
            filePath,
            data.lastcached ? new Date(parseInteger(data.lastcached) * 1000) : null,
            data.lastcached ? new Date(parseInteger(data.lastcached) * 1000).toISOString().split('T')[0] : null,
            data.currency || 'USD',
            true // is_active
        ]);
        
        if (upsertResult.rows[0].was_inserted) {
            progress.stats.cruisesInserted++;
            console.log(`✅ Inserted sailing ${codeToCruiseId} (cruise: ${cruiseId}, date: ${data.saildate})`);
        } else {
            progress.stats.cruisesUpdated++;
            console.log(`📝 Updated sailing ${codeToCruiseId} (cruise: ${cruiseId}, date: ${data.saildate})`);
        }
        
        progress.stats.cruisesProcessed++;
        
        // Process itinerary (linked by code_to_cruise_id)
        if (data.itinerary && Array.isArray(data.itinerary)) {
            await client.query('DELETE FROM itineraries WHERE cruise_id = $1', [codeToCruiseId]);
            
            for (const [index, day] of data.itinerary.entries()) {
                await client.query(`
                    INSERT INTO itineraries (
                        cruise_id, day_number, date, port_name, port_id,
                        arrival_time, departure_time, status, overnight, description
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    codeToCruiseId,                    // Reference by code_to_cruise_id
                    parseInteger(day.day) || (index + 1),
                    parseDate(day.arrivedate || day.departdate),
                    day.name || day.itineraryname || null,
                    parseInteger(day.portid),
                    parseTime(day.arrivetime),
                    parseTime(day.departtime),
                    day.status || 'port',
                    parseBoolean(day.overnight),
                    day.description || day.shortdescription || null
                ]);
                
                progress.stats.itinerariesProcessed++;
            }
        }
        
        // Process pricing data (linked by code_to_cruise_id)
        if (data.prices && typeof data.prices === 'object') {
            // Clear existing pricing for this sailing
            await client.query('DELETE FROM pricing WHERE cruise_id = $1', [codeToCruiseId]);
            
            for (const [rateCode, cabins] of Object.entries(data.prices)) {
                if (typeof cabins !== 'object') continue;
                
                for (const [cabinCode, occupancyData] of Object.entries(cabins)) {
                    if (typeof occupancyData !== 'object') continue;
                    
                    for (const [occupancyCode, pricing] of Object.entries(occupancyData)) {
                        if (typeof pricing !== 'object') continue;
                        
                        await client.query(`
                            INSERT INTO pricing (
                                cruise_id, rate_code, cabin_code, occupancy_code,
                                base_price, adult_price, child_price, infant_price,
                                single_price, third_adult_price, fourth_adult_price,
                                taxes, ncf, gratuity, fuel, non_comm,
                                total_price, is_available, price_type, currency
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
                            )
                        `, [
                            codeToCruiseId,                 // Reference by code_to_cruise_id
                            rateCode,
                            cabinCode,
                            occupancyCode,
                            parseDecimal(pricing.price || pricing.baseprice),
                            parseDecimal(pricing.adultprice),
                            parseDecimal(pricing.childprice),
                            parseDecimal(pricing.infantprice),
                            parseDecimal(pricing.singleprice),
                            parseDecimal(pricing.thirdadultprice),
                            parseDecimal(pricing.fourthadultprice),
                            parseDecimal(pricing.taxes),
                            parseDecimal(pricing.ncf),
                            parseDecimal(pricing.gratuity),
                            parseDecimal(pricing.fuel),
                            parseDecimal(pricing.noncomm),
                            parseDecimal(pricing.totalprice),
                            true,
                            'static',
                            data.currency || 'USD'
                        ]);
                        
                        progress.stats.pricingRecordsProcessed++;
                    }
                }
            }
        }
        
        // Mark file as processed
        progress.processedFiles.add(filePath);
        
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        progress.failedFiles.push({ 
            path: filePath, 
            error: error.message,
            cruise_id: cruiseId,
            code_to_cruise_id: codeToCruiseId,
            timestamp: new Date().toISOString()
        });
        progress.stats.errors++;
        
        if (!SKIP_ERRORS) {
            throw error;
        }
    }
}

/**
 * Process a batch of files with retry logic
 */
async function processBatch(ftpClient, pgClient, filePaths) {
    console.log(`\n📦 Processing batch of ${filePaths.length} files...`);
    
    for (const filePath of filePaths) {
        if (progress.processedFiles.has(filePath)) {
            continue; // Skip already processed files
        }
        
        let retries = 0;
        while (retries <= MAX_RETRIES) {
            try {
                // Download file content
                const data = await new Promise((resolve, reject) => {
                    ftpClient.get(filePath, (err, stream) => {
                        if (err) return reject(err);
                        
                        let content = '';
                        stream.on('data', chunk => content += chunk.toString());
                        stream.on('end', () => {
                            try {
                                resolve(JSON.parse(content));
                            } catch (parseError) {
                                reject(new Error(`JSON parse error: ${parseError.message}`));
                            }
                        });
                        stream.on('error', reject);
                    });
                });
                
                // Process the cruise data
                await processCruiseFile(pgClient, filePath, data);
                break; // Success, exit retry loop
                
            } catch (error) {
                retries++;
                console.error(`❌ Error processing ${filePath} (attempt ${retries}/${MAX_RETRIES + 1}):`, error.message);
                
                if (retries > MAX_RETRIES) {
                    progress.stats.errors++;
                    if (!SKIP_ERRORS) {
                        throw error;
                    }
                    break;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
    }
    
    // Save progress after each batch
    saveProgress();
    console.log(`✅ Batch completed. Progress saved.`);
}

/**
 * Main synchronization function
 */
async function sync() {
    const ftpClient = new FTP();
    let pgClient;
    
    try {
        pgClient = await pool.connect();
        console.log('✅ Connected to database');
        
        // Verify schema is correct
        const schemaCheck = await pgClient.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'cruises' 
            AND column_name IN ('id', 'cruise_id')
            ORDER BY ordinal_position
        `);
        
        console.log('🔍 Current cruises table schema:');
        schemaCheck.rows.forEach(row => {
            console.log(`   ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
        });
        
        if (schemaCheck.rows.length < 2) {
            throw new Error('❌ Schema verification failed. Run migration first!');
        }
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
    }
    
    return new Promise((resolve, reject) => {
        ftpClient.on('ready', async () => {
            console.log('✅ Connected to FTP server');
            
            try {
                const basePath = `/${YEAR}/${MONTH}`;
                console.log(`\n📁 Processing ${basePath}`);
                
                // Navigate through directory structure
                ftpClient.list(basePath, async (err, lineList) => {
                    if (err) {
                        console.error('❌ Error listing cruise lines:', err.message);
                        return reject(err);
                    }
                    
                    const cruiseLines = lineList.filter(item => item.type === 'd');
                    console.log(`📂 Found ${cruiseLines.length} cruise lines`);
                    
                    for (const lineItem of cruiseLines) {
                        const linePath = `${basePath}/${lineItem.name}`;
                        console.log(`\n🏢 Processing cruise line: ${lineItem.name}`);
                        
                        try {
                            const shipList = await new Promise((resolve, reject) => {
                                ftpClient.list(linePath, (err, list) => {
                                    if (err) return reject(err);
                                    resolve(list.filter(item => item.type === 'd'));
                                });
                            });
                            
                            console.log(`   🚢 Found ${shipList.length} ships`);
                            
                            for (const shipItem of shipList) {
                                const shipPath = `${linePath}/${shipItem.name}`;
                                console.log(`     Processing ship: ${shipItem.name}`);
                                
                                try {
                                    const cruiseList = await new Promise((resolve, reject) => {
                                        ftpClient.list(shipPath, (err, list) => {
                                            if (err) return reject(err);
                                            resolve(list.filter(item => item.name.endsWith('.json')));
                                        });
                                    });
                                    
                                    console.log(`       📄 Found ${cruiseList.length} cruise files`);
                                    
                                    // Process files in batches
                                    let batch = [];
                                    for (const cruiseItem of cruiseList) {
                                        const filePath = `${shipPath}/${cruiseItem.name}`;
                                        
                                        if (!progress.processedFiles.has(filePath)) {
                                            batch.push(filePath);
                                        }
                                        
                                        if (batch.length >= BATCH_SIZE) {
                                            await processBatch(ftpClient, pgClient, batch);
                                            batch = [];
                                        }
                                    }
                                    
                                    // Process remaining files
                                    if (batch.length > 0) {
                                        await processBatch(ftpClient, pgClient, batch);
                                    }
                                    
                                } catch (error) {
                                    console.error(`❌ Error processing ship ${shipItem.name}:`, error.message);
                                    if (!SKIP_ERRORS) throw error;
                                }
                            }
                            
                        } catch (error) {
                            console.error(`❌ Error processing cruise line ${lineItem.name}:`, error.message);
                            if (!SKIP_ERRORS) throw error;
                        }
                    }
                    
                    ftpClient.end();
                    pgClient.release();
                    resolve();
                });
                
            } catch (error) {
                console.error('❌ Sync error:', error.message);
                ftpClient.end();
                if (pgClient) pgClient.release();
                reject(error);
            }
        });
        
        ftpClient.on('error', (err) => {
            console.error('❌ FTP error:', err.message);
            if (pgClient) pgClient.release();
            reject(err);
        });
        
        ftpClient.connect(ftpConfig);
    });
}

// Execute synchronization
if (require.main === module) {
    sync()
        .then(async () => {
            const endTime = new Date();
            const duration = (endTime - new Date(progress.startTime)) / 1000;
            
            console.log('\n🎉 SYNC COMPLETED SUCCESSFULLY!');
            console.log('=====================================');
            console.log('📊 Final Statistics:');
            console.log(`   Duration: ${Math.round(duration)}s`);
            console.log(`   Total Processed: ${progress.stats.cruisesProcessed} cruises`);
            console.log(`   Inserted: ${progress.stats.cruisesInserted} new sailings`);
            console.log(`   Updated: ${progress.stats.cruisesUpdated} existing sailings`);
            console.log(`   Duplicate Sailings: ${progress.stats.duplicateSailings}`);
            console.log(`   Itineraries: ${progress.stats.itinerariesProcessed}`);
            console.log(`   Pricing Records: ${progress.stats.pricingRecordsProcessed}`);
            console.log(`   Errors: ${progress.stats.errors}`);
            console.log(`   Skipped: ${progress.stats.skippedFiles}`);
            
            // Show some sample data
            const client = await pool.connect();
            const sampleData = await client.query(`
                SELECT 
                    id as sailing_id,
                    cruise_id,
                    name,
                    sailing_date,
                    nights,
                    created_at
                FROM cruises 
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT 5
            `);
            
            console.log('\n📋 Sample Recent Data:');
            sampleData.rows.forEach(row => {
                console.log(`   Sailing ${row.sailing_id} (Cruise ${row.cruise_id}): ${row.name} - ${row.sailing_date}`);
            });
            
            client.release();
            await pool.end();
            
            // Clean up progress file on successful completion
            if (fs.existsSync(PROGRESS_FILE) && progress.stats.errors === 0) {
                fs.unlinkSync(PROGRESS_FILE);
                console.log('🗑️  Cleaned up progress file');
            }
            
            process.exit(0);
        })
        .catch(async (error) => {
            console.error('\n💥 SYNC FAILED:', error.message);
            console.error('Stack trace:', error.stack);
            
            // Save final progress on failure
            saveProgress();
            
            await pool.end();
            process.exit(1);
        });
}

module.exports = { sync, processCruiseFile };