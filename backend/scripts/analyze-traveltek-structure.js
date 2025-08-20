#!/usr/bin/env node

/**
 * Comprehensive analysis of Traveltek JSON structure
 * This script downloads multiple files and analyzes their complete structure
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

// Analyze object structure recursively
function analyzeStructure(obj, path = '', depth = 0) {
  const structure = {};
  
  if (depth > 10) return { _note: 'Max depth reached' };
  
  for (const [key, value] of Object.entries(obj || {})) {
    const fullPath = path ? `${path}.${key}` : key;
    
    if (value === null) {
      structure[key] = { type: 'null', path: fullPath };
    } else if (value === undefined) {
      structure[key] = { type: 'undefined', path: fullPath };
    } else if (Array.isArray(value)) {
      structure[key] = {
        type: 'array',
        length: value.length,
        path: fullPath
      };
      
      // Analyze first item if exists
      if (value.length > 0) {
        if (typeof value[0] === 'object' && value[0] !== null) {
          structure[key].itemStructure = analyzeStructure(value[0], `${fullPath}[0]`, depth + 1);
        } else {
          structure[key].itemType = typeof value[0];
          structure[key].sampleValues = value.slice(0, 3);
        }
      }
    } else if (typeof value === 'object') {
      structure[key] = {
        type: 'object',
        path: fullPath,
        fields: Object.keys(value).length,
        structure: analyzeStructure(value, fullPath, depth + 1)
      };
    } else {
      structure[key] = {
        type: typeof value,
        path: fullPath,
        value: String(value).substring(0, 100) // First 100 chars
      };
    }
  }
  
  return structure;
}

// Download and analyze multiple files
async function analyzeAllStructures() {
  const client = new FTP();
  const allStructures = {};
  const fieldOccurrences = {};
  const sampleData = {};
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      
      // Test files from different cruise lines and ships
      const testFiles = [
        '/2025/01/10/54/2092628.json',  // Cruise 345235
        '/2025/01/118/4731/2184360.json', // Different cruise line
        '/2025/01/15/3496/2052721.json', // Another cruise line
      ];
      
      for (const filePath of testFiles) {
        console.log(`📥 Analyzing: ${filePath}`);
        
        await new Promise((fileResolve) => {
          client.get(filePath, (err, stream) => {
            if (err) {
              console.error(`   ❌ Failed: ${err.message}`);
              fileResolve();
              return;
            }
            
            let data = '';
            stream.on('data', chunk => data += chunk);
            stream.on('end', () => {
              try {
                const json = JSON.parse(data);
                const structure = analyzeStructure(json);
                
                // Store structure
                allStructures[filePath] = structure;
                
                // Track field occurrences
                const trackFields = (obj, prefix = '') => {
                  for (const [key, value] of Object.entries(obj || {})) {
                    const fieldPath = prefix ? `${prefix}.${key}` : key;
                    
                    if (!fieldOccurrences[fieldPath]) {
                      fieldOccurrences[fieldPath] = {
                        count: 0,
                        types: new Set(),
                        sampleValues: [],
                        hasData: 0,
                        isNull: 0,
                        isEmpty: 0
                      };
                    }
                    
                    fieldOccurrences[fieldPath].count++;
                    
                    if (value === null) {
                      fieldOccurrences[fieldPath].isNull++;
                    } else if (value === '' || (Array.isArray(value) && value.length === 0)) {
                      fieldOccurrences[fieldPath].isEmpty++;
                    } else {
                      fieldOccurrences[fieldPath].hasData++;
                      fieldOccurrences[fieldPath].types.add(typeof value);
                      
                      // Store sample values
                      if (fieldOccurrences[fieldPath].sampleValues.length < 3) {
                        if (typeof value === 'object') {
                          fieldOccurrences[fieldPath].sampleValues.push('[object]');
                        } else if (Array.isArray(value)) {
                          fieldOccurrences[fieldPath].sampleValues.push(`[array:${value.length}]`);
                        } else {
                          fieldOccurrences[fieldPath].sampleValues.push(String(value).substring(0, 50));
                        }
                      }
                    }
                    
                    // Recurse for objects
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                      trackFields(value, fieldPath);
                    }
                  }
                };
                
                trackFields(json);
                
                // Store sample data for specific important fields
                sampleData[filePath] = {
                  cruiseId: json.cruiseid,
                  cruiseName: json.cruisename,
                  hasItinerary: !!json.itinerary,
                  itineraryDays: json.itinerary ? json.itinerary.length : 0,
                  hasPrices: !!json.prices,
                  priceRateCodes: json.prices ? Object.keys(json.prices).length : 0,
                  hasShipContent: !!json.shipcontent,
                  portIds: json.portids,
                  ports: json.ports,
                  regionIds: json.regionids,
                  regions: json.regions
                };
                
                console.log(`   ✅ Analyzed cruise ${json.cruiseid}`);
                fileResolve();
              } catch (parseErr) {
                console.error(`   ❌ Parse failed: ${parseErr.message}`);
                fileResolve();
              }
            });
            
            stream.on('error', err => {
              console.error(`   ❌ Stream error: ${err.message}`);
              fileResolve();
            });
          });
        });
      }
      
      // Generate comprehensive report
      console.log('\n' + '='.repeat(80));
      console.log('📊 COMPREHENSIVE TRAVELTEK DATA STRUCTURE ANALYSIS');
      console.log('='.repeat(80) + '\n');
      
      // 1. Common fields across all files
      console.log('1️⃣ FIELD OCCURRENCE ANALYSIS:');
      console.log('   Fields present in ALL files:\n');
      
      const sortedFields = Object.entries(fieldOccurrences)
        .sort((a, b) => b[1].count - a[1].count);
      
      for (const [field, info] of sortedFields) {
        if (info.count === testFiles.length) {
          console.log(`   ✅ ${field}`);
          console.log(`      Types: ${Array.from(info.types).join(', ')}`);
          console.log(`      Has Data: ${info.hasData}/${info.count}, Null: ${info.isNull}, Empty: ${info.isEmpty}`);
          if (info.sampleValues.length > 0) {
            console.log(`      Samples: ${info.sampleValues.join(' | ')}`);
          }
          console.log();
        }
      }
      
      // 2. Fields with data issues
      console.log('\n2️⃣ FIELDS WITH DATA ISSUES:');
      console.log('   Fields that are often null or empty:\n');
      
      for (const [field, info] of sortedFields) {
        const emptyRate = (info.isNull + info.isEmpty) / info.count;
        if (emptyRate > 0.5 && info.count === testFiles.length) {
          console.log(`   ⚠️  ${field}: ${Math.round(emptyRate * 100)}% empty/null`);
        }
      }
      
      // 3. Pricing structure
      console.log('\n3️⃣ PRICING STRUCTURE DEEP DIVE:');
      
      for (const [filePath, data] of Object.entries(sampleData)) {
        console.log(`\n   File: ${filePath}`);
        console.log(`   Cruise: ${data.cruiseId} - ${data.cruiseName}`);
        console.log(`   Price Rate Codes: ${data.priceRateCodes}`);
      }
      
      // 4. Itinerary structure
      console.log('\n4️⃣ ITINERARY STRUCTURE:');
      
      for (const [filePath, data] of Object.entries(sampleData)) {
        console.log(`\n   File: ${filePath}`);
        console.log(`   Days: ${data.itineraryDays}`);
        console.log(`   Port IDs: ${data.portIds}`);
        if (typeof data.ports === 'object' && !Array.isArray(data.ports)) {
          console.log(`   Ports: [object with ${Object.keys(data.ports).length} keys]`);
        } else if (Array.isArray(data.ports)) {
          console.log(`   Ports: ${data.ports.slice(0, 5).join(', ')}`);
        } else {
          console.log(`   Ports: ${data.ports}`);
        }
      }
      
      // 5. Important fields we might be missing
      console.log('\n5️⃣ POTENTIALLY IMPORTANT FIELDS:');
      console.log('   Fields that exist but might not be captured:\n');
      
      const importantPatterns = [
        'price', 'cost', 'fee', 'tax', 'rate', 'discount',
        'cabin', 'deck', 'category', 'grade',
        'date', 'time', 'duration',
        'port', 'destination', 'region',
        'description', 'content', 'info',
        'image', 'photo', 'media',
        'available', 'status', 'active'
      ];
      
      for (const [field, info] of sortedFields) {
        const fieldLower = field.toLowerCase();
        if (importantPatterns.some(pattern => fieldLower.includes(pattern)) && info.hasData > 0) {
          console.log(`   📌 ${field}`);
          console.log(`      Data rate: ${Math.round((info.hasData / info.count) * 100)}%`);
          console.log(`      Samples: ${info.sampleValues.slice(0, 2).join(' | ')}`);
        }
      }
      
      // Save detailed analysis
      const analysis = {
        timestamp: new Date().toISOString(),
        filesAnalyzed: testFiles,
        fieldOccurrences,
        sampleData,
        structures: allStructures
      };
      
      fs.writeFileSync('traveltek-structure-analysis.json', JSON.stringify(analysis, null, 2));
      console.log('\n✅ Full analysis saved to traveltek-structure-analysis.json');
      
      // Save human-readable report
      let report = 'TRAVELTEK DATA STRUCTURE REPORT\n';
      report += '================================\n\n';
      report += `Generated: ${new Date().toISOString()}\n`;
      report += `Files Analyzed: ${testFiles.length}\n\n`;
      
      report += 'CRITICAL FIELDS FOR DATABASE:\n';
      report += '-----------------------------\n';
      
      const criticalFields = [
        'cruiseid', 'codetocruiseid', 'lineid', 'shipid',
        'cruisename', 'saildate', 'startdate', 'nights',
        'startportid', 'endportid', 'portids', 'ports',
        'regionids', 'regions', 'prices', 'itinerary',
        'shipcontent', 'marketid', 'ownerid'
      ];
      
      for (const field of criticalFields) {
        const info = fieldOccurrences[field];
        if (info) {
          report += `\n${field}:\n`;
          report += `  Occurrences: ${info.count}/${testFiles.length}\n`;
          report += `  Has Data: ${info.hasData}, Null: ${info.isNull}, Empty: ${info.isEmpty}\n`;
          report += `  Sample: ${info.sampleValues[0] || 'N/A'}\n`;
        }
      }
      
      fs.writeFileSync('traveltek-structure-report.txt', report);
      console.log('📄 Human-readable report saved to traveltek-structure-report.txt');
      
      client.end();
      resolve();
    });
    
    client.on('error', (err) => {
      console.error('❌ FTP Error:', err.message);
      reject(err);
    });
    
    console.log('🔄 Connecting to FTP server...');
    client.connect(ftpConfig);
  });
}

// Run analysis
analyzeAllStructures()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    console.log('📌 Next steps:');
    console.log('   1. Review traveltek-structure-analysis.json for complete field mapping');
    console.log('   2. Check traveltek-structure-report.txt for critical fields');
    console.log('   3. Update sync script to capture all discovered fields');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });