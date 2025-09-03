import { logger } from '../config/logger';
import { Resend } from 'resend';
import { env } from '../config/environment';
import { db } from '../db/connection';
import { cabinCategories } from '../db/schema/cabin-categories';
import { eq, and } from 'drizzle-orm';

interface QuoteReadyEmailData {
  email: string;
  referenceNumber: string;
  cruiseName: string;
  shipName: string;
  shipId?: number;
  departureDate?: string;
  returnDate?: string;
  categories: Array<{
    category: string;
    roomName?: string;
    cabinCode?: string;
    finalPrice: number;
    obcAmount: number;
  }>;
  notes?: string;
}

interface QuoteConfirmationEmailData {
  email: string;
  firstName?: string;
  lastName?: string;
  referenceNumber: string;
  cruiseName?: string;
  shipName?: string;
  departureDate?: string;
  cabinType: string;
  adults: number;
  children: number;
  specialRequests?: string;
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
   * Get cabin image URL by ship ID and cabin code
   */
  private async getCabinImage(shipId: number, cabinCode: string): Promise<string | null> {
    try {
      const cabin = await db
        .select({ imageUrl: cabinCategories.imageUrl })
        .from(cabinCategories)
        .where(and(
          eq(cabinCategories.shipId, shipId),
          eq(cabinCategories.cabinCode, cabinCode)
        ))
        .limit(1);

      return cabin.length > 0 ? cabin[0].imageUrl : null;
    } catch (error) {
      logger.warn('Failed to fetch cabin image:', { shipId, cabinCode, error });
      return null;
    }
  }

