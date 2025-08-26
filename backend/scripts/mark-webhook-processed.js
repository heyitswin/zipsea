#!/usr/bin/env node

// Mark a webhook as processed without actually processing it
require('dotenv').config();
const { sql } = require('drizzle-orm');
const { db } = require('../dist/db/connection');

async function markWebhookProcessed(webhookId) {
  try {
    console.log(`📝 Marking webhook ${webhookId} as processed...`);
    
    // Get the webhook details
    const result = await db.execute(
      sql`SELECT * FROM webhook_events WHERE id = ${webhookId}`
    );
    
    if (!result || result.length === 0) {
      console.error('❌ Webhook not found');
      return;
    }
    
    const webhook = result[0];
    console.log('Found webhook:', {
      id: webhook.id,
      event_type: webhook.event_type,
      line_id: webhook.line_id,
      processed: webhook.processed
    });
    
    if (webhook.processed) {
      console.log('⚠️ Webhook already marked as processed');
      return;
    }
    
    // Mark as processed with a note
    await db.execute(sql`
      UPDATE webhook_events 
      SET processed = true, 
          processed_at = NOW(),
          successful_count = 0,
          failed_count = 0,
          error_message = 'Manually marked as processed - FTP download issue'
      WHERE id = ${webhookId}
    `);
    
    console.log('✅ Webhook marked as processed');
    
    // Send Slack notification
    const { slackService } = require('../dist/services/slack.service');
    await slackService.sendMessage({
      text: `⚠️ Webhook manually marked as processed`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Webhook ID:* ${webhookId}\n*Line ID:* ${webhook.line_id}\n*Reason:* FTP download timeout - processing skipped to clear queue`
          }
        }
      ]
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get webhook ID from command line
const webhookId = process.argv[2];

if (!webhookId) {
  console.error('Usage: node mark-webhook-processed.js <webhook-id>');
  process.exit(1);
}

console.log('🔧 Marking webhook as processed:', webhookId);
markWebhookProcessed(parseInt(webhookId));