import { logger } from '../config/logger';

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
  private backendUrl: string;

  constructor() {
    this.backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://zipsea-production.onrender.com';
  }

  /**
   * Send quote ready email to customer
   */
  async sendQuoteReadyEmail(data: QuoteReadyEmailData): Promise<boolean> {
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://zipsea-frontend-production.onrender.com';
      
      // Call the frontend API to send the email
      const response = await fetch(`${frontendUrl}/api/send-quote-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Failed to send quote ready email:', error);
        return false;
      }

      logger.info('Quote ready email sent successfully', {
        referenceNumber: data.referenceNumber,
        email: data.email,
      });

      return true;
    } catch (error) {
      logger.error('Error sending quote ready email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();