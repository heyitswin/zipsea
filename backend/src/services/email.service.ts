import { Resend } from 'resend';
import { env } from '../config/environment';
import logger from '../config/logger';
import { db } from '../db/connection';
import { eq, and } from 'drizzle-orm';

interface QuoteReadyEmailData {
  email: string;
  referenceNumber: string;
  cruiseName: string;
  cruiseLineName?: string;
  shipName: string;
  shipId?: number;
  departureDate?: string;
  returnDate?: string;
  nights?: number;
  passengerCount?: number;
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
  referenceNumber: string;
  cruiseId: string;
  cruiseName: string;
  cruiseLineName?: string;
  shipName?: string;
  embarkPortName?: string;
  disembarkPortName?: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  cabinType: string;
  adults: number;
  children: number;
  specialRequests?: string;
  firstName?: string;
  lastName?: string;
}

interface ComprehensiveQuoteEmailData {
  email: string;
  referenceNumber: string;
  cruiseId: string;
  cruiseName: string;
  cruiseLineName?: string;
  shipName?: string;
  embarkPortName?: string;
  disembarkPortName?: string;
  departureDate: string;
  returnDate?: string;
  nights?: number;
  cabinType: string;
  adults: number;
  children: number;
  childAges?: number[];
  specialRequests?: string;
  additionalNotes?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  travelInsurance?: boolean;
  discountQualifiers?: {
    payInFull?: boolean;
    seniorCitizen?: boolean;
    military?: boolean;
    stateOfResidence?: string;
    loyaltyNumber?: string;
  };
  obcAmount?: number;
  totalPassengers?: number;
  posthogData?: {
    referrer: string | null;
    sessionDuration: number | null;
    device: string | null;
    location: string | null;
    pageviews: number;
    lastActiveAt: string | null;
  } | null;
}

