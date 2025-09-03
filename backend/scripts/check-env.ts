#!/usr/bin/env ts-node

/**
 * Environment check script - shows current environment configuration
 * Run with: npx ts-node scripts/check-env.ts
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Environment Variables Check\n');

const criticalVars = [
  'NODE_ENV',
  'DATABASE_URL', 
  'RESEND_API_KEY',
  'TEAM_NOTIFICATION_EMAIL'
];

const optionalVars = [
  'SLACK_WEBHOOK_URL',
  'CLERK_SECRET_KEY',
  'SENTRY_DSN'
];

console.log('📋 Critical Variables:');
criticalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? 
    (varName.includes('KEY') || varName.includes('URL') || varName.includes('SECRET') ? 
      `${value.substring(0, 8)}...` : value) : 
    'NOT SET';
  console.log(`  ${status} ${varName}: ${displayValue}`);
});

console.log('\n🔧 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️ ';
  const displayValue = value ? 
    (varName.includes('KEY') || varName.includes('URL') || varName.includes('SECRET') ? 
      `${value.substring(0, 8)}...` : value) : 
    'NOT SET';
  console.log(`  ${status} ${varName}: ${displayValue}`);
});

console.log('\n🚀 Quick Actions:');
if (!process.env.RESEND_API_KEY) {
  console.log('❌ MISSING: RESEND_API_KEY - Get from https://resend.com/api-keys');
}
if (!process.env.DATABASE_URL) {
  console.log('❌ MISSING: DATABASE_URL - Database connection required');
}

console.log('\n📚 For email functionality to work:');
console.log('1. RESEND_API_KEY must be set with valid API key from Resend');
console.log('2. Your Resend account must have a verified domain (zippy@zipsea.com)');
console.log('3. Or use a verified email address like zippy@resend.dev for testing');