import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['staging', 'production']).default('staging'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Database
  DATABASE_URL: z.string().optional().transform(val => val === '' ? undefined : val).pipe(z.string().url().optional()),
  
  // Redis
  REDIS_URL: z.string().optional().transform(val => val === '' ? undefined : val).pipe(z.string().url().optional()),
  
  // Clerk
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_JWT_KEY: z.string().min(1).optional(),
  
  // Traveltek (optional for initial deployment)
  TRAVELTEK_FTP_HOST: z.string().min(1).optional(),
  TRAVELTEK_FTP_USER: z.string().min(1).optional(),
  TRAVELTEK_FTP_PASSWORD: z.string().min(1).optional(),
  
  // Sentry
  SENTRY_DSN: z.string().optional().transform(val => val === '' ? undefined : val).pipe(z.string().url().optional()),
  
  // Email
  RESEND_API_KEY: z.string().min(1).optional(),
  
  // Security
  JWT_SECRET: z.string().min(1).optional(),
  WEBHOOK_SECRET: z.string().min(1).optional(),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
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
  console.error('❌ Invalid environment variables:');
  parseResult.error.issues.forEach(issue => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parseResult.data;

// Environment helpers
export const isStaging = env.NODE_ENV === 'staging';
export const isProduction = env.NODE_ENV === 'production';
// Legacy helpers for compatibility
export const isDevelopment = env.NODE_ENV === 'staging'; // Use staging for dev-like behavior
export const isTest = false; // No test environment

// Database configuration
export const dbConfig = {
  url: env.DATABASE_URL || '',
  ssl: isProduction || isStaging,
  max: isProduction || isStaging ? 20 : 5,
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

// CORS configuration
export const corsConfig = {
  origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
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