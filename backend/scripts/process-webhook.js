#!/usr/bin/env node

// Manually process a stored webhook from the database
require('dotenv').config();
const { sql } = require('drizzle-orm');
const { db } = require('../dist/db/connection');
const { traveltekWebhookService } = require('../dist/services/traveltek-webhook.service');

async function processStoredWebhook(webhookId) {
  try {
    console.log(`📥 Fetching webhook ${webhookId} from database...`);
    
    // Get the webhook from database using Drizzle
    const result = await db.execute(
      sql`SELECT * FROM webhook_events WHERE id = ${webhookId}`
    );
    
    if (!result || result.length === 0) {
      console.error('❌ Webhook not found');
      return;
    }
    
    const webhook = result[0];
    console.log('✅ Found webhook:', {
      id: webhook.id,
      event_type: webhook.event_type,
      line_id: webhook.line_id,
      created_at: webhook.created_at,
      processed: webhook.processed
    });
    
    // Parse the payload
    const payload = typeof webhook.payload === 'string' 
      ? JSON.parse(webhook.payload) 
      : webhook.payload;
    
    console.log('📦 Payload:', payload);
    
    // Process the webhook
    console.log('🚀 Processing webhook...');
    const processingResult = await traveltekWebhookService.handleStaticPricingUpdate(payload);
    
    console.log('✅ Processing complete:', processingResult);
    
    // Mark webhook as processed
    await db.execute(sql`
      UPDATE webhook_events 
      SET processed = true, 
          processed_at = NOW(),
          successful_count = ${processingResult.successful},
          failed_count = ${processingResult.failed}
      WHERE id = ${webhookId}
    `);
    
    console.log('✅ Webhook marked as processed');
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
  } finally {
    process.exit(0);
  }
}

// Get webhook ID from command line or use the most recent one
const webhookId = process.argv[2] || '5';

console.log('🔧 Processing webhook ID:', webhookId);
processStoredWebhook(parseInt(webhookId));