  /**
   * Send quote ready email to customer
   */
  async sendQuoteReadyEmail(data: QuoteReadyEmailData): Promise<boolean> {
    logger.info('🔄 Starting sendQuoteReadyEmail process', {
      referenceNumber: data.referenceNumber,
      email: data.email,
      hasResendInstance: !!this.resend,
      resendApiKeyConfigured: !!env.RESEND_API_KEY,
      emailType: 'quote_ready'
    });
    
    try {
      if (!this.resend) {
        logger.warn('❌ Email service not configured - RESEND_API_KEY missing', {
          referenceNumber: data.referenceNumber,
          email: data.email,
          resendApiKeyConfigured: !!env.RESEND_API_KEY,
          emailType: 'quote_ready'
        });
        return false; // Changed to false to properly indicate failure
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

      // Build category options with images and new styling
      let optionSections = '';
      for (let i = 0; i < data.categories.length; i++) {
        const cat = data.categories[i];
        let cabinImageHtml = '';
        
        // Get cabin image if we have ship ID and cabin code
        if (data.shipId && cat.cabinCode) {
          const imageUrl = await this.getCabinImage(data.shipId, cat.cabinCode);
          if (imageUrl) {
            cabinImageHtml = `
              <div style="margin-bottom: 16px;">
                <img src="${imageUrl}" alt="${cat.roomName || cat.category}" style="width: 100%; max-width: 400px; height: 200px; object-fit: cover; border-radius: 8px;">
              </div>
            `;
          }
        }

        optionSections += `
          <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e0e0e0;">
            <h3 style="margin: 0 0 16px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">Option #${i + 1}</h3>
            ${cat.roomName ? `<p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Room Name:</strong> ${cat.roomName}</p>` : ''}
            <p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Category:</strong> ${cat.category}</p>
            ${cat.cabinCode ? `<p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Cabin Code:</strong> ${cat.cabinCode}</p>` : ''}
            ${cabinImageHtml}
            <div style="background: #E9B4EB; color: #0E1B4D; border-radius: 16px; padding: 16px; margin: 16px 0; text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 20px; letter-spacing: -0.02em;">
              $${cat.finalPrice.toLocaleString()} vacation total (incl. all fees, taxes, port expenses)
            </div>
            <div style="background: #1B8F57; color: white; border-radius: 16px; padding: 16px; margin: 16px 0; text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 20px; letter-spacing: -0.02em;">
              + $${cat.obcAmount} onboard credit
            </div>
          </div>
        `;
      }

      // Note from team section
      const noteSection = data.notes ? `
        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e0e0e0;">
          <h3 style="margin: 0 0 16px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">Note from our team</h3>
          <p style="margin: 0; color: #2f2f2f; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4; white-space: pre-line;">${data.notes}</p>
        </div>
      ` : '';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <!-- Hero Section -->
          <div style="text-align: center; margin-bottom: 32px; background: white; border-radius: 12px; padding: 24px;">
            <h1 style="color: #0E1B4D; margin: 0; font-family: Arial, sans-serif; font-size: 36px; font-weight: bold; letter-spacing: -0.02em;">Your quote is ready!</h1>
            <p style="color: #666; margin: 8px 0 0 0; font-family: Arial, sans-serif; font-size: 16px;">Reference: ${data.referenceNumber}</p>
          </div>
          
          <!-- Cruise Details -->
          <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e0e0e0;">
            <h2 style="color: #0E1B4D; margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">Cruise Details</h2>
            <p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Cruise:</strong> ${data.cruiseName}</p>
            ${data.shipName ? `<p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Ship:</strong> ${data.shipName}</p>` : ''}
            <p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Departure Date:</strong> ${formattedDepartureDate}</p>
            <p style="margin: 8px 0; color: #333; font-family: Arial, sans-serif; font-size: 16px;"><strong>Return Date:</strong> ${formattedReturnDate}</p>
          </div>
          
          <!-- Option Sections -->
          ${optionSections}
          
          <!-- Note from team -->
          ${noteSection}
          
          <!-- Ready to book section -->
          <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e0e0e0;">
            <h3 style="color: #0E1B4D; margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">Ready to book?</h3>
            <p style="color: #2f2f2f; margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">Reply to this email, we're ready to book your vacation for you. Or don't hesitate to reply if you have questions or want more quotes.</p>
          </div>
          
          <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 14px; margin: 0; font-family: Arial, sans-serif;">
              This quote is valid for 7 days from the date of this email.<br>
              Prices are subject to availability and may change.
            </p>
          </div>
        </div>
      `;

      logger.info('📧 Sending quote ready email via Resend API', {
        referenceNumber: data.referenceNumber,
        email: data.email,
        fromAddress: 'Zipsea Quote Team <zippy@zipsea.com>',
        emailType: 'quote_ready'
      });

      const result = await this.resend.emails.send({
        from: 'Zipsea Quote Team <zippy@zipsea.com>',
        to: [data.email],
        subject: `Your Cruise Quote is Ready - ${data.referenceNumber}`,
        html: emailHtml,
      });

      logger.info('📬 Resend API response received', {
        referenceNumber: data.referenceNumber,
        email: data.email,
        hasError: !!result.error,
        hasData: !!result.data,
        messageId: result.data?.id,
        errorDetails: result.error,
        emailType: 'quote_ready'
      });

      if (result.error) {
        logger.error('❌ Failed to send quote ready email via Resend API:', {
          error: result.error,
          referenceNumber: data.referenceNumber,
          email: data.email,
          emailType: 'quote_ready'
        });
        return false;
      }

      logger.info('✅ Quote ready email sent successfully to customer via Resend', {
        referenceNumber: data.referenceNumber,
        customerEmail: data.email,
        resendMessageId: result.data?.id,
        emailType: 'quote_ready'
      });

      return true;
    } catch (error) {
      logger.error('💥 Exception caught in sendQuoteReadyEmail:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        referenceNumber: data.referenceNumber,
        customerEmail: data.email,
        emailType: 'quote_ready',
        resendInstanceExists: !!this.resend,
        apiKeyConfigured: !!env.RESEND_API_KEY
      });
      return false;
    }
  }

  /**
   * Send quote confirmation email to customer (when they submit a quote request)
   */
  async sendQuoteConfirmationEmail(data: QuoteConfirmationEmailData): Promise<boolean> {
    try {
      if (!this.resend) {
        logger.warn('Email service not configured - skipping quote confirmation email send', {
          referenceNumber: data.referenceNumber,
          email: data.email,
        });
        return false; // Return false to indicate email was not sent
      }

      const customerName = data.firstName && data.lastName 
        ? `${data.firstName} ${data.lastName}`
        : data.firstName
        ? data.firstName
        : 'Valued Customer';

      const formattedDepartureDate = data.departureDate 
        ? new Date(data.departureDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'TBD';

      const passengerText = data.adults > 1 || data.children > 0
        ? `${data.adults} adult${data.adults > 1 ? 's' : ''}${data.children > 0 ? ` and ${data.children} child${data.children > 1 ? 'ren' : ''}` : ''}`
        : '1 passenger';

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1a73e8; margin: 0;">Quote Request Confirmed!</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Reference: <strong>${data.referenceNumber}</strong></p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">Dear ${customerName},</p>
            <p style="margin: 0 0 16px 0; color: #333;">Thank you for requesting a cruise quote! We've received your request and our team is working on finding you the best deals.</p>
            <p style="margin: 0; color: #333;">You'll receive a detailed quote within 24 hours with personalized pricing and options.</p>
          </div>
          
          <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0;">Your Request Details</h2>
            ${data.cruiseName ? `<p style="margin: 8px 0;"><strong>Cruise:</strong> ${data.cruiseName}</p>` : ''}
            ${data.shipName ? `<p style="margin: 8px 0;"><strong>Ship:</strong> ${data.shipName}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Departure Date:</strong> ${formattedDepartureDate}</p>
            <p style="margin: 8px 0;"><strong>Cabin Preference:</strong> ${data.cabinType.charAt(0).toUpperCase() + data.cabinType.slice(1)}</p>
            <p style="margin: 8px 0;"><strong>Passengers:</strong> ${passengerText}</p>
            ${data.specialRequests ? `<p style="margin: 8px 0;"><strong>Special Requests:</strong> ${data.specialRequests}</p>` : ''}
          </div>
          
          <div style="background: #e8f0fe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <h3 style="color: #1a73e8; margin: 0 0 16px 0;">What Happens Next?</h3>
            <div style="text-align: left; max-width: 400px; margin: 0 auto;">
              <p style="margin: 8px 0; color: #333;">✅ Our cruise specialists review your request</p>
              <p style="margin: 8px 0; color: #333;">🔍 We search for the best deals and availability</p>
              <p style="margin: 8px 0; color: #333;">📧 You receive personalized quotes within 24 hours</p>
            </div>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center;">
            <h3 style="color: #333; margin: 0 0 16px 0;">Have Questions?</h3>
            <p style="color: #666; margin: 0;">Reply to this email, we're ready to book your vacation for you.</p>
          </div>
          
          <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              Reference Number: ${data.referenceNumber}<br>
              This is an automated confirmation. Please keep this email for your records.
            </p>
          </div>
        </div>
      `;

      const result = await this.resend.emails.send({
        from: 'Zipsea Quote Team <zippy@zipsea.com>',
        to: [data.email],
        subject: `Quote Request Confirmed - ${data.referenceNumber}`,
        html: emailHtml,
      });

      if (result.error) {
        logger.error('Failed to send quote confirmation email via Resend:', {
          error: result.error,
          referenceNumber: data.referenceNumber,
          customerEmail: data.email,
        });
        return false;
      }

      logger.info('✅ Quote confirmation email sent successfully to customer', {
        referenceNumber: data.referenceNumber,
        customerEmail: data.email,
        resendMessageId: result.data?.id,
        emailType: 'customer_confirmation'
      });

      return true;
    } catch (error) {
      logger.error('❌ Error sending quote confirmation email to customer:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referenceNumber: data.referenceNumber,
        customerEmail: data.email,
        emailType: 'customer_confirmation'
      });
      return false;
    }
  }

  /**
   * Send internal notification to team about new quote request
   */
  async sendQuoteNotificationToTeam(data: QuoteConfirmationEmailData): Promise<boolean> {
    try {
      if (!this.resend) {
        logger.warn('Email service not configured - skipping team notification email', {
          referenceNumber: data.referenceNumber,
        });
        return false;
      }

      const customerName = data.firstName && data.lastName 
        ? `${data.firstName} ${data.lastName}`
        : data.firstName
        ? data.firstName
        : 'Unknown Customer';

      const formattedDepartureDate = data.departureDate 
        ? new Date(data.departureDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'TBD';

      const passengerText = data.adults > 1 || data.children > 0
        ? `${data.adults} adult${data.adults > 1 ? 's' : ''}${data.children > 0 ? ` and ${data.children} child${data.children > 1 ? 'ren' : ''}` : ''}`
        : '1 passenger';

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #d93025; margin: 0;">🚨 New Quote Request</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Reference: <strong>${data.referenceNumber}</strong></p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0;">Customer Information</h2>
            <p style="margin: 8px 0;"><strong>Name:</strong> ${customerName}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 8px 0;"><strong>Reference:</strong> ${data.referenceNumber}</p>
          </div>
          
          <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0;">Request Details</h2>
            ${data.cruiseName ? `<p style="margin: 8px 0;"><strong>Cruise:</strong> ${data.cruiseName}</p>` : ''}
            ${data.shipName ? `<p style="margin: 8px 0;"><strong>Ship:</strong> ${data.shipName}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Departure Date:</strong> ${formattedDepartureDate}</p>
            <p style="margin: 8px 0;"><strong>Cabin Preference:</strong> ${data.cabinType.charAt(0).toUpperCase() + data.cabinType.slice(1)}</p>
            <p style="margin: 8px 0;"><strong>Passengers:</strong> ${passengerText}</p>
            ${data.specialRequests ? `<p style="margin: 8px 0;"><strong>Special Requests:</strong> ${data.specialRequests}</p>` : ''}
          </div>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 12px; padding: 24px; text-align: center;">
            <h3 style="color: #155724; margin: 0 0 16px 0;">⏱️ Action Required</h3>
            <p style="color: #155724; margin: 0;">Please respond to this quote request within 24 hours via the admin dashboard.</p>
          </div>
          
          <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              Automated notification from Zipsea quote system<br>
              Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
            </p>
          </div>
        </div>
      `;

      const result = await this.resend.emails.send({
        from: 'Zipsea Quote Team <zippy@zipsea.com>',
        to: [env.TEAM_NOTIFICATION_EMAIL || 'win@zipsea.com'], // Team notification email from environment
        subject: `🚨 New Quote Request: ${data.referenceNumber}`,
        html: emailHtml,
      });

      if (result.error) {
        logger.error('Failed to send team notification email via Resend:', {
          error: result.error,
          referenceNumber: data.referenceNumber,
        });
        return false;
      }

      logger.info('📧 Team notification email sent successfully', {
        referenceNumber: data.referenceNumber,
        resendMessageId: result.data?.id,
        emailType: 'team_notification'
      });

      return true;
    } catch (error) {
      logger.error('❌ Error sending team notification email:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referenceNumber: data.referenceNumber,
        emailType: 'team_notification'
      });
      return false;
    }
  }
}

export const emailService = new EmailService();