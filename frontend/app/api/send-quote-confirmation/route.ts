import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, cruiseData, passengers, discounts, cabinType, cabinPrice, travelInsurance } = body;

    if (!userEmail) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    // Save quote request to backend database
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const quoteResponse = await fetch(`${backendUrl}/api/v1/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          cruiseId: cruiseData.id,
          cabinType: cabinType.toLowerCase(),
          adults: passengers.adults,
          children: passengers.children,
          travelInsurance: travelInsurance || false,
          discountQualifiers: {
            payInFull: discounts.payInFull,
            seniorCitizen: discounts.age55Plus,
            military: discounts.military,
            stateOfResidence: discounts.stateOfResidence,
            loyaltyNumber: discounts.loyaltyNumber,
          },
        }),
      });

      if (!quoteResponse.ok) {
        console.error('Failed to save quote to database');
      }
    } catch (error) {
      console.error('Error saving quote to database:', error);
      // Continue with email sending even if database save fails
    }

    // Format passenger information
    const passengerInfo = `${passengers.adults} adult${passengers.adults !== 1 ? 's' : ''}${
      passengers.children > 0 ? `, ${passengers.children} child${passengers.children !== 1 ? 'ren' : ''}` : ''
    }`;

    // Format discount qualifiers
    const activeDiscounts = [];
    if (discounts.payInFull) activeDiscounts.push('Pay in full/non-refundable');
    if (discounts.age55Plus) activeDiscounts.push('55 or older');
    if (discounts.military) activeDiscounts.push('Military/Veteran');
    if (discounts.stateOfResidence) activeDiscounts.push(`Resident of ${discounts.stateOfResidence}`);
    if (discounts.loyaltyNumber) activeDiscounts.push(`Loyalty number: ${discounts.loyaltyNumber}`);

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

    // Create email content
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
          .logo {
            max-width: 120px;
            margin-bottom: 10px;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2f7ddd;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            margin: 20px 0;
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
              
              ${discounts.travelInsurance ? `
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

            <p>Questions? Reply to this email or call us at <strong>(555) 123-CRUISE</strong></p>
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

    const { data, error } = await resend.emails.send({
      from: 'ZipSea <quotes@zipsea.com>',
      to: [userEmail],
      subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending email:', error);
      return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: data?.id });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}