#!/bin/bash

echo "🚀 Testing Enhanced Sync on Staging Environment"
echo "=============================================="
echo ""

# SSH into staging and run the sync script
echo "📡 Connecting to staging server..."
echo ""

ssh srv-d2ii551r0fns738hdc90@ssh.oregon.render.com << 'ENDSSH'
cd ~/project/src/backend

echo "📋 Checking enhanced schema..."
node scripts/verify-enhanced-schema.js

echo ""
echo "🔄 Starting sync test (limited to 3 files for testing)..."
echo ""

# Create a test version that only processes a few files
cat > scripts/test-sync-limited.js << 'EOF'
#!/usr/bin/env node

const ftp = require('basic-ftp');
const { Pool } = require('pg');
const { Writable } = require('stream');
require('dotenv').config();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function testSync() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('🔌 Connecting to FTP...');
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    console.log('✅ FTP connected');
    console.log('📁 Listing first few files from 2025/09/1/180...');

    const files = await client.list('/2025/09/1/180');
    const jsonFiles = files
      .filter(f => f.name.endsWith('.json'))
      .slice(0, 3); // Only process 3 files for testing

    console.log(`   Found ${jsonFiles.length} files to test`);

    for (const file of jsonFiles) {
      console.log(`\n📥 Processing ${file.name}...`);

      // Download file using the fixed streaming approach
      const chunks = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });

      await client.downloadTo(writeStream, `/2025/09/1/180/${file.name}`);

      if (chunks.length === 0) {
        console.log('   ⚠️  Empty file');
        continue;
      }

      const data = Buffer.concat(chunks);
      const cruiseData = JSON.parse(data.toString());

      console.log(`   ✅ Downloaded: ${cruiseData.name || 'Unnamed cruise'}`);
      console.log(`   📅 Sailing: ${cruiseData.saildate}`);
      console.log(`   🚢 Ship: ${cruiseData.shipcontent?.name || 'Unknown'}`);
      console.log(`   🏢 Line: ${cruiseData.linecontent?.name || 'Unknown'}`);
    }

    console.log('\n✅ Test sync completed successfully!');
    console.log('   The FTP streaming fix is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    client.close();
    await dbPool.end();
  }
}

testSync();
EOF

node scripts/test-sync-limited.js

echo ""
echo "📊 Checking database for synced data..."
psql $DATABASE_URL -c "SELECT COUNT(*) as cruise_count FROM cruises;" 2>/dev/null || echo "   No cruises table yet"

ENDSSH

echo ""
echo "✅ Staging test complete!"
