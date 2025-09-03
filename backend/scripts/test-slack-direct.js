#!/usr/bin/env node

/**
 * Direct Slack webhook test
 * Tests if Slack notifications are working at all
 */

const https = require('https');
require('dotenv').config();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!SLACK_WEBHOOK_URL) {
  console.error('❌ SLACK_WEBHOOK_URL not set in environment');
  console.log('Please set SLACK_WEBHOOK_URL in your .env file or environment');
  process.exit(1);
}

console.log('🔔 Testing Slack webhook...');
console.log(`URL: ${SLACK_WEBHOOK_URL.substring(0, 50)}...`);

const testMessage = {
  text: '🧪 Test from Zipsea Backend',
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🧪 Slack Integration Test',
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Test Time:* ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\n*Status:* If you see this, Slack notifications are working!`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '✅ *What this means:*\n• Slack webhook URL is valid\n• Network connection to Slack is working\n• Basic notification system is functional'
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_If webhook processing notifications aren\'t showing, the issue is likely:_\n• Redis not configured for BullMQ\n• Webhook processing not using realtime service\n• Processing errors before Slack notification'
      }
    }
  ]
};

// Parse the webhook URL
const url = new URL(SLACK_WEBHOOK_URL);

const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const data = JSON.stringify(testMessage);

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Slack notification sent successfully!');
      console.log(`Response: ${responseData}`);
      console.log('\n📋 Next steps:');
      console.log('1. Check your Slack channel for the test message');
      console.log('2. If message appears, Slack is working');
      console.log('3. Issue is likely with Redis/BullMQ or webhook processing');
    } else {
      console.log(`❌ Slack webhook failed with status ${res.statusCode}`);
      console.log(`Response: ${responseData}`);
      console.log('\nPossible issues:');
      console.log('- Invalid webhook URL');
      console.log('- Webhook URL expired');
      console.log('- Slack workspace issues');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error sending Slack notification:', error.message);
  console.log('\nPossible issues:');
  console.log('- Network connectivity problem');
  console.log('- Firewall blocking outbound HTTPS');
  console.log('- Invalid URL format');
});

req.write(data);
req.end();