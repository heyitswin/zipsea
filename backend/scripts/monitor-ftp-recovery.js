#!/usr/bin/env node

/**
 * FTP Connection Recovery Monitor
 * Run this on production to detect when FTP connectivity is restored
 */

const net = require('net');
const { slackService } = require('../dist/services/slack.service');

const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const CHECK_INTERVAL = 60000; // Check every minute
const MAX_CHECKS = 1440; // Stop after 24 hours

let checkCount = 0;
let lastStatus = null;

async function checkFtpConnection() {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 5000);

    client.connect(21, FTP_HOST, () => {
      clearTimeout(timeout);
      client.end();
      resolve(true);
    });

    client.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function monitor() {
  console.log(`🔍 Starting FTP Recovery Monitor for ${FTP_HOST}`);
  console.log(`Will check every ${CHECK_INTERVAL/1000} seconds, max ${MAX_CHECKS} checks\n`);

  const startTime = new Date();

  const checkLoop = setInterval(async () => {
    checkCount++;
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);

    const isConnected = await checkFtpConnection();
    const statusChanged = lastStatus !== null && lastStatus !== isConnected;

    const statusIcon = isConnected ? '✅' : '❌';
    const statusText = isConnected ? 'CONNECTED' : 'REFUSED';

    console.log(`[${now.toISOString()}] Check #${checkCount} (${elapsed}s): ${statusIcon} ${statusText}`);

    if (statusChanged) {
      const message = isConnected
        ? `🎉 FTP CONNECTION RESTORED! Webhook processing can resume.`
        : `⚠️ FTP connection lost again. Webhook processing will fail.`;

      console.log(`\n${message}\n`);

      // Send Slack notification
      try {
        await slackService.sendNotification({
          text: message,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: isConnected ? '✅ FTP Connection Restored' : '❌ FTP Connection Lost'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Host:* ${FTP_HOST}\n*Time:* ${now.toISOString()}\n*Status:* ${statusText}\n*Monitoring Duration:* ${elapsed} seconds`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: isConnected
                  ? '✅ Webhook processing should now resume automatically. Check the webhook queue for backlog processing.'
                  : '❌ Webhook processing will fail. Contact Traveltek support urgently.'
              }
            }
          ]
        });
      } catch (err) {
        console.error('Failed to send Slack notification:', err.message);
      }
    }

    if (isConnected && lastStatus === false) {
      console.log('\n🎉 FTP connectivity restored! Exiting monitor.');
      clearInterval(checkLoop);
      process.exit(0);
    }

    lastStatus = isConnected;

    if (checkCount >= MAX_CHECKS) {
      console.log(`\n⏰ Reached maximum checks (${MAX_CHECKS}). Exiting.`);
      clearInterval(checkLoop);
      process.exit(1);
    }
  }, CHECK_INTERVAL);

  // Initial check
  const initialStatus = await checkFtpConnection();
  lastStatus = initialStatus;
  console.log(`Initial status: ${initialStatus ? '✅ CONNECTED' : '❌ REFUSED'}\n`);

  if (initialStatus) {
    console.log('🎉 FTP is already accessible! No monitoring needed.');
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Monitor stopped by user');
  process.exit(0);
});

monitor().catch(console.error);
