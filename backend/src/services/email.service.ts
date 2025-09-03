import { logger } from '../config/logger';
import { Resend } from 'resend';
import { env } from '../config/environment';

interface QuoteReadyEmailData {
  email: string;
  referenceNumber: string;
  cruiseName: string;
  shipName: string;
  departureDate?: string;
  returnDate?: string;
  categories: Array<{
    category: string;
    roomName?: string;
    finalPrice: number;
    obcAmount: number;
  }>;
  notes?: string;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    } else {
      logger.warn('RESEND_API_KEY not configured - email service will be disabled');
    }
  }

  /**
   * Send quote ready email to customer
   */
  async sendQuoteReadyEmail(data: QuoteReadyEmailData): Promise<boolean> {
    try {
      if (!this.resend) {
        logger.warn('Email service not configured - skipping email send', {
          referenceNumber: data.referenceNumber,
          email: data.email,
        });
        return true; // Return true to not break the quote response flow
      }

      const formattedDepartureDate = data.departureDate 
        ? new Date(data.departureDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'TBD';

      const formattedReturnDate = data.returnDate 
        ? new Date(data.returnDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'TBD';

      // Format categories for display
      const categoryDetails = data.categories.map(cat => {
        return `
          <div style="margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; color: #1a73e8;">${cat.category}</h3>
            ${cat.roomName ? `<p style="margin: 4px 0;"><strong>Room:</strong> ${cat.roomName}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Price:</strong> $${cat.finalPrice.toLocaleString()}</p>
            <p style="margin: 4px 0;"><strong>Onboard Credit:</strong> $${cat.obcAmount}</p>
          </div>
        `;
      }).join('');

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1a73e8; margin: 0;">Your Cruise Quote is Ready!</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Reference: ${data.referenceNumber}</p>
          </div>
          
          <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0;">Cruise Details</h2>
            <p style="margin: 8px 0;"><strong>Cruise:</strong> ${data.cruiseName}</p>
            ${data.shipName ? `<p style="margin: 8px 0;"><strong>Ship:</strong> ${data.shipName}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Departure Date:</strong> ${formattedDepartureDate}</p>
            <p style="margin: 8px 0;"><strong>Return Date:</strong> ${formattedReturnDate}</p>
          </div>
          
          <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0;">Available Options</h2>
            ${categoryDetails}
            ${data.notes ? `
              <div style="margin-top: 16px; padding: 16px; background: #e8f0fe; border-radius: 8px;">
                <h3 style="margin: 0 0 8px 0; color: #1a73e8;">Additional Notes</h3>
                <p style="margin: 0; white-space: pre-line;">${data.notes}</p>
              </div>
            ` : ''}
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center;">
            <h3 style="color: #333; margin: 0 0 16px 0;">Ready to Book?</h3>
            <p style="color: #666; margin: 0 0 16px 0;">Contact our team to secure your cruise at these prices!</p>
            <p style="color: #666; margin: 0;"><strong>Email:</strong> bookings@zipsea.com</p>
            <p style="color: #666; margin: 4px 0 0 0;"><strong>Phone:</strong> 1-800-ZIPSEA</p>
          </div>
          
          <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              This quote is valid for 7 days from the date of this email.<br>
              Prices are subject to availability and may change.
            </p>
          </div>
        </div>
      `;

      const result = await this.resend.emails.send({
        from: 'Zipsea <quotes@zipsea.com>',
        to: [data.email],
        subject: `Your Cruise Quote is Ready - ${data.referenceNumber}`,
        html: emailHtml,
      });

      if (result.error) {
        logger.error('Failed to send quote ready email via Resend:', result.error);
        return false;
      }

      logger.info('Quote ready email sent successfully via Resend', {
        referenceNumber: data.referenceNumber,
        email: data.email,
        messageId: result.data?.id,
      });

      return true;
    } catch (error) {
      logger.error('Error sending quote ready email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();