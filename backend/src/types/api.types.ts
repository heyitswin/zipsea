/**
 * API Response Types
 * Standardized response interfaces for API endpoints
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: any;
  timestamp: string;
  path: string;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams, SortParams {
  q?: string;
}

/**
 * Cruise Search Types
 */
export interface CruiseSearchParams extends SearchParams {
  destination?: string;
  departurePort?: string;
  cruiseLine?: string;
  ship?: string;
  minNights?: number;
  maxNights?: number;
  minPrice?: number;
  maxPrice?: number;
  sailingDateFrom?: string;
  sailingDateTo?: string;
  cabinType?: 'interior' | 'oceanview' | 'balcony' | 'suite';
}

export interface CruiseSearchResult {
  cruises: CruiseListItem[];
  filters: SearchFilters;
  meta: ApiMeta;
}

export interface CruiseListItem {
  id: number;
  name: string;
  cruiseLine: {
    id: number;
    name: string;
    logoUrl?: string;
  };
  ship: {
    id: number;
    name: string;
    imageUrl?: string;
  };
  sailingDate: string;
  returnDate: string;
  nights: number;
  embarkPort: {
    id: number;
    name: string;
    city?: string;
    country?: string;
  };
  disembarkPort: {
    id: number;
    name: string;
    city?: string;
    country?: string;
  };
  regions: Array<{
    id: number;
    name: string;
  }>;
  pricing: {
    cheapest?: PricingSummary;
    interior?: PricingSummary;
    oceanview?: PricingSummary;
    balcony?: PricingSummary;
    suite?: PricingSummary;
  };
  availability: boolean;
  highlights?: string[];
}

export interface CruiseDetails extends CruiseListItem {
  itinerary: ItineraryDay[];
  cabinCategories: CabinCategory[];
  ship: ShipDetails;
  inclusions: string[];
  exclusions: string[];
  policies: {
    cancellation: string;
    age: string;
    smoking: string;
    dress: string;
  };
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  port?: {
    id: number;
    name: string;
    city?: string;
    country?: string;
    imageUrl?: string;
  };
  arrivalTime?: string;
  departureTime?: string;
  isSeaDay: boolean;
  description?: string;
  excursions?: Excursion[];
}

export interface Excursion {
  id: string;
  name: string;
  description: string;
  duration: string;
  priceFrom: number;
  difficulty: 'easy' | 'moderate' | 'strenuous';
  category: string;
}

export interface CabinCategory {
  id: number;
  shipId: number;
  cabinCode: string;
  category: 'interior' | 'oceanview' | 'balcony' | 'suite';
  name: string;
  description?: string;
  size: number;
  maxOccupancy: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
}

export interface ShipDetails {
  id: number;
  name: string;
  cruiseLineId: number;
  cruiseLine: {
    id: number;
    name: string;
    logoUrl?: string;
  };
  description?: string;
  yearBuilt?: number;
  refurbishedYear?: number;
  tonnage?: number;
  length?: number;
  beam?: number;
  maxGuests?: number;
  crewSize?: number;
  decks?: number;
  staterooms?: number;
  images: string[];
  amenities: string[];
  restaurants: string[];
  bars: string[];
  entertainment: string[];
  isActive: boolean;
}

export interface PricingSummary {
  basePrice: number;
  totalPrice: number;
  taxes: number;
  fees: number;
  currency: string;
  rateName?: string;
  perPerson: boolean;
}

export interface SearchFilters {
  cruiseLines: FilterOption[];
  ships: FilterOption[];
  destinations: FilterOption[];
  departurePorts: FilterOption[];
  nightsRange: {
    min: number;
    max: number;
  };
  priceRange: {
    min: number;
    max: number;
  };
  sailingDateRange: {
    min: string;
    max: string;
  };
}

export interface FilterOption {
  value: string | number;
  label: string;
  count: number;
}

/**
 * Quote Request Types
 */
export interface QuoteRequestData {
  cruiseId: number;
  passengerDetails: PassengerDetails;
  cabinPreference?: 'interior' | 'oceanview' | 'balcony' | 'suite';
  specialRequests?: string;
  contactInfo: ContactInfo;
}

export interface PassengerDetails {
  adults: number;
  children: number;
  infants: number;
  ages?: number[];
}

export interface ContactInfo {
  email: string;
  phone?: string;
  preferredContactMethod: 'email' | 'phone';
}

export interface QuoteRequest {
  id: string;
  userId: string;
  cruiseId: number;
  cruise: CruiseListItem;
  passengerDetails: PassengerDetails;
  cabinPreference?: 'interior' | 'oceanview' | 'balcony' | 'suite';
  specialRequests?: string;
  contactInfo: ContactInfo;
  status: 'pending' | 'quoted' | 'expired' | 'declined';
  quote?: Quote;
  requestedAt: string;
  quoteExpiresAt?: string;
}

export interface Quote {
  totalPrice: number;
  breakdown: QuoteBreakdown;
  currency: string;
  validUntil: string;
  terms: string;
  agentNotes?: string;
}

export interface QuoteBreakdown {
  basePrice: number;
  taxes: number;
  fees: number;
  discounts?: number;
  extras?: Array<{
    name: string;
    price: number;
  }>;
}

/**
 * User Types
 */
export interface UserProfile {
  id: string;
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  preferences?: UserPreferences;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  cruiseLines?: number[];
  destinations?: string[];
  cabinTypes?: Array<'interior' | 'oceanview' | 'balcony' | 'suite'>;
  budgetRange?: {
    min?: number;
    max?: number;
  };
  notifications?: {
    email: boolean;
    sms: boolean;
    deals: boolean;
    reminders: boolean;
  };
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  searchCriteria: CruiseSearchParams;
  alertEnabled: boolean;
  alertFrequency: 'daily' | 'weekly' | 'monthly';
  lastChecked?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Health Check Types
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    traveltek?: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

export default {
  ApiResponse,
  ApiError,
  ApiMeta,
  CruiseSearchResult,
  CruiseListItem,
  CruiseDetails,
  QuoteRequest,
  UserProfile,
  SavedSearch,
  HealthStatus,
};