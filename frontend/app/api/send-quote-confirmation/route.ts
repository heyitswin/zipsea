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
    let notificationSent = false;

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
              /* Mobile styles */
              @media only screen and (max-width: 600px) {
                .hero-headline { font-size: 32px !important; }
                .hero-subheading { font-size: 18px !important; }
                .cruise-details-text { font-size: 18px !important; }
              }
            </style>
            <!--[if mso]>
            <noscript>
              <xml>
                <o:OfficeDocumentSettings>
                  <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
              </xml>
            </noscript>
            <![endif]-->
          </head>
          <body style="margin: 0; padding: 0; background-color: #F6F3ED; font-family: Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
            <!-- Wrapper table for Outlook -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F6F3ED; min-height: 100vh;">
              <tr>
                <td align="center" valign="top" style="padding: 20px 0;">
                  
                  <!-- Main container with 10px padding -->
                  <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #F6F3ED; padding: 0 10px;">
                    
                    <!-- Hero Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0E1B4D; border-radius: 10px;">
                          <tr>
                            <td style="padding: 36px; text-align: center;">
                              <!-- Logo -->
                              <div style="margin-bottom: 20px;">
                                <img src="https://zipsea.com/images/zipsea-pink.png" 
                                     alt="ZipSea" 
                                     width="130" 
                                     style="display: inline-block; width: 130px; height: auto;" />
                              </div>
                              <!-- Content -->
                              <div>
                                <h1 class="hero-headline" style="margin: 0 0 10px 0; color: #FFFFFF; font-family: Arial, sans-serif; font-size: 42px; font-weight: bold; letter-spacing: -0.02em; line-height: 1.1;">Quote request received</h1>
                                <p class="hero-subheading" style="margin: 0; color: #E9B4EB; font-family: Arial, sans-serif; font-size: 20px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.3;">We're working on getting you the best possible price + perks</p>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Cruise Details Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FFFFFF; border-radius: 10px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 36px;">
                              <h2 style="margin: 0 0 20px 0; color: #2F2F2F; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Cruise details</h2>
                              
                              <!-- Two column layout -->
                              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                  <td valign="top" style="width: 50%; padding-right: 20px;">
                                    
                                    ${cruiseData?.name ? `
                                    <!-- Cruise -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">CRUISE</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cruiseData.name}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cruiseData?.shipName ? `
                                    <!-- Ship -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">SHIP</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cruiseData.shipName}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cruiseData?.nights ? `
                                    <!-- Nights -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">NIGHTS</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cruiseData.nights} nights</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    <!-- Passengers -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">PASSENGERS</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${passengerInfo}</td>
                                      </tr>
                                    </table>
                                    
                                  </td>
                                  <td valign="top" style="width: 50%; padding-left: 20px;">
                                    
                                    ${cruiseData?.cruiseLineName ? `
                                    <!-- Cruise Line -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">CRUISE LINE</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cruiseData.cruiseLineName}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cruiseData?.sailingDate ? `
                                    <!-- Departure -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">DEPARTURE</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${formatDate(cruiseData.sailingDate)}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cabinType ? `
                                    <!-- Cabin Type -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">CABIN TYPE</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cabinType}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cabinPrice ? `
                                    <!-- Starting Price -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">STARTING PRICE</td>
                                      </tr>
                                      <tr>
                                        <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${formatPrice(cabinPrice)} (excl. taxes/fees)</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- What Happens Next Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #E9B4EB; border-radius: 10px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 36px;">
                              <h2 style="margin: 0 0 20px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">What happens next?</h2>
                              <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; padding-bottom: 10px;">Our team will review your request and search for best available rates</td>
                                </tr>
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; padding-bottom: 10px;">We'll give you the MOST onboard credit we can (without getting in trouble)</td>
                                </tr>
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; padding-bottom: 10px;">You'll receive a personalized quote via email within 24 hours (usually much shorter)</td>
                                </tr>
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5;">Our cruise specialists are standing by to help you book at the best price</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Questions Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F7F170; border-radius: 10px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 36px; text-align: left;">
                              <h2 style="margin: 0 0 15px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Questions?</h2>
                              <p style="margin: 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.3;">Reply to this email or text us anytime at +1(866) 420-3817</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 20px 0; text-align: center;">
                        <p style="margin: 0; color: #999999; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.5px;">THIS EMAIL WAS SENT BECAUSE YOU REQUESTED A CRUISE QUOTE ON OUR WEBSITE ZIPSEA.COM</p>
                      </td>
                    </tr>
                    
                  </table>
                  
                </td>
              </tr>
            </table>
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

          // Send notification email to zipsea@manus.bot
          try {
            console.log('📧 Sending task notification to zipsea@manus.bot...');
            
            // Create cruise details text for the notification
            const cruiseDetails = `
Email: ${userEmail}
Cruise: ${cruiseData?.name || 'N/A'}
Ship: ${cruiseData?.shipName || 'N/A'}
Cruise Line: ${cruiseData?.cruiseLineName || 'N/A'}
Departure Date: ${formatDate(cruiseData?.sailingDate) || 'N/A'}
Nights: ${cruiseData?.nights || 'N/A'} nights
Passengers: ${passengerInfo}
Cabin Type Requested: ${cabinType || 'N/A'}
Starting Price: ${formatPrice(cabinPrice) || 'N/A'} (excl. taxes/fees)
Discounts: ${activeDiscounts.length > 0 ? activeDiscounts.join(', ') : 'None'}
Travel Insurance: ${travelInsurance ? 'Yes' : 'No'}
            `.trim();

            const notificationText = `You've received an email from the user with the subject of New quote request task

Make sure to read the email using your browser first, repeat the subject of the email and then make sure to understand what the content of the email before starting to respond to the user's query. Do not begin with reading the raw HTML first.

Once you've read the documents, understood the contents and the user's message to you, make sure to come up with a plan of how you're going to tackle this issue before proceeding.

Make sure to respond in en throughout the entire conversation.

STEP 1: Login and Setup
- Visit https://secure.cruisingpower.com/login and login with username winlin430 password Zippysea123
- IMPORTANT: Close any browser password save modals by clicking "Never" or "X" to ensure clear visibility

STEP 2: Search for Cruise
- Once logged in, scroll to the section below "book with espresso" and input:
  * ${cruiseData?.shipName || 'N/A'}
  * ${formatDate(cruiseData?.sailingDate) || 'N/A'}
  * ${passengerInfo}
  * Additional discount qualifiers: ${activeDiscounts.length > 0 ? activeDiscounts.join(', ') : 'None'}
- Click "search" in the same section

STEP 3: Filter and Extract Data Systematically
- Click the dropdown under "Category type" and select "${cabinType || 'N/A'}" (not "All Categories")
- Click the dropdown under "Status" and select "Available"
- CRITICAL: You must extract pricing data for EVERY row in the table, starting from the FIRST row and going through each subsequent row

STEP 4: Data Extraction Process (repeat for EACH row)
For each available ${cabinType || 'cabin'} category in the table:
a) Click the circle/radio button next to "AVL" for that specific row
b) Scroll down and click "Price Quote" to open the pricing modal
c) In the modal, scroll down and click "View Agency Commission"
d) Copy ALL the pricing information including vacation charges, taxes, fees, commission details, and totals
e) Close the modal by clicking the "X" or clicking outside the modal
f) Move to the NEXT row and repeat steps a-e

STEP 5: Verification
- Ensure you have extracted data for ALL available ${cabinType || 'cabin'} categories
- Compile all information into a comprehensive table
- Send the complete table with all pricing and commission data

Customer Details:
${cruiseDetails}`;

            const notificationResult = await resend.emails.send({
              from: fromEmail,
              to: ['zipsea@manus.bot'],
              subject: 'New quote request task',
              text: notificationText,
            });

            if (notificationResult.error) {
              console.error('❌ Notification email error:', notificationResult.error);
            } else {
              notificationSent = true;
              console.log('✅ Notification email sent to zipsea@manus.bot', {
                resendId: notificationResult.data?.id,
                timestamp: new Date().toISOString()
              });
            }
          } catch (notificationError) {
            console.error('Error sending notification email:', notificationError);
            // Continue - notification is optional
          }
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
      notificationSent,
      userEmail,
      cruiseId: cruiseData?.id
    });

    return NextResponse.json({ 
      success: true, 
      details: {
        backendSaved,
        slackSent,
        emailSent,
        notificationSent
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