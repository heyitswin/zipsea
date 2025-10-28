import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['staging', 'production', 'development']).optional().default('staging'),
  PORT: z.string().transform(Number).default('3001'),

  // Database
  DATABASE_URL: z
    .string()
    .optional()
    .transform(val => (val === '' ? undefined : val))
    .pipe(z.string().url().optional()),

  // Redis
  REDIS_URL: z
    .string()
    .optional()
    .transform(val => (val === '' ? undefined : val))
    .pipe(z.string().url().optional()),
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: z.string().transform(Number).optional().default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_JWT_KEY: z.string().min(1).optional(),

  // Traveltek FTP (required in production)
  TRAVELTEK_FTP_HOST: z.string().min(1).optional(),
  TRAVELTEK_FTP_USER: z.string().min(1).optional(),
  TRAVELTEK_FTP_PASSWORD: z.string().min(1).optional(),

  // Traveltek Live Booking API
  TRAVELTEK_API_USERNAME: z.string().min(1).optional(),
  TRAVELTEK_API_PASSWORD: z.string().min(1).optional(),
  TRAVELTEK_API_BASE_URL: z.string().url().optional(),
  TRAVELTEK_LIVE_BOOKING_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  TRAVELTEK_LIVE_BOOKING_LINE_IDS: z.string().optional().default('22,3'), // Royal Caribbean (22) and Celebrity (3)

  // Sentry
  SENTRY_DSN: z
    .string()
    .optional()
    .transform(val => (val === '' ? undefined : val))
    .pipe(z.string().url().optional()),

  // Email
  RESEND_API_KEY: z.string().min(1).optional(),
  TEAM_NOTIFICATION_EMAIL: z.string().email().optional().default('win@zipsea.com'),

  // Security
  JWT_SECRET: z.string().min(1).optional(),
  WEBHOOK_SECRET: z.string().min(1).optional(),

  // Slack
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().optional().default('https://zipsea.com'),

  // Cache TTL (in seconds)
  CACHE_TTL_SEARCH: z.string().transform(Number).default('3600'),
  CACHE_TTL_CRUISE_DETAILS: z.string().transform(Number).default('21600'),
  CACHE_TTL_PRICING: z.string().transform(Number).default('900'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('⚠️  Environment variable validation issues:');
  parseResult.error.issues.forEach(issue => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  console.warn('Attempting to continue with partial configuration...');
}

// Use parsed data if successful, otherwise use raw env with defaults
export const env = parseResult.success
  ? parseResult.data
  : {
      NODE_ENV: process.env.NODE_ENV || 'staging',
      PORT: Number(process.env.PORT) || 3001,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
      CLERK_JWT_KEY: process.env.CLERK_JWT_KEY,
      TRAVELTEK_FTP_HOST: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      TRAVELTEK_FTP_USER: process.env.TRAVELTEK_FTP_USER,
      TRAVELTEK_FTP_PASSWORD: process.env.TRAVELTEK_FTP_PASSWORD,
      TRAVELTEK_API_USERNAME: process.env.TRAVELTEK_API_USERNAME,
      TRAVELTEK_API_PASSWORD: process.env.TRAVELTEK_API_PASSWORD,
      TRAVELTEK_API_BASE_URL: process.env.TRAVELTEK_API_BASE_URL,
      TRAVELTEK_LIVE_BOOKING_ENABLED: process.env.TRAVELTEK_LIVE_BOOKING_ENABLED === 'true',
      TRAVELTEK_LIVE_BOOKING_LINE_IDS: process.env.TRAVELTEK_LIVE_BOOKING_LINE_IDS || '22,3',
      SENTRY_DSN: process.env.SENTRY_DSN,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      TEAM_NOTIFICATION_EMAIL: process.env.TEAM_NOTIFICATION_EMAIL || 'win@zipsea.com',
      JWT_SECRET: process.env.JWT_SECRET,
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
      FRONTEND_URL: process.env.FRONTEND_URL || 'https://zipsea.com',
      CACHE_TTL_SEARCH: Number(process.env.CACHE_TTL_SEARCH) || 3600,
      CACHE_TTL_CRUISE_DETAILS: Number(process.env.CACHE_TTL_CRUISE_DETAILS) || 21600,
      CACHE_TTL_PRICING: Number(process.env.CACHE_TTL_PRICING) || 900,
      RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
      RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
    };

// Additional validation for production
if (env.NODE_ENV === 'production') {
  const missingFtpCreds = [];
  if (!env.TRAVELTEK_FTP_HOST) missingFtpCreds.push('TRAVELTEK_FTP_HOST');
  if (!env.TRAVELTEK_FTP_USER) missingFtpCreds.push('TRAVELTEK_FTP_USER');
  if (!env.TRAVELTEK_FTP_PASSWORD) missingFtpCreds.push('TRAVELTEK_FTP_PASSWORD');

  if (missingFtpCreds.length > 0) {
    console.warn('⚠️  Production environment missing FTP credentials:');
    missingFtpCreds.forEach(cred => {
      console.warn(`  ${cred} is required for webhook processing to work`);
    });
    console.warn('');
    console.warn('⚠️  WARNING: Webhook processing will be disabled without FTP credentials!');
    console.warn('Add these environment variables to your deployment for full functionality.');
    // Don't exit - allow the app to run without FTP (database and other features will still work)
  }
}

// Environment helpers
export const isStaging = env.NODE_ENV === 'staging';
export const isProduction = env.NODE_ENV === 'production';
// Legacy helpers for compatibility
export const isDevelopment = env.NODE_ENV === 'staging'; // Use staging for dev-like behavior
export const isTest = false; // No test environment

// Database configuration
export const dbConfig = {
  url: env.DATABASE_URL || '',
  ssl: env.DATABASE_URL?.includes('render.com') ? true : false,
  max: isProduction || isStaging ? 15 : 5, // Reduced to prevent connection pooling memory overhead
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Redis configuration
export const redisConfig = {
  url: env.REDIS_URL || '',
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
};

// CORS configuration with dynamic origin handling
const getAllowedOrigins = () => {
  const origins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());

  // Always include localhost for development
  if (!origins.includes('http://localhost:3000')) {
    origins.push('http://localhost:3000');
  }

  // Add custom domain origins if in production
  if (isProduction) {
    const customDomainOrigins = [
      'https://zipsea.com',
      'https://www.zipsea.com',
      'https://zipsea-frontend-production.onrender.com', // Keep Render URL as fallback
      'https://zipsea-frontend-staging.onrender.com',
    ];

    customDomainOrigins.forEach(origin => {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    });
  }

  // Add staging origins if in staging
  if (isStaging) {
    const stagingOrigins = [
      'https://zipsea-frontend-staging.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
    ];

    stagingOrigins.forEach(origin => {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    });
  }

  return origins;
};

export const corsConfig = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean | string | string[]) => void
  ) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key',
  ],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// Cache TTL configuration
export const cacheTTL = {
  search: env.CACHE_TTL_SEARCH,
  cruiseDetails: env.CACHE_TTL_CRUISE_DETAILS,
  pricing: env.CACHE_TTL_PRICING,
};

// API configuration
export const apiConfig = {
  version: 'v1',
  prefix: '/api',
  timeout: 30000,
};

// Traveltek configuration
export const traveltekConfig = {
  ftp: {
    host: env.TRAVELTEK_FTP_HOST,
    user: env.TRAVELTEK_FTP_USER,
    password: env.TRAVELTEK_FTP_PASSWORD,
    port: 21,
    secure: true,
  },
  sync: {
    enabled: !isTest,
    batchSize: 100,
    concurrentDownloads: 5,
    retryAttempts: 3,
    retryDelay: 5000,
  },
};

export default env;
