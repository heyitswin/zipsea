import posthog from 'posthog-js';

/**
 * Analytics event tracking utilities for ZipSea
 * Comprehensive tracking for user behavior and conversion funnel
 */

// Event Categories
export const EventCategories = {
  NAVIGATION: 'navigation',
  SEARCH: 'search',
  CRUISE: 'cruise',
  QUOTE: 'quote',
  AUTH: 'authentication',
  ENGAGEMENT: 'engagement',
} as const;

// Track user properties
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.identify(userId, {
      ...properties,
      identified_at: new Date().toISOString(),
    });
  }
};

// Track cruise view
export const trackCruiseView = (cruiseData: {
  cruiseId: string;
  cruiseName: string;
  cruiseLine: string;
  nights: number;
  departureDate: string;
  price?: number;
  destination?: string;
}) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('cruise_viewed', {
      category: EventCategories.CRUISE,
      cruise_id: cruiseData.cruiseId,
      cruise_name: cruiseData.cruiseName,
      cruise_line: cruiseData.cruiseLine,
      nights: cruiseData.nights,
      departure_date: cruiseData.departureDate,
      price: cruiseData.price,
      destination: cruiseData.destination,
      timestamp: new Date().toISOString(),
    });

    // Increment user property for cruises viewed
    posthog.capture('$set', {
      $set_once: { first_cruise_viewed_at: new Date().toISOString() },
    });
  }
};

// Track search
export const trackSearch = (searchParams: {
  destination?: string;
  departurePort?: string;
  cruiseLine?: string;
  dateRange?: string;
  resultsCount: number;
}) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('search_performed', {
      category: EventCategories.SEARCH,
      ...searchParams,
      timestamp: new Date().toISOString(),
    });
  }
};

// Track quote request initiation
export const trackQuoteStart = (cruiseId: string, cabinType: string) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('quote_started', {
      category: EventCategories.QUOTE,
      cruise_id: cruiseId,
      cabin_type: cabinType,
      timestamp: new Date().toISOString(),
    });
  }
};

// Track quote form progress
export const trackQuoteProgress = (step: string, data?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('quote_form_progress', {
      category: EventCategories.QUOTE,
      step,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
};

// Track quote submission
export const trackQuoteSubmit = (quoteData: {
  cruiseId: string;
  cabinType: string;
  adults: number;
  children: number;
  hasDiscounts: boolean;
  discountTypes?: string[];
  travelInsurance: boolean;
  estimatedPrice?: number;
}) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('quote_submitted', {
      category: EventCategories.QUOTE,
      cruise_id: quoteData.cruiseId,
      cabin_type: quoteData.cabinType,
      adults: quoteData.adults,
      children: quoteData.children,
      total_passengers: quoteData.adults + quoteData.children,
      has_discounts: quoteData.hasDiscounts,
      discount_types: quoteData.discountTypes,
      travel_insurance: quoteData.travelInsurance,
      estimated_price: quoteData.estimatedPrice,
      timestamp: new Date().toISOString(),
    });

    // Track conversion event
    posthog.capture('conversion_quote_requested', {
      value: quoteData.estimatedPrice,
    });
  }
};

// Track authentication events
export const trackAuthEvent = (event: 'signup_started' | 'signup_completed' | 'login' | 'logout', method?: string) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture(event, {
      category: EventCategories.AUTH,
      method: method || 'email',
      timestamp: new Date().toISOString(),
    });

    if (event === 'logout') {
      posthog.reset();
    }
  }
};

// Track engagement metrics
export const trackEngagement = (action: string, details?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('user_engagement', {
      category: EventCategories.ENGAGEMENT,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
};

// Track filter usage
export const trackFilterUsage = (filterType: string, value: any) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('filter_applied', {
      category: EventCategories.SEARCH,
      filter_type: filterType,
      filter_value: value,
      timestamp: new Date().toISOString(),
    });
  }
};

// Track time on page (call on unmount)
export const trackTimeOnPage = (pageName: string, timeInSeconds: number) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('time_on_page', {
      category: EventCategories.ENGAGEMENT,
      page_name: pageName,
      time_seconds: timeInSeconds,
      time_minutes: Math.round(timeInSeconds / 60),
      timestamp: new Date().toISOString(),
    });
  }
};

// Track feature flag exposure
export const trackFeatureExposure = (featureName: string, variant: string) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('$feature_flag_called', {
      $feature_flag: featureName,
      $feature_flag_response: variant,
    });
  }
};

// Helper to get session replay URL
export const getSessionReplayUrl = (): string | null => {
  if (typeof window !== 'undefined' && posthog) {
    return posthog.get_session_replay_url();
  }
  return null;
};

// Track errors
export const trackError = (error: Error, context?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }
};