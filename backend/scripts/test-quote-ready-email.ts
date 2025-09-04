import { emailService } from '../src/services/email.service';
import * as fs from 'fs';

async function testQuoteReadyEmail() {
  const sampleData = {
    email: 'test@example.com',
    referenceNumber: 'ZS-2025-001',
    cruiseName: 'Northern Europe from Kiel',
    shipName: 'MSC Euribia',
    shipId: 123,
    departureDate: '2025-09-20',
    returnDate: '2025-09-27',
    nights: 7,
    passengerCount: 2,
    categories: [
      {
        category: '2T - Interior Guaranteed',
        roomName: 'Central Park Interior',
        cabinCode: '2T',
        finalPrice: 4520,
        obcAmount: 350
      },
      {
        category: '4B - Balcony Guaranteed',
        roomName: 'Ocean View Balcony',
        cabinCode: '4B',
        finalPrice: 6250,
        obcAmount: 450
      }
    ],
    notes: 'This is a sample note from our team. We found some great options for your cruise vacation!'
  };

  try {
    console.log('🧪 Testing quote ready email template...');
    console.log('Sample data:', JSON.stringify(sampleData, null, 2));
    
    // Get the HTML template directly
    const htmlTemplate = (emailService as any).getQuoteReadyEmailHTML(sampleData);
    
    // Save HTML to file for preview
    fs.writeFileSync('quote-ready-email-preview.html', htmlTemplate);
    console.log('✅ Email template saved to quote-ready-email-preview.html');
    console.log('📧 You can open this file in a browser to preview the email');
    
    // Try to send if Resend is configured
    const result = await emailService.sendQuoteReadyEmail(sampleData);
    
    if (result) {
      console.log('✅ Email sent successfully');
    } else {
      console.log('⚠️  Email not sent (Resend not configured), but template generated');
    }
  } catch (error) {
    console.error('💥 Error testing email template:', error);
  }
}

// Run the test
testQuoteReadyEmail().catch(console.error);