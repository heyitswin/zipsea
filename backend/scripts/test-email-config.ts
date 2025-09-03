#!/usr/bin/env ts-node

/**
 * Test script to verify email configuration and functionality
 * Run with: npx ts-node scripts/test-email-config.ts
 */

import { env } from '../src/config/environment';
import { logger } from '../src/config/logger';
import { emailService } from '../src/services/email.service';

async function testEmailConfiguration() {
  console.log('🔍 Testing Email Configuration...\n');
  
  // 1. Check environment variables
  console.log('📋 Environment Configuration:');
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  RESEND_API_KEY configured: ${!!env.RESEND_API_KEY}`);
  console.log(`  RESEND_API_KEY length: ${env.RESEND_API_KEY?.length || 0}`);
  console.log(`  RESEND_API_KEY prefix: ${env.RESEND_API_KEY?.substring(0, 8)}...`);
  console.log(`  TEAM_NOTIFICATION_EMAIL: ${env.TEAM_NOTIFICATION_EMAIL}`);
  
  if (!env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not configured!');
    console.log('\nTo fix this:');
    console.log('1. Set RESEND_API_KEY in your environment variables');
    console.log('2. Get your API key from: https://resend.com/api-keys');
    console.log('3. The key should start with "re_"');
    return;
  }
  
  console.log('\n🔗 Testing Resend API Connection...');
  
  // 2. Test sending a quote ready email
  try {
    const testData = {
      email: 'test@example.com', // Will fail but we can see if the API call works
      referenceNumber: 'TEST-' + Date.now(),
      cruiseName: 'Test Cruise Configuration',
      shipName: 'Test Ship',
      departureDate: '2024-06-01',
      returnDate: '2024-06-08',
      categories: [
        {
          category: 'Interior Cabin',
          roomName: 'Interior Room',
          finalPrice: 999,
          obcAmount: 50
        }
      ],
      notes: 'This is a test email to verify configuration'
    };
    
    console.log('📧 Attempting to send test quote ready email...');
    const result = await emailService.sendQuoteReadyEmail(testData);
    
    console.log(`Result: ${result ? '✅ Success' : '❌ Failed'}`);
    
  } catch (error) {
    console.error('💥 Error testing email service:');
    console.error(error);
  }
  
  console.log('\n✅ Email configuration test completed');
  console.log('\nIf you see errors above:');
  console.log('1. Check the RESEND_API_KEY is correct');
  console.log('2. Verify your Resend account is active');
  console.log('3. Ensure you have verified your sending domain');
  console.log('4. Check the logs for detailed error messages');
}

// Run the test
testEmailConfiguration().catch(console.error);