#!/usr/bin/env node

require('dotenv').config();
const { emailService } = require('../dist/services/email.service');

async function testQuoteReadyEmail() {
  console.log('🧪 Testing Quote Ready Email Design...');

  const testData = {
    email: process.env.TEST_EMAIL || 'test@example.com',
    referenceNumber: 'ZQ-123456789',
    cruiseName: '7 Night Caribbean Cruise',
    shipName: 'Wonder of the Seas',
    shipId: 'ship-123',
    departureDate: new Date('2025-10-15'),
    returnDate: new Date('2025-10-22'),
    categories: [
      {
        category: 'Interior',
        roomName: 'Interior Stateroom',
        cabinCode: 'INT',
        finalPrice: 2499,
        obcAmount: 100
      },
      {
        category: 'Ocean View',
        roomName: 'Ocean View Stateroom',
        cabinCode: 'OV',
        finalPrice: 2899,
        obcAmount: 150
      },
      {
        category: 'Balcony',
        roomName: 'Balcony Stateroom',
        cabinCode: 'BAL',
        finalPrice: 3299,
        obcAmount: 200
      },
      {
        category: 'Suite',
        roomName: 'Junior Suite',
        cabinCode: 'JS',
        finalPrice: 4999,
        obcAmount: 300
      }
    ],
    notes: `We're excited to offer you these great options for your upcoming cruise!

All prices include taxes and fees. The onboard credit amounts shown are guaranteed minimums - you may receive additional promotional credits closer to sailing.

Please note that balcony and suite categories are selling quickly for this sailing. We recommend booking soon to secure your preferred cabin type.

If you have any questions about these options or would like to discuss payment plans, please don't hesitate to reach out to our team.`
  };

  try {
    console.log('📧 Sending test email to:', testData.email);
    console.log('📋 Quote Details:');
    console.log('  - Reference:', testData.referenceNumber);
    console.log('  - Cruise:', testData.cruiseName);
    console.log('  - Ship:', testData.shipName);
    console.log('  - Categories:', testData.categories.length);
    console.log('  - Has Notes:', !!testData.notes);

    const result = await emailService.sendQuoteReadyEmail(testData);

    if (result) {
      console.log('✅ Test email sent successfully!');
      console.log('📬 Check your inbox for the Quote Ready email');
    } else {
      console.log('❌ Failed to send test email');
    }
  } catch (error) {
    console.error('💥 Error sending test email:', error);
  }

  process.exit(0);
}

// Run the test
testQuoteReadyEmail();
