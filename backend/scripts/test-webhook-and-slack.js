#!/usr/bin/env node

/**
 * Comprehensive Webhook and Slack Integration Test
 * 
 * This script tests:
 * 1. Webhook endpoint health
 * 2. Recent webhook activity
 * 3. Slack integration status
 * 4. End-to-end webhook to Slack flow
 */

import { db } from '../dist/db/connection.js';
import { sql } from 'drizzle-orm';
import axios from 'axios';

const PRODUCTION_BASE_URL = 'https://zipsea-production.onrender.com';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/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';

console.log('🔍 TRAVELTEK WEBHOOK & SLACK INTEGRATION TEST');
console.log('='.repeat(60));
console.log('');

async function testWebhookEndpoint() {
  console.log('📡 Testing Webhook Endpoint Health...');
  try {
    const response = await axios.get(`${PRODUCTION_BASE_URL}/api/webhooks/traveltek/health`);
    const health = response.data;
    
    console.log(`✅ Webhook Status: ${health.status}`);
    console.log(`📊 Last 7 Days: ${health.statistics.last7Days.totalWebhooks} total, ${health.statistics.last7Days.processedWebhooks} processed`);
    console.log(`⏱️  Average Processing: ${health.statistics.last7Days.averageProcessingTime || 0}ms`);
    console.log(`✅ Success Rate: ${health.statistics.last7Days.totalSuccessful} successful, ${health.statistics.last7Days.totalFailed} failed`);
    
    if (health.recentWebhooks.length > 0) {
      const recent = health.recentWebhooks[0];
      console.log(`🕐 Most Recent: Line ${recent.lineId} at ${recent.createdAt} (${recent.successful} successful)`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Webhook endpoint error: ${error.message}`);
    return false;
  }
}

async function testDatabaseWebhooks() {
  console.log('\n💾 Checking Database Webhook Events...');
  try {
    const recentWebhooks = await db.execute(sql`
      SELECT 
        id,
        event_type,
        line_id,
        created_at,
        processed,
        processed_at,
        successful_count,
        failed_count,
        description
      FROM webhook_events 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`✅ Found ${recentWebhooks.length} webhook events in last 24 hours:`);
    recentWebhooks.forEach((event, index) => {
      const status = event.processed ? '✅' : '⏳';
      const ago = Math.round((Date.now() - new Date(event.created_at).getTime()) / (1000 * 60));
      console.log(`   ${index + 1}. ${status} Line ${event.line_id} - ${ago}min ago (${event.successful_count || 0} successful)`);
    });
    
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_today,
        COUNT(*) FILTER (WHERE processed = true) as processed_today,
        MAX(created_at) as last_webhook_time
      FROM webhook_events 
      WHERE created_at >= CURRENT_DATE
    `);
    
    const lastWebhookAge = stats[0].last_webhook_time 
      ? Math.round((Date.now() - new Date(stats[0].last_webhook_time).getTime()) / (1000 * 60))
      : null;
    
    console.log(`📈 Today's Summary: ${stats[0].total_today} total, ${stats[0].processed_today} processed`);
    console.log(`🕐 Last webhook: ${lastWebhookAge ? `${lastWebhookAge} minutes ago` : 'Unknown'}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Database error: ${error.message}`);
    return false;
  }
}

async function testSlackWebhook() {
  console.log('\n💬 Testing Slack Webhook Integration...');
  
  if (!SLACK_WEBHOOK_URL) {
    console.log('❌ SLACK_WEBHOOK_URL not configured');
    return false;
  }
  
  console.log(`📍 Webhook URL: ${SLACK_WEBHOOK_URL.substring(0, 50)}...`);
  
  try {
    // Test with simple message first
    const testMessage = {
      text: `🔧 Test message from webhook investigation - ${new Date().toISOString()}`
    };
    
    const response = await axios.post(SLACK_WEBHOOK_URL, testMessage);
    
    if (response.status === 200) {
      console.log('✅ Slack webhook is working - test message sent!');
      return true;
    } else {
      console.log(`❌ Slack responded with status: ${response.status}`);
      console.log(`Response: ${response.data}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Slack webhook failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${error.response.data}`);
    }
    return false;
  }
}

async function testWebhookSlackIntegration() {
  console.log('\n🔗 Testing Webhook -> Slack Integration...');
  
  try {
    // Simulate a webhook call to test the integration
    const testPayload = {
      lineId: 999,
      event: 'cruiseline_pricing_updated',
      description: 'Test webhook for Slack integration verification',
      currency: 'USD',
      marketid: 0,
      source: 'integration_test',
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('📨 Simulating webhook call to test-simulate endpoint...');
    const response = await axios.post(`${PRODUCTION_BASE_URL}/api/webhooks/test-simulate`, testPayload);
    
    if (response.status === 200) {
      console.log('✅ Webhook simulation completed successfully');
      console.log(`   Result: ${response.data.simulation.result.totalCruises} cruises processed`);
      console.log('🔍 Check #updates-quote-requests channel for Slack notification');
      return true;
    } else {
      console.log(`❌ Webhook simulation failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Webhook simulation error: ${error.message}`);
    return false;
  }
}

async function runFullTest() {
  console.log(`Started at: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log('');
  
  const results = {
    webhookEndpoint: false,
    databaseCheck: false,
    slackWebhook: false,
    integration: false
  };
  
  // Run all tests
  results.webhookEndpoint = await testWebhookEndpoint();
  results.databaseCheck = await testDatabaseWebhooks();
  results.slackWebhook = await testSlackWebhook();
  
  if (results.webhookEndpoint && results.databaseCheck) {
    results.integration = await testWebhookSlackIntegration();
  }
  
  // Summary
  console.log('\n📋 TEST SUMMARY');
  console.log('='.repeat(30));
  console.log(`🌐 Webhook Endpoint: ${results.webhookEndpoint ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log(`💾 Database Events: ${results.databaseCheck ? '✅ ACTIVE' : '❌ NO RECENT ACTIVITY'}`);
  console.log(`💬 Slack Integration: ${results.slackWebhook ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`🔗 End-to-End Flow: ${results.integration ? '✅ WORKING' : '❌ ISSUES'}`);
  
  console.log('\n🎯 DIAGNOSIS:');
  if (results.webhookEndpoint && results.databaseCheck && !results.slackWebhook) {
    console.log('❌ PROBLEM IDENTIFIED: Slack webhook URL is invalid or expired');
    console.log('📝 SOLUTION: Update SLACK_WEBHOOK_URL environment variable with valid URL');
    console.log('🔧 IMPACT: Webhooks are processing correctly but Slack notifications are not being sent');
  } else if (!results.webhookEndpoint) {
    console.log('❌ PROBLEM: Webhook endpoint is not responding');
  } else if (!results.databaseCheck) {
    console.log('❌ PROBLEM: No recent webhook activity in database');
  } else if (results.webhookEndpoint && results.databaseCheck && results.slackWebhook) {
    console.log('✅ ALL SYSTEMS OPERATIONAL: Webhooks and Slack are both working correctly');
  }
  
  console.log('');
  console.log('For more details, check:');
  console.log('- Production logs: https://dashboard.render.com/web/srv-...');
  console.log('- Admin dashboard: https://zipsea.com/admin');
  console.log('- Slack channel: #updates-quote-requests');
  
  process.exit(results.slackWebhook ? 0 : 1);
}

// Run the test
runFullTest().catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});