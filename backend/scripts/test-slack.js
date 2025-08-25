#!/usr/bin/env node

// Test Slack notifications directly
require('dotenv').config();
const axios = require('axios');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!SLACK_WEBHOOK_URL) {
  console.error('❌ SLACK_WEBHOOK_URL not configured in environment');
  process.exit(1);
}

console.log('🚀 Testing Slack integration...');
console.log('Webhook URL:', SLACK_WEBHOOK_URL.substring(0, 50) + '...');

const testMessage = {
  blocks: [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "✅ Slack Integration Test Successful",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This is a test message from the ZipSea backend. If you're seeing this, Slack notifications are configured correctly!"
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🕒 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET | Test from: ${process.env.NODE_ENV || 'development'}`
        }
      ]
    }
  ]
};

axios.post(SLACK_WEBHOOK_URL, testMessage)
  .then(response => {
    console.log('✅ Slack test message sent successfully!');
    console.log('Response status:', response.status);
    console.log('Check your Slack channel for the test message.');
  })
  .catch(error => {
    console.error('❌ Failed to send Slack test message');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  });