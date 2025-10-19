/**
 * Traveltek Fusion API Service
 *
 * Handles OAuth 2.0 authentication and API requests to Traveltek Fusion API
 * for live cruise booking functionality.
 *
 * Features:
 * - OAuth token management with automatic refresh
 * - Request/response interceptors
 * - Error handling and retries
 * - Type-safe API methods
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { createClient, RedisClientType } from 'redis';

// Environment configuration
const TRAVELTEK_API_USERNAME = process.env.TRAVELTEK_API_USERNAME || '';
const TRAVELTEK_API_PASSWORD = process.env.TRAVELTEK_API_PASSWORD || '';
const TRAVELTEK_API_BASE_URL =
  process.env.TRAVELTEK_API_BASE_URL || 'https://fusionapi.traveltek.net/2.1/json';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Token cache key
const TOKEN_CACHE_KEY = 'traveltek:access_token';
const TOKEN_EXPIRY_BUFFER = 300; // Refresh 5 minutes before expiry

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ApiError {
  code: number;
  message: string;
}

interface ApiResponse<T = any> {
  errors?: ApiError[];
  warnings?: string[];
  results?: T;
  meta?: any;
  timing?: any;
  [key: string]: any;
}

export class TraveltekApiService {
  private axiosInstance: AxiosInstance;
  private redisClient: RedisClientType | null = null;
  private currentToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: TRAVELTEK_API_BASE_URL,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Initialize Redis client
    this.initRedis();

    // Add request interceptor to inject token
    this.axiosInstance.interceptors.request.use(
      async config => {
        // Skip token injection for token endpoint itself
        if (config.url?.includes('token.pl')) {
          return config;
        }

        // Ensure we have a valid token
        const token = await this.getValidToken();

        // Add token as requestid parameter
        if (config.method === 'get') {
          config.params = {
            ...config.params,
            requestid: token,
          };
        } else if (config.method === 'post') {
          // For POST requests with URLSearchParams (form data), add to the body
          if (config.data instanceof URLSearchParams) {
            config.data.append('requestid', token);
          } else if (config.headers) {
            // For other POST requests, add to headers as fallback
            config.headers.requestid = token;
          }
        }

        return config;
      },
      error => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        // Check if error is 401 or token expired error code
        if (error.response?.status === 401 || this.isTokenExpiredError(error)) {
          // Clear cached token and retry once
          await this.clearCachedToken();
          this.currentToken = null;
          this.tokenExpiresAt = 0;

          // Retry the request once with new token
          if (
            originalRequest &&
            originalRequest.headers &&
            !originalRequest.headers['X-Retry-Attempt']
          ) {
            originalRequest.headers['X-Retry-Attempt'] = '1';
            return this.axiosInstance(originalRequest);
          }
        }

        // Retry logic for network errors and 5xx errors
        if (originalRequest && originalRequest.headers) {
          const retryCount = parseInt(originalRequest.headers['X-Retry-Count'] as string) || 0;
          const maxRetries = 3;

          // Retry on network errors or 5xx server errors
          const shouldRetry =
            !error.response || // Network error (no response)
            (error.response.status >= 500 && error.response.status < 600); // 5xx errors

          if (shouldRetry && retryCount < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, retryCount) * 1000;

            console.log(
              `⚠️  Traveltek API: Retrying request (attempt ${retryCount + 1}/${maxRetries}) after ${delayMs}ms`
            );

            await new Promise(resolve => setTimeout(resolve, delayMs));

            originalRequest.headers['X-Retry-Count'] = (retryCount + 1).toString();
            return this.axiosInstance(originalRequest);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize Redis client for token caching
   */
  private async initRedis(): Promise<void> {
    try {
      this.redisClient = createClient({ url: REDIS_URL });
      this.redisClient.on('error', err => console.error('Redis Client Error:', err));
      await this.redisClient.connect();
      console.log('✅ Traveltek API Service: Redis connected');
    } catch (error) {
      console.warn('⚠️ Traveltek API Service: Redis unavailable, using memory cache');
      this.redisClient = null;
    }
  }

  /**
   * Check if error response indicates token expiration
   */
  private isTokenExpiredError(error: AxiosError): boolean {
    const data = error.response?.data as ApiResponse;
    if (data?.errors) {
      return data.errors.some(err => [3000, 3002].includes(err.code));
    }
    return false;
  }

  /**
   * Get OAuth access token with caching and automatic refresh
   */
  private async getAccessToken(): Promise<string> {
    try {
      // Create Basic Auth header
      const credentials = Buffer.from(
        `${TRAVELTEK_API_USERNAME}:${TRAVELTEK_API_PASSWORD}`
      ).toString('base64');

      const response = await axios.post<TokenResponse>(
        `${TRAVELTEK_API_BASE_URL}/token.pl`,
        'grant_type=client_credentials&scope=portal',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = Date.now() + expires_in * 1000;

      // Cache token
      if (this.redisClient) {
        await this.redisClient.setEx(
          TOKEN_CACHE_KEY,
          expires_in - TOKEN_EXPIRY_BUFFER, // Expire slightly earlier to prevent edge cases
          JSON.stringify({ access_token, expires_at: expiresAt })
        );
      }

      this.currentToken = access_token;
      this.tokenExpiresAt = expiresAt;

      console.log('✅ Traveltek API: New access token obtained');
      return access_token;
    } catch (error) {
      console.error('❌ Traveltek API: Failed to get access token:', error);
      throw new Error('Failed to authenticate with Traveltek API');
    }
  }

  /**
   * Get valid token (from cache or fetch new)
   */
  private async getValidToken(): Promise<string> {
    const now = Date.now();

    // Check memory cache first
    if (this.currentToken && this.tokenExpiresAt > now + TOKEN_EXPIRY_BUFFER * 1000) {
      return this.currentToken;
    }

    // Check Redis cache
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(TOKEN_CACHE_KEY);
        if (cached) {
          const { access_token, expires_at } = JSON.parse(cached);
          if (expires_at > now + TOKEN_EXPIRY_BUFFER * 1000) {
            this.currentToken = access_token;
            this.tokenExpiresAt = expires_at;
            return access_token;
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to read token from Redis cache:', error);
      }
    }

    // Token not found or expired, get new one
    return await this.getAccessToken();
  }

  /**
   * Clear cached token (called when token is invalid)
   */
  private async clearCachedToken(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.del(TOKEN_CACHE_KEY);
      } catch (error) {
        console.warn('⚠️ Failed to clear token from Redis cache:', error);
      }
    }
  }

  /**
   * Create a new session by performing a minimal cruise search
   * This generates a sessionkey and sid needed for booking operations
   */
  async createSession(targetDate?: Date): Promise<{ sessionkey: string; sid: string }> {
    try {
      // Perform a minimal search to generate session
      // If targetDate is provided, search around that date
      // Otherwise search in the next 12 months
      let startdate: string;
      let enddate: string;

      if (targetDate) {
        // Search 30 days before to 30 days after the target sailing date
        const start = new Date(targetDate);
        start.setDate(start.getDate() - 30);
        const end = new Date(targetDate);
        end.setDate(end.getDate() + 30);

        startdate = start.toISOString().split('T')[0];
        enddate = end.toISOString().split('T')[0];
      } else {
        // Default: search next 12 months
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setMonth(nextYear.getMonth() + 12);

        startdate = today.toISOString().split('T')[0];
        enddate = nextYear.toISOString().split('T')[0];
      }

      const response = await this.axiosInstance.get('/cruiseresults.pl', {
        params: {
          startdate,
          enddate,
          lineid: '22,3', // Royal Caribbean and Celebrity
          adults: 2,
          currency: 'USD', // Always use USD for pricing
        },
      });

      // Extract sessionkey from meta.criteria.sessionkey (API structure)
      const sessionkey = response.data.meta?.criteria?.sessionkey;
      const sid = response.data.meta?.criteria?.sid || 'default'; // sid may be null, use 'default'

      if (!sessionkey) {
        console.error('❌ Session creation response:', JSON.stringify(response.data, null, 2));
        throw new Error('Session creation failed: missing sessionkey in response');
      }

      console.log('✅ Traveltek API: Session created successfully');
      return { sessionkey, sid };
    } catch (error) {
      console.error('❌ Traveltek API error (createSession):', error);
      throw error;
    }
  }

  /**
   * Search for cruises
   */
  async searchCruises(params: {
    startdate: string; // YYYY-MM-DD
    enddate: string; // YYYY-MM-DD
    lineid?: string; // Comma-separated line IDs (e.g., "22,3")
    adults?: number;
    children?: number;
    shipid?: string;
    regionid?: number;
    currency?: string;
  }): Promise<ApiResponse> {
    try {
      const response = await this.axiosInstance.get('/cruiseresults.pl', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Traveltek API: searchCruises error:', error);
      throw error;
    }
  }

  /**
   * Get cabin grades (live pricing and availability)
   */
  async getCabinGrades(params: {
    sessionkey: string;
    sid: string;
    codetocruiseid: string;
    adults: number;
    children?: number;
    childDobs?: string[]; // Array of YYYY-MM-DD dates
  }): Promise<ApiResponse> {
    try {
      // Build query parameters per Traveltek documentation
      // Note: requestid (OAuth token) is added by axios interceptor
      const queryParams: any = {
        sessionkey: params.sessionkey,
        type: 'cruise',
        sid: params.sid,
        codetocruiseid: params.codetocruiseid,
        adults: params.adults.toString(),
        currency: 'USD', // Always use USD for pricing
      };

      if (params.children && params.children > 0) {
        queryParams.children = params.children.toString();

        // Add child passenger types and DOBs
        if (params.childDobs) {
          params.childDobs.forEach((dob, index) => {
            const childNum = index + 1;
            queryParams[`paxtype-${childNum}`] = 'child';
            queryParams[`dob-${childNum}`] = dob;
          });
        }
      }

      console.log('🔍 Traveltek API: getCabinGrades request');
      console.log('   Method: GET');
      console.log('   URL:', `${TRAVELTEK_API_BASE_URL}/cruisecabingrades.pl`);
      console.log('   Query params:', JSON.stringify(queryParams, null, 2));

      const response = await this.axiosInstance.get('/cruisecabingrades.pl', {
        params: queryParams,
      });

      console.log('✅ Traveltek API: getCabinGrades response status:', response.status);
      console.log('   Response data keys:', Object.keys(response.data));
      if (response.data.results) {
        console.log('   Results count:', response.data.results.length);
      }

      // Log errors and warnings if present
      if (response.data.errors && response.data.errors.length > 0) {
        console.log(
          '⚠️  Traveltek API: getCabinGrades returned errors:',
          JSON.stringify(response.data.errors, null, 2)
        );
      }
      if (response.data.warnings && response.data.warnings.length > 0) {
        console.log(
          '⚠️  Traveltek API: getCabinGrades returned warnings:',
          JSON.stringify(response.data.warnings, null, 2)
        );
      }

      // If no results, log full response for debugging
      if (!response.data.results || response.data.results.length === 0) {
        console.log('⚠️  Traveltek API: getCabinGrades returned 0 results. Full response:');
        console.log(JSON.stringify(response.data, null, 2));
      }

      return response.data;
    } catch (error: any) {
      console.error('❌ Traveltek API: getCabinGrades error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
      });
      throw error;
    }
  }

  /**
   * Get specific cabins within a cabin grade
   */
  async getCabins(params: {
    sessionkey: string;
    sid: string;
    resultno: string;
    gradeno: string;
    ratecode: string;
  }): Promise<ApiResponse> {
    try {
      console.log('🔍 Traveltek API: getCabins request');
      console.log('   Method: POST');
      console.log('   URL:', `${TRAVELTEK_API_BASE_URL}/cruisecabins.pl`);
      console.log('   Params:', JSON.stringify(params, null, 2));

      // Traveltek requires 'selectedgrade' parameter in addition to other params
      const apiParams = {
        ...params,
        selectedgrade: params.gradeno, // Add selectedgrade parameter (same value as gradeno)
      };

      const formData = new URLSearchParams(apiParams as any);
      const response = await this.axiosInstance.post('/cruisecabins.pl', formData);

      console.log('✅ Traveltek API: getCabins response status:', response.status);
      console.log('   Response data keys:', Object.keys(response.data));
      if (response.data.results) {
        console.log('   Results count:', response.data.results.length);
      }

      // Log errors and warnings if present
      if (response.data.errors && response.data.errors.length > 0) {
        console.log(
          '⚠️  Traveltek API: getCabins returned errors:',
          JSON.stringify(response.data.errors, null, 2)
        );
      }
      if (response.data.warnings && response.data.warnings.length > 0) {
        console.log(
          '⚠️  Traveltek API: getCabins returned warnings:',
          JSON.stringify(response.data.warnings, null, 2)
        );
      }

      // If no results, log full response for debugging
      if (!response.data.results || response.data.results.length === 0) {
        console.log('⚠️  Traveltek API: getCabins returned 0 results. Full response:');
        console.log(JSON.stringify(response.data, null, 2));
      }

      return response.data;
    } catch (error: any) {
      console.error('❌ Traveltek API: getCabins error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
      });
      throw error;
    }
  }

  /**
   * Add cruise to basket
   */
  async addToBasket(params: {
    sessionkey: string;
    type: 'cruise';
    resultno: string;
    gradeno: string;
    ratecode: string;
    cabinresult?: string; // Optional specific cabin number
  }): Promise<ApiResponse> {
    try {
      // Add required resultkey parameter (typically 'default' for basic usage)
      const basketParams = {
        ...params,
        resultkey: 'default', // Required by Traveltek API
      };

      console.log('🔍 Traveltek API: addToBasket request');
      console.log('   Params:', JSON.stringify(basketParams, null, 2));

      const response = await this.axiosInstance.get('/basketadd.pl', { params: basketParams });

      console.log('✅ Traveltek API: addToBasket success');

      return response.data;
    } catch (error: any) {
      console.error('❌ Traveltek API: addToBasket error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get current basket contents
   */
  async getBasket(sessionkey: string): Promise<ApiResponse> {
    try {
      const response = await this.axiosInstance.get('/basket.pl', {
        params: { sessionkey },
      });
      return response.data;
    } catch (error) {
      console.error('❌ Traveltek API: getBasket error:', error);
      throw error;
    }
  }

  /**
   * Create booking with passenger details
   */
  async createBooking(params: {
    sessionkey: string;
    sid: string;
    contact: {
      firstname: string;
      lastname: string;
      email: string;
      telephone: string;
      address1: string;
      city: string;
      county: string;
      postcode: string;
      country: string;
    };
    passengers: Array<{
      firstname: string;
      lastname: string;
      dob: string; // YYYY-MM-DD
      gender: string; // M, F, X
      paxtype: 'adult' | 'child' | 'infant';
      age: number;
    }>;
    dining: string;
  }): Promise<ApiResponse> {
    try {
      const formData = new URLSearchParams();
      formData.append('sessionkey', params.sessionkey);
      formData.append('sid', params.sid);

      // Add contact details
      Object.entries(params.contact).forEach(([key, value]) => {
        formData.append(`contact[${key}]`, value);
      });

      // Add passenger details
      params.passengers.forEach((passenger, index) => {
        const paxNum = index + 1;
        Object.entries(passenger).forEach(([key, value]) => {
          formData.append(`pax-${paxNum}[${key}]`, value.toString());
        });
      });

      // Add dining selection
      formData.append('dining', params.dining);

      const response = await this.axiosInstance.post('/book.pl', formData);
      return response.data;
    } catch (error) {
      console.error('❌ Traveltek API: createBooking error:', error);
      throw error;
    }
  }

  /**
   * Process payment for booking
   */
  async processPayment(params: {
    sessionkey: string;
    cardtype: string; // VIS, MSC, AMX
    cardnumber: string;
    expirymonth: string;
    expiryyear: string;
    nameoncard: string;
    cvv: string;
    amount: string;
    address1: string;
    city: string;
    postcode: string;
    country: string;
  }): Promise<ApiResponse> {
    try {
      const formData = new URLSearchParams(params as any);
      const response = await this.axiosInstance.post('/payment.pl', formData);
      return response.data;
    } catch (error) {
      console.error('❌ Traveltek API: processPayment error:', error);
      throw error;
    }
  }

  /**
   * Close Redis connection (cleanup)
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Singleton instance
export const traveltekApiService = new TraveltekApiService();
