import { logger } from '../config/logger';

interface PostHogSessionData {
  referrer: string | null;
  sessionDuration: number | null; // in seconds
  device: string | null;
  location: string | null;
  pageviews: number;
  lastActiveAt: string | null;
}

class PostHogService {
  private projectId: string;
  private apiKey: string;
  private baseUrl = 'https://us.i.posthog.com';

  constructor() {
    this.projectId = process.env.POSTHOG_PROJECT_ID || '';
    this.apiKey = process.env.POSTHOG_API_KEY || '';

    if (!this.projectId || !this.apiKey) {
      logger.warn('PostHog not configured - POSTHOG_PROJECT_ID or POSTHOG_API_KEY not found');
    }
  }

  /**
   * Fetch session data for a user (by email or distinct_id)
   * Gets the most recent session data including referrer, duration, device, location
   */
  async getUserSessionData(distinctId: string): Promise<PostHogSessionData | null> {
    if (!this.projectId || !this.apiKey) {
      return null;
    }

    try {
      // Query PostHog events API for the user's recent session
      // We'll look for $pageview events and session metadata
      const response = await fetch(
        `${this.baseUrl}/api/projects/${this.projectId}/events?distinct_id=${encodeURIComponent(distinctId)}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        logger.warn('PostHog API request failed', {
          status: response.status,
          distinctId,
        });
        return null;
      }

      const data: any = await response.json();
      const events = data.results || [];

      if (events.length === 0) {
        return null;
      }

      // Find the most recent session
      const sessionEvents = events.filter((e: any) => e.event === '$pageview');

      if (sessionEvents.length === 0) {
        return null;
      }

      // Get the most recent pageview to extract session data
      const latestEvent = sessionEvents[0];
      const properties = latestEvent.properties || {};

      // Calculate session duration from first to last event in this session
      const sessionId = properties.$session_id;
      const sessionPageviews = sessionEvents.filter(
        (e: any) => e.properties?.$session_id === sessionId
      );

      let sessionDuration: number | null = null;
      if (sessionPageviews.length > 1) {
        const firstEvent = sessionPageviews[sessionPageviews.length - 1];
        const lastEvent = sessionPageviews[0];
        const firstTime = new Date(firstEvent.timestamp).getTime();
        const lastTime = new Date(lastEvent.timestamp).getTime();
        sessionDuration = Math.floor((lastTime - firstTime) / 1000); // Convert to seconds
      }

      const sessionData: PostHogSessionData = {
        referrer: properties.$referrer || properties.$referring_domain || null,
        sessionDuration,
        device: this.formatDevice(properties),
        location: this.formatLocation(properties),
        pageviews: sessionPageviews.length,
        lastActiveAt: latestEvent.timestamp || null,
      };

      logger.info('PostHog session data retrieved', {
        distinctId,
        sessionData,
      });

      return sessionData;
    } catch (error) {
      logger.error('Error fetching PostHog session data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        distinctId,
      });
      return null;
    }
  }

  /**
   * Format device information from PostHog properties
   */
  private formatDevice(properties: any): string {
    const deviceType = properties.$device_type || '';
    const browser = properties.$browser || '';
    const os = properties.$os || '';

    const parts = [];
    if (deviceType) parts.push(deviceType);
    if (browser) parts.push(browser);
    if (os) parts.push(os);

    return parts.length > 0 ? parts.join(' • ') : 'Unknown';
  }

  /**
   * Format location information from PostHog properties
   */
  private formatLocation(properties: any): string {
    const city = properties.$geoip_city_name || '';
    const region = properties.$geoip_subdivision_1_name || '';
    const country = properties.$geoip_country_name || '';

    const parts = [];
    if (city) parts.push(city);
    if (region && region !== city) parts.push(region);
    if (country) parts.push(country);

    return parts.length > 0 ? parts.join(', ') : 'Unknown';
  }

  /**
   * Format session duration into human-readable string
   */
  formatDuration(seconds: number | null): string {
    if (!seconds) return 'Less than 1 minute';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    }

    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  }
}

export const posthogService = new PostHogService();
