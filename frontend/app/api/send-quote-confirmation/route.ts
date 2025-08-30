import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendSlackQuoteNotification } from '../../../lib/slack';

const resendApiKey = process.env.RESEND_API_KEY;

// Enhanced debugging for API key
console.log('Resend API Key Debug:', {
  exists: !!resendApiKey,
  length: resendApiKey?.length || 0,
  startsWithRe: resendApiKey?.startsWith('re_') || false,
  isPlaceholder: resendApiKey === 'your_resend_api_key_here',
  isEmpty: !resendApiKey || resendApiKey.trim() === '',
  firstChars: resendApiKey ? resendApiKey.substring(0, 3) + '...' : 'none'
});

const resend = resendApiKey && resendApiKey !== 'your_resend_api_key_here' && resendApiKey.trim() !== ''
  ? new Resend(resendApiKey) 
  : null;

// Log email configuration status
if (resend) {
  console.log('✅ Email service initialized successfully with Resend');
} else {
  console.log('❌ Email service disabled - check RESEND_API_KEY environment variable');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, cruiseData, passengers, discounts, cabinType, cabinPrice, travelInsurance } = body;

    console.log('Quote submission received:', { 
      userEmail, 
      cruiseId: cruiseData?.id,
      cabinType,
      passengers,
      timestamp: new Date().toISOString(),
      hasSlackUrl: !!process.env.SLACK_WEBHOOK_URL && process.env.SLACK_WEBHOOK_URL !== 'your_slack_webhook_url_here',
      hasResendKey: !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here'
    });

    if (!userEmail) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    let backendSaved = false;
    let slackSent = false;
    let emailSent = false;

    // Save quote request to backend database (optional - don't fail if backend is down)
    try {
      const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://zipsea-production.onrender.com';
      console.log('Attempting to save to backend:', backendUrl);
      
      const quoteResponse = await fetch(`${backendUrl}/api/v1/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          cruiseId: cruiseData?.id,
          cabinType: cabinType?.toLowerCase(),
          adults: passengers?.adults || 2,
          children: passengers?.children || 0,
          travelInsurance: travelInsurance || false,
          discountQualifiers: {
            payInFull: discounts?.payInFull || false,
            seniorCitizen: discounts?.age55Plus || false,
            military: discounts?.military || false,
            stateOfResidence: discounts?.stateOfResidence || '',
            loyaltyNumber: discounts?.loyaltyNumber || '',
          },
        }),
      });

      if (quoteResponse.ok) {
        backendSaved = true;
        console.log('Quote saved to backend successfully');
      } else {
        console.error('Backend response not OK:', quoteResponse.status, quoteResponse.statusText);
      }
    } catch (error) {
      console.error('Error saving quote to backend database:', error);
      // Continue - backend save is optional
    }

    // Send Slack notification (optional - don't fail if Slack is down)
    try {
      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhookUrl && slackWebhookUrl !== 'your_slack_webhook_url_here') {
        console.log('Attempting to send Slack notification...');
        const slackResult = await sendSlackQuoteNotification({
          userEmail,
          cruiseData,
          passengers,
          discounts: {
            ...discounts,
            travelInsurance: travelInsurance || false
          },
          cabinType,
          cabinPrice
        });
        
        if (slackResult?.success) {
          slackSent = true;
          console.log('Slack notification sent successfully');
        } else {
          console.error('Slack notification failed:', slackResult);
        }
      } else {
        console.log('Slack webhook not configured, skipping notification');
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      // Continue - Slack is optional
    }

    // Format data for email
    const passengerInfo = `${passengers?.adults || 2} adult${(passengers?.adults || 2) !== 1 ? 's' : ''}${
      (passengers?.children || 0) > 0 ? `, ${passengers.children} child${passengers.children !== 1 ? 'ren' : ''}` : ''
    }`;

    const activeDiscounts = [];
    if (discounts?.payInFull) activeDiscounts.push('Pay in full/non-refundable');
    if (discounts?.age55Plus) activeDiscounts.push('55 or older');
    if (discounts?.military) activeDiscounts.push('Military/Veteran');
    if (discounts?.stateOfResidence) activeDiscounts.push(`Resident of ${discounts.stateOfResidence}`);
    if (discounts?.loyaltyNumber) activeDiscounts.push(`Loyalty number: ${discounts.loyaltyNumber}`);

    const formatPrice = (price: string | number | undefined) => {
      if (!price) return 'N/A';
      const numPrice = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(numPrice)) return 'N/A';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numPrice);
    };

    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC'
        });
      } catch {
        return dateString;
      }
    };

    // Send email if Resend is configured
    if (resend) {
      try {
        console.log('Attempting to send confirmation email to:', userEmail);
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Cruise Quote Request</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 20px;
                background-color: #f9f9f9;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .header {
                background-color: #2f7ddd;
                color: white;
                padding: 30px 40px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: bold;
              }
              .content {
                padding: 40px;
              }
              .cruise-details {
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
              }
              .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 5px 0;
                border-bottom: 1px solid #e9ecef;
              }
              .detail-row:last-child {
                border-bottom: none;
              }
              .label {
                font-weight: bold;
                color: #6c757d;
              }
              .value {
                color: #333;
              }
              .footer {
                background-color: #f8f9fa;
                padding: 30px 40px;
                text-align: center;
                color: #6c757d;
                font-size: 14px;
              }
              .discount-list {
                list-style: none;
                padding: 0;
              }
              .discount-list li {
                padding: 5px 0;
                color: #28a745;
              }
              .discount-list li:before {
                content: "✓ ";
                color: #28a745;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Quote Request Received!</h1>
                <p>We're working on getting you the best possible price</p>
              </div>
              
              <div class="content">
                <p>Hi there!</p>
                
                <p>Thank you for your quote request. Our team is now working to get you the best possible price for your cruise. We'll email you as soon as we have your personalized quotes ready.</p>

                <div class="cruise-details">
                  <h3 style="margin-top: 0; color: #2f7ddd;">Cruise Details</h3>
                  
                  ${cruiseData?.name ? `
                    <div class="detail-row">
                      <span class="label">Cruise:</span>
                      <span class="value">${cruiseData.name}</span>
                    </div>
                  ` : ''}
                  
                  ${cruiseData?.cruiseLineName ? `
                    <div class="detail-row">
                      <span class="label">Cruise Line:</span>
                      <span class="value">${cruiseData.cruiseLineName}</span>
                    </div>
                  ` : ''}
                  
                  ${cruiseData?.shipName ? `
                    <div class="detail-row">
                      <span class="label">Ship:</span>
                      <span class="value">${cruiseData.shipName}</span>
                    </div>
                  ` : ''}
                  
                  ${cruiseData?.sailingDate ? `
                    <div class="detail-row">
                      <span class="label">Sailing Date:</span>
                      <span class="value">${formatDate(cruiseData.sailingDate)}</span>
                    </div>
                  ` : ''}
                  
                  ${cruiseData?.nights ? `
                    <div class="detail-row">
                      <span class="label">Duration:</span>
                      <span class="value">${cruiseData.nights} nights</span>
                    </div>
                  ` : ''}
                  
                  ${cabinType ? `
                    <div class="detail-row">
                      <span class="label">Cabin Type:</span>
                      <span class="value">${cabinType}</span>
                    </div>
                  ` : ''}
                  
                  ${cabinPrice ? `
                    <div class="detail-row">
                      <span class="label">Starting Price:</span>
                      <span class="value">${formatPrice(cabinPrice)} per person</span>
                    </div>
                  ` : ''}
                  
                  <div class="detail-row">
                    <span class="label">Passengers:</span>
                    <span class="value">${passengerInfo}</span>
                  </div>
                  
                  ${travelInsurance ? `
                    <div class="detail-row">
                      <span class="label">Travel Insurance:</span>
                      <span class="value">Interested</span>
                    </div>
                  ` : ''}
                </div>

                ${activeDiscounts.length > 0 ? `
                  <h4 style="color: #2f7ddd; margin-bottom: 10px;">Discount Qualifiers</h4>
                  <ul class="discount-list">
                    ${activeDiscounts.map(discount => `<li>${discount}</li>`).join('')}
                  </ul>
                ` : ''}

                <p><strong>What happens next?</strong></p>
                <ul>
                  <li>Our team will review your request and search for the best available rates</li>
                  <li>We'll apply any applicable discounts and promotions</li>
                  <li>You'll receive a personalized quote via email within 24 hours</li>
                  <li>Our cruise specialists are standing by to help you book at the best price</li>
                </ul>

                <p>Questions? Reply to this email or visit our website at www.zipsea.com</p>
              </div>
              
              <div class="footer">
                <p><strong>ZipSea</strong><br>
                Your trusted cruise booking partner</p>
                <p>This email was sent because you requested a cruise quote on our website.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Try with custom domain first, fallback to onboarding@resend.dev if it fails
        const fromEmail = 'ZipSea <zippy@zipsea.com>';
        const fallbackEmail = 'ZipSea <onboarding@resend.dev>';
        
        console.log('📧 Sending email with parameters:', {
          from: fromEmail,
          to: userEmail,
          subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`
        });

        let { data, error } = await resend.emails.send({
          from: fromEmail,
          to: [userEmail],
          subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`,
          html: emailHtml,
        });
        
        // If domain not verified, try with Resend's domain
        if (error && error.message && error.message.includes('domain')) {
          console.log('🔄 Domain not verified, trying with Resend default domain...');
          const fallbackResult = await resend.emails.send({
            from: fallbackEmail,
            to: [userEmail],
            subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`,
            html: emailHtml,
          });
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) {
          console.error('❌ Resend API error:', error);
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            fullError: JSON.stringify(error, null, 2)
          });
        } else {
          emailSent = true;
          console.log('✅ Email sent successfully!', {
            resendId: data?.id,
            to: userEmail,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error sending email via Resend:', error);
        // Continue - email is optional
      }
    } else {
      console.log('Email service not configured - emails disabled. Configure RESEND_API_KEY to enable email confirmations.');
    }

    // Return success if at least we logged the request
    console.log('Quote submission completed:', {
      backendSaved,
      slackSent,
      emailSent,
      userEmail,
      cruiseId: cruiseData?.id
    });

    return NextResponse.json({ 
      success: true, 
      details: {
        backendSaved,
        slackSent,
        emailSent
      }
    });

  } catch (error: any) {
    console.error('API error:', error);
    const errorMessage = error?.message || 'Internal server error';
    const errorDetails = {
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    };
    return NextResponse.json(errorDetails, { status: 500 });
  }
}