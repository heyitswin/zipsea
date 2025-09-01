import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { 
      email, 
      referenceNumber, 
      cruiseName, 
      shipName, 
      departureDate, 
      returnDate,
      categories,
      notes 
    } = data;

    // Format dates
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return 'TBD';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    };

    // Calculate total for the best price category
    const bestCategory = categories.reduce((best: any, cat: any) => {
      if (!best || cat.finalPrice < best.finalPrice) return cat;
      return best;
    }, null);

    // Create categories HTML
    const categoriesHtml = categories.map((cat: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
          ${cat.category}${cat.roomName ? ` - ${cat.roomName}` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 600; text-align: right;">
          $${cat.finalPrice.toLocaleString()}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #059669; font-weight: 600; text-align: right;">
          $${cat.obcAmount.toLocaleString()}
        </td>
      </tr>
    `).join('');

    // Create the email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Cruise Quote is Ready!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #0066CC; padding: 24px; text-align: center;">
            <img src="https://zipsea-frontend-production.onrender.com/images/logo.png" alt="Zipsea Logo" style="height: 40px; width: auto;">
          </div>
          
          <!-- Main Content -->
          <div style="padding: 32px 24px;">
            <!-- Title -->
            <h1 style="color: #111827; font-size: 28px; font-weight: bold; margin: 0 0 8px 0; text-align: center;">
              Your Quote is Ready!
            </h1>
            <p style="color: #6b7280; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
              Reference #${referenceNumber}
            </p>
            
            <!-- Cruise Details Box -->
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h2 style="color: #111827; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">
                ${cruiseName}
              </h2>
              <table style="width: 100%;">
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Ship:</td>
                  <td style="color: #374151; font-size: 14px; padding: 4px 0; font-weight: 600;">${shipName}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Departure:</td>
                  <td style="color: #374151; font-size: 14px; padding: 4px 0; font-weight: 600;">${formatDate(departureDate)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Return:</td>
                  <td style="color: #374151; font-size: 14px; padding: 4px 0; font-weight: 600;">${formatDate(returnDate)}</td>
                </tr>
              </table>
            </div>
            
            <!-- Pricing Table -->
            <div style="margin-bottom: 24px;">
              <h3 style="color: #111827; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">
                Available Categories & Pricing
              </h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                      Category
                    </th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                      Total Price
                    </th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                      Onboard Credit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${categoriesHtml}
                </tbody>
              </table>
            </div>
            
            ${notes ? `
            <!-- Notes Section -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px;">
              <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                <strong>Note from your agent:</strong><br>
                ${notes}
              </p>
            </div>
            ` : ''}
            
            <!-- Call to Action -->
            <div style="text-align: center; margin: 32px 0;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
                Ready to book? Contact us to secure your cabin!
              </p>
              <a href="mailto:support@zipsea.com?subject=Booking%20Request%20-%20Quote%20${referenceNumber}" 
                 style="display: inline-block; background-color: #0066CC; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Book Now
              </a>
            </div>
            
            <!-- Contact Info -->
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
                Questions? We're here to help!
              </p>
              <p style="color: #374151; font-size: 14px; margin: 0;">
                📧 support@zipsea.com | 📞 1-800-ZIPSEA
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
              © 2025 Zipsea. All rights reserved.
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 0;">
              This quote is valid for 7 days. Prices subject to availability.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: 'Zipsea Cruises <quotes@zipsea.com>',
      to: email,
      subject: `Your Cruise Quote is Ready! - Reference #${referenceNumber}`,
      html: emailHtml,
    });

    if (emailResponse.error) {
      console.error('Resend error:', emailResponse.error);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending quote ready email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}