export class EmailService {
  private resend: Resend | null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
      logger.info('✅ Email service initialized with Resend');
    } else {
      this.resend = null;
      logger.warn('Email service not configured - RESEND_API_KEY not found');
    }
  }

  private async getCabinImage(shipId: number, cabinCode: string): Promise<string | null> {
    // Cabin images not implemented yet
    return null;
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
      emailType: 'quote_ready',
    });

    try {
      if (!this.resend) {
        logger.warn('❌ Email service not configured - RESEND_API_KEY missing', {
          referenceNumber: data.referenceNumber,
          email: data.email,
          resendApiKeyConfigured: !!env.RESEND_API_KEY,
          emailType: 'quote_ready',
        });
        return false;
      }

      // Format dates - same as Quote request received email
      const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        try {
          const date = new Date(dateString);
          return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          });
        } catch {
          return dateString;
        }
      };

      // Use provided cruise line name or default
      const cruiseLineName = data.cruiseLineName || 'Cruise Line';

      // Build option sections with consistent styling
      let optionSections = '';
      for (let i = 0; i < data.categories.length; i++) {
        const cat = data.categories[i];

        optionSections += `
          <!-- Option ${i + 1} -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FFFFFF; border-radius: 10px; margin: 10px 0;">
                <tr>
                  <td style="padding: 36px;">
                    <h2 style="margin: 0 0 20px 0; color: #2F2F2F; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Option #${i + 1}</h2>

                    <!-- Room Details -->
                    ${
                      cat.roomName
                        ? `
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                      <tr>
                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">ROOM NAME</td>
                      </tr>
                      <tr>
                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cat.roomName}</td>
                      </tr>
                    </table>
                    `
                        : ''
                    }

                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
                      <tr>
                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">CATEGORY</td>
                      </tr>
                      <tr>
                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cat.cabinCode || cat.category}</td>
                      </tr>
                    </table>

                    <!-- Price Box -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #E9B4EB; border-radius: 10px; margin-bottom: 10px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <span style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">$${cat.finalPrice.toLocaleString()} vacation total</span>
                          <br>
                          <span style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 14px; font-weight: normal;">(incl. all fees, taxes, port expenses)</span>
                        </td>
                      </tr>
                    </table>

                    <!-- OBC Box -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1B8F57; border-radius: 10px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <span style="color: #FFFFFF; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">+ $${cat.obcAmount} onboard credit</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Cruise Quote is Ready</title>
          <style>
            @media only screen and (max-width: 600px) {
              .hero-headline { font-size: 32px !important; }
              .cruise-details-text { font-size: 18px !important; }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F6F3ED; font-family: Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          <!-- Wrapper table -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F6F3ED; min-height: 100vh;">
            <tr>
              <td align="center" valign="top" style="padding: 20px 0;">

                <!-- Main container -->
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
                            <!-- Headline only, no subhead -->
                            <h1 class="hero-headline" style="margin: 0; color: #FFFFFF; font-family: Arial, sans-serif; font-size: 42px; font-weight: bold; letter-spacing: -0.02em; line-height: 1.1;">Your quote is here</h1>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Cruise Details Section - same as Quote request received -->
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

                                  ${
                                    data.referenceNumber
                                      ? `
                                  <!-- Reference Number -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">REFERENCE NUMBER</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">#${data.referenceNumber}</td>
                                    </tr>
                                  </table>
                                  `
                                      : ''
                                  }

                                  ${
                                    data.cruiseName
                                      ? `
                                  <!-- Cruise -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">CRUISE</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${data.cruiseName}</td>
                                    </tr>
                                  </table>
                                  `
                                      : ''
                                  }

                                  ${
                                    data.shipName
                                      ? `
                                  <!-- Ship -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">SHIP</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${data.shipName}</td>
                                    </tr>
                                  </table>
                                  `
                                      : ''
                                  }

                                  <!-- Passengers -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">PASSENGERS</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${data.passengerCount || 2} adults</td>
                                    </tr>
                                  </table>

                                </td>
                                <td valign="top" style="width: 50%; padding-left: 20px;">

                                  <!-- Cruise Line -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">CRUISE LINE</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${cruiseLineName}</td>
                                    </tr>
                                  </table>

                                  ${
                                    data.departureDate
                                      ? `
                                  <!-- Departure -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">DEPARTURE</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${formatDate(data.departureDate)}</td>
                                    </tr>
                                  </table>
                                  `
                                      : ''
                                  }

                                  ${
                                    data.nights
                                      ? `
                                  <!-- Nights -->
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                    <tr>
                                      <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 5px;">NIGHTS</td>
                                    </tr>
                                    <tr>
                                      <td class="cruise-details-text" style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.4;">${data.nights} nights</td>
                                    </tr>
                                  </table>
                                  `
                                      : ''
                                  }

                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  ${optionSections}

                  ${
                    data.notes && data.notes.trim()
                      ? `
                  <!-- Note from team Section -->
                  <tr>
                    <td style="padding: 0;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FFFFFF; border-radius: 10px; margin: 10px 0;">
                        <tr>
                          <td style="padding: 36px;">
                            <h2 style="margin: 0 0 15px 0; color: #2F2F2F; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Note from our team</h2>
                            <p style="margin: 0; color: #2F2F2F; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; white-space: pre-line;">${data.notes}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  `
                      : ''
                  }

                  <!-- Ready to book Section -->
                  <tr>
                    <td style="padding: 0;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #E9B4EB; border-radius: 10px; margin: 10px 0;">
                        <tr>
                          <td style="padding: 36px;">
                            <h2 style="margin: 0 0 15px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Ready to book?</h2>
                            <p style="margin: 0 0 15px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5;">Reply to this email, we're ready to book your vacation for you.</p>
                            <p style="margin: 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5;">Or don't hesitate to reply if you have questions or want more quotes.</p>
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

      logger.info('📧 Sending quote ready email via Resend API', {
        referenceNumber: data.referenceNumber,
        email: data.email,
        fromAddress: 'Zipsea Quote Team <zippy@zipsea.com>',
        emailType: 'quote_ready',
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
        emailType: 'quote_ready',
      });

      if (result.error) {
        logger.error('❌ Failed to send quote ready email via Resend API:', {
          error: result.error,
          referenceNumber: data.referenceNumber,
          email: data.email,
          emailType: 'quote_ready',
        });
        return false;
      }

      logger.info('✅ Quote ready email sent successfully to customer via Resend', {
        referenceNumber: data.referenceNumber,
        customerEmail: data.email,
        resendMessageId: result.data?.id,
        emailType: 'quote_ready',
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
        apiKeyConfigured: !!env.RESEND_API_KEY,
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
        logger.warn('Email service not configured - RESEND_API_KEY not found');
        return false;
      }

      // Extract first name if available
      const firstName = data.firstName || 'there';

      // Format dates
      const formattedDepartureDate = new Date(data.departureDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const formattedReturnDate = new Date(data.returnDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1a73e8; margin: 0;">Quote Request Confirmed!</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Reference: <strong>${data.referenceNumber}</strong></p>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0; font-size: 18px;">Hi ${firstName},</h2>
            <p style="color: #666; line-height: 1.5; margin: 0 0 16px 0;">Thank you for your quote request! Our cruise specialists are reviewing your request and will get back to you within 24 hours with the best available pricing and options.</p>
          </div>

          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #333; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Cruise Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Cruise:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cruiseName}</td>
              </tr>
              ${
                data.cruiseLineName
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Cruise Line:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cruiseLineName}</td>
              </tr>
              `
                  : ''
              }
              ${
                data.shipName
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Ship:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.shipName}</td>
              </tr>
              `
                  : ''
              }
              <tr>
                <td style="padding: 8px 0; color: #666;">Departure:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${formattedDepartureDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Return:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${formattedReturnDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Duration:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.nights} nights</td>
              </tr>
              ${
                data.embarkPortName
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Embark Port:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.embarkPortName}</td>
              </tr>
              `
                  : ''
              }
              ${
                data.disembarkPortName
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Disembark Port:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.disembarkPortName}</td>
              </tr>
              `
                  : ''
              }
            </table>
          </div>

          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #333; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Your Request</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Cabin Type:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cabinType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Passengers:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.adults} adult${data.adults !== 1 ? 's' : ''}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? 'ren' : ''}` : ''}</td>
              </tr>
              ${
                data.specialRequests
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666; vertical-align: top;">Special Requests:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.specialRequests}</td>
              </tr>
              `
                  : ''
              }
            </table>
          </div>

          <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; text-align: center;">
            <h3 style="color: #1a73e8; margin: 0 0 12px 0; font-size: 18px;">What Happens Next?</h3>
            <p style="color: #666; line-height: 1.5; margin: 0;">Our cruise specialists will review your request and provide you with the best available pricing, cabin options, and any special promotions. You'll receive a detailed quote via email within 24 hours.</p>
          </div>

          <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 14px; margin: 0;">Questions? Reply to this email or contact us</p>
            <p style="color: #999; font-size: 14px; margin: 8px 0 0 0;">ZipSea Cruises • Your Cruise Booking Specialists</p>
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
        logger.error('Failed to send quote confirmation email:', result.error);
        return false;
      }

      logger.info('Quote confirmation email sent successfully', {
        referenceNumber: data.referenceNumber,
        email: data.email,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send quote confirmation email:', error);
      return false;
    }
  }

  /**
   * Send quote notification email to team
   */
  async sendQuoteNotificationToTeam(data: QuoteConfirmationEmailData): Promise<boolean> {
    try {
      if (!this.resend) {
        logger.warn('Email service not configured - RESEND_API_KEY not found');
        return false;
      }

      // Use a team notification email address from environment or default
      const teamEmail = env.TEAM_NOTIFICATION_EMAIL || 'team@zipsea.com';

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #ff9800; margin: 0;">New Quote Request!</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Reference: <strong>${data.referenceNumber}</strong></p>
          </div>

          <div style="background: #fff3e0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; margin: 0 0 16px 0; font-size: 18px;">Customer Information</h2>
            <p style="color: #666; margin: 4px 0;"><strong>Name:</strong> ${data.firstName || 'Not provided'} ${data.lastName || ''}</p>
            <p style="color: #666; margin: 4px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="color: #666; margin: 4px 0;"><strong>Quote ID:</strong> ${data.referenceNumber}</p>
          </div>

          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #333; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Cruise Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Cruise ID:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cruiseId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Cruise Name:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cruiseName}</td>
              </tr>
              ${
                data.cruiseLineName
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Cruise Line:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cruiseLineName}</td>
              </tr>
              `
                  : ''
              }
              ${
                data.shipName
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Ship:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.shipName}</td>
              </tr>
              `
                  : ''
              }
              <tr>
                <td style="padding: 8px 0; color: #666;">Departure:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${new Date(data.departureDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Return:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${new Date(data.returnDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Duration:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.nights} nights</td>
              </tr>
            </table>
          </div>

          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #333; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Quote Request Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Cabin Type:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.cabinType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Passengers:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.adults} adult${data.adults !== 1 ? 's' : ''}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? 'ren' : ''}` : ''}</td>
              </tr>
              ${
                data.specialRequests
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #666; vertical-align: top;">Special Requests:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 500;">${data.specialRequests}</td>
              </tr>
              `
                  : ''
              }
            </table>
          </div>

          <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; text-align: center;">
            <h3 style="color: #2e7d32; margin: 0 0 12px 0; font-size: 18px;">Action Required</h3>
            <p style="color: #666; line-height: 1.5; margin: 0;">Please prepare a quote for this customer within 24 hours. Access the admin panel to view full details and respond to this quote request.</p>
            <a href="${process.env.FRONTEND_URL || 'https://www.zipsea.com'}/admin/quotes" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2e7d32; color: white; text-decoration: none; border-radius: 4px;">View in Admin Panel</a>
          </div>
        </div>
      `;

      const result = await this.resend.emails.send({
        from: 'Zipsea Notifications <zippy@zipsea.com>',
        to: [teamEmail],
        subject: `[New Quote] ${data.referenceNumber} - ${data.cruiseName}`,
        html: emailHtml,
      });

      if (result.error) {
        logger.error('Failed to send team notification email:', result.error);
        return false;
      }

      logger.info('Team notification email sent successfully', {
        referenceNumber: data.referenceNumber,
        teamEmail,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send team notification email:', error);
      return false;
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfig(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.resend) {
        return {
          success: false,
          message: 'Email service not configured - RESEND_API_KEY not found',
        };
      }

      // Try to send a test email
      const result = await this.resend.emails.send({
        from: 'Zipsea Test <zippy@zipsea.com>',
        to: ['test@zipsea.com'],
        subject: 'Email Configuration Test',
        html: '<p>This is a test email to verify configuration.</p>',
      });

      if (result.error) {
        return {
          success: false,
          message: `Email service configured but failed to send: ${result.error.message}`,
        };
      }

      return {
        success: true,
        message: 'Email service configured and working',
      };
    } catch (error) {
      return {
        success: false,
        message: `Email service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Send comprehensive quote notification to zippy@zipsea.com with ALL details
   */
  async sendComprehensiveQuoteNotification(data: ComprehensiveQuoteEmailData): Promise<boolean> {
    try {
      if (!this.resend) {
        logger.warn('Email service not configured - RESEND_API_KEY not found');
        return false;
      }

      // Format dates
      const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'Not provided';
        try {
          const date = new Date(dateString);
          return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          });
        } catch {
          return dateString;
        }
      };

      // Format discount qualifiers
      const formatDiscountQualifiers = (qualifiers: any) => {
        const items = [];
        if (qualifiers?.payInFull) items.push('Pay in Full');
        if (qualifiers?.seniorCitizen) items.push('Senior Citizen');
        if (qualifiers?.military) items.push('Military');
        if (qualifiers?.stateOfResidence) items.push(`State: ${qualifiers.stateOfResidence}`);
        if (qualifiers?.loyaltyNumber) items.push(`Loyalty #: ${qualifiers.loyaltyNumber}`);
        return items.length > 0 ? items.join(', ') : 'None';
      };

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Quote Request - ${data.referenceNumber}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 20px auto; background: white; border: 1px solid #ddd;">
            <!-- Header -->
            <div style="background: #0E1B4D; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">NEW QUOTE REQUEST</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Reference: ${data.referenceNumber}</p>
            </div>

            <!-- Customer Information -->
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">CUSTOMER INFORMATION</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 5px 0; width: 40%; color: #666;">Name:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.firstName || 'Not provided'} ${data.lastName || ''}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Email:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.email}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Phone:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.phone || 'Not provided'}</strong></td>
                </tr>
              </table>
            </div>

            <!-- Cruise Details -->
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">CRUISE DETAILS</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 5px 0; width: 40%; color: #666;">Cruise ID:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.cruiseId}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Cruise Name:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.cruiseName || 'Not available'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Cruise Line:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.cruiseLineName || 'Not available'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Ship:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.shipName || 'Not available'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Departure Date:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${formatDate(data.departureDate)}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Return Date:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.returnDate ? formatDate(data.returnDate) : 'To be calculated'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Duration:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.nights ? `${data.nights} nights` : 'To be determined'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Embark Port:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.embarkPortName || 'Not available'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Disembark Port:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.disembarkPortName || 'Not available'}</strong></td>
                </tr>
              </table>
            </div>

            <!-- Cabin & Passenger Details -->
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">CABIN & PASSENGER DETAILS</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 5px 0; width: 40%; color: #666;">Cabin Type Selected:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.cabinType}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Adults:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.adults}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Children:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.children}</strong></td>
                </tr>
                ${
                  data.childAges && data.childAges.length > 0
                    ? `
                <tr>
                  <td style="padding: 5px 0; color: #666;">Child Ages:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.childAges.map((age, i) => `Child ${i + 1}: ${age} years`).join(', ')}</strong></td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 5px 0; color: #666;">Total Passengers:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.totalPassengers || data.adults + data.children}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Travel Insurance:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.travelInsurance ? 'Yes' : 'No'}</strong></td>
                </tr>
              </table>
            </div>

            <!-- Discount Qualifiers -->
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">DISCOUNT QUALIFIERS</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 5px 0; color: #333;"><strong>${formatDiscountQualifiers(data.discountQualifiers)}</strong></td>
                </tr>
              </table>
            </div>

            <!-- Special Requests -->
            ${
              data.specialRequests
                ? `
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">SPECIAL REQUESTS</h2>
              <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">${data.specialRequests}</p>
            </div>
            `
                : ''
            }

            <!-- Additional Notes -->
            ${
              data.additionalNotes
                ? `
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">ADDITIONAL NOTES</h2>
              <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">${data.additionalNotes}</p>
            </div>
            `
                : ''
            }

            <!-- Onboard Credit -->
            ${
              data.obcAmount
                ? `
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">ONBOARD CREDIT</h2>
              <p style="margin: 0; font-size: 16px; color: #333;"><strong>$${data.obcAmount}</strong></p>
            </div>
            `
                : ''
            }

            <!-- Session Analytics (PostHog) -->
            ${
              data.posthogData
                ? `
            <div style="padding: 20px; border-bottom: 1px solid #eee; background: #f9fafb;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0E1B4D;">📊 SESSION ANALYTICS</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 5px 0; color: #666; width: 40%;">Referring Domain:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.posthogData.referrer || 'Direct / Unknown'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Time on Site:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${
                    data.posthogData.sessionDuration
                      ? Math.floor(data.posthogData.sessionDuration / 60) +
                        'm ' +
                        (data.posthogData.sessionDuration % 60) +
                        's'
                      : 'Less than 1 minute'
                  }</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Device:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.posthogData.device || 'Unknown'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Location:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.posthogData.location || 'Unknown'}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Pages Viewed:</td>
                  <td style="padding: 5px 0; color: #333;"><strong>${data.posthogData.pageviews}</strong></td>
                </tr>
              </table>
            </div>
            `
                : ''
            }

            <!-- Footer -->
            <div style="padding: 20px; background: #f8f8f8; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
                This quote request was submitted on ${new Date().toLocaleString('en-US', {
                  timeZone: 'America/Los_Angeles',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })} PST
              </p>
              <p style="margin: 0; font-size: 12px; color: #666;">
                Please respond within 24 hours.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await this.resend.emails.send({
        from: 'Zipsea Quote System <zippy@zipsea.com>',
        to: ['zippy@zipsea.com'],
        subject: `[QUOTE] ${data.referenceNumber} - ${data.cruiseName || 'Cruise'} - ${data.firstName || 'Customer'} ${data.lastName || ''}`,
        html: emailHtml,
      });

      if (result.error) {
        logger.error('Failed to send comprehensive quote notification to zippy@zipsea.com:', {
          error: result.error,
          referenceNumber: data.referenceNumber,
        });
        return false;
      }

      logger.info('Comprehensive quote notification sent to zippy@zipsea.com', {
        referenceNumber: data.referenceNumber,
        messageId: result.data?.id,
      });

      return true;
    } catch (error) {
      logger.error('Exception in sendComprehensiveQuoteNotification:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referenceNumber: data.referenceNumber,
      });
      return false;
    }
  }

  /**
   * Send test email to specific address
   */
  async sendTestEmail(to: string, type: 'confirmation' | 'team' | 'ready'): Promise<boolean> {
    try {
      const testData: QuoteConfirmationEmailData = {
        email: to,
        referenceNumber: 'TEST-' + Date.now(),
        cruiseId: 'test-cruise-123',
        cruiseName: 'Test Caribbean Adventure',
        cruiseLineName: 'Test Cruise Line',
        shipName: 'Test Ship',
        embarkPortName: 'Miami, FL',
        disembarkPortName: 'Miami, FL',
        departureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        returnDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(),
        nights: 7,
        cabinType: 'Balcony',
        adults: 2,
        children: 0,
        specialRequests: 'This is a test email',
        firstName: 'Test',
        lastName: 'User',
      };

      switch (type) {
        case 'confirmation':
          return await this.sendQuoteConfirmationEmail({
            ...testData,
            email: to,
          });
        case 'team':
          return await this.sendQuoteNotificationToTeam({
            ...testData,
            email: to,
          });
        case 'ready':
          return await this.sendQuoteReadyEmail({
            email: to,
            referenceNumber: testData.referenceNumber,
            cruiseName: testData.cruiseName,
            shipName: testData.shipName || '',
            departureDate: testData.departureDate,
            nights: testData.nights,
            passengerCount: testData.adults,
            categories: [
              {
                category: 'Interior',
                roomName: 'Standard Interior',
                cabinCode: 'INT',
                finalPrice: 1299,
                obcAmount: 100,
              },
              {
                category: 'Balcony',
                roomName: 'Deluxe Balcony',
                cabinCode: 'BAL',
                finalPrice: 1899,
                obcAmount: 150,
              },
            ],
            notes: 'This is a test quote ready email. The prices shown are examples only.',
          });
        default:
          return false;
      }
    } catch (error) {
      logger.error('Failed to send test email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
