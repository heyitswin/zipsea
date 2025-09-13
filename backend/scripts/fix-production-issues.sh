#!/bin/bash

echo "🚀 Fixing Production Issues"
echo "=========================="
echo ""

# Load environment variables
source .env

echo "1️⃣ Fixing quote_requests table columns..."
node scripts/fix-quote-response-columns.js

echo ""
echo "2️⃣ Clearing failed webhook jobs..."
node scripts/clear-failed-jobs.js

echo ""
echo "3️⃣ Clearing stuck webhook events..."
# Reset stuck webhook events to failed status
cat << 'EOF' | node
const { db } = require('./dist/db/connection.js');
const { sql } = require('drizzle-orm');

async function clearStuckWebhooks() {
  try {
    const result = await db.execute(sql`
      UPDATE webhook_events
      SET status = 'failed',
          error_message = 'Job stalled - reset by fix script',
          processed_at = NOW()
      WHERE status = 'processing'
      AND received_at < NOW() - INTERVAL '1 hour'
      RETURNING id
    `);

    console.log(`✅ Reset ${result.length} stuck webhook events`);
  } catch (error) {
    console.error('Error resetting webhooks:', error.message);
  }
  process.exit(0);
}

clearStuckWebhooks();
EOF

echo ""
echo "4️⃣ Checking webhook health..."
node scripts/monitor-webhook-health.js

echo ""
echo "✅ Production fixes completed!"
echo ""
echo "📝 Next steps:"
echo "   1. Monitor webhook processing in Slack"
echo "   2. Test quote response functionality"
