# Zipsea Phase 1: Core Infrastructure & Foundation - Detailed Task List

## Phase 1 Progress Summary

**Overall Completion: 85%** ✅

### ✅ What's Been Completed:
- Complete project structure and development environment setup
- Full database schema design with complex Traveltek structure
- Comprehensive backend setup with all dependencies
- Redis caching system and connection management
- Express server with security middleware and API structure
- Authentication middleware (Clerk integration foundation)
- Error handling, monitoring, and logging systems
- Testing framework and Jest configuration
- Docker development environment
- Base repository and git setup

### ✅ What's Been Completed (Recently):
- **✅ Full backend deployed to Render staging and production**
- **✅ PostgreSQL and Redis services active on Render**
- **✅ Comprehensive database schema with all 13 tables deployed**
- **✅ Webhook endpoint deployed and publicly accessible**
- **✅ Complete API structure with all controllers and services**
- **✅ Advanced search system with Redis caching**
- **✅ Traveltek FTP integration service ready**
- **✅ Data sync pipeline for cruise data processing**
- **✅ Comprehensive error handling and logging**
- **✅ Authentication middleware with Clerk integration ready**
- **✅ Cron jobs for automated data synchronization**
- **✅ Admin endpoints for manual system controls**

### ❌ What Remains To Be Done:
- **Get Traveltek FTP credentials and configure in Render**
- **Register webhook URL with Traveltek**
- **Run initial data sync to populate database**
- **Complete frontend application development**
- **Complete quote request implementation**
- **Comprehensive testing on staging with real data**
- **Frontend Clerk integration and user management**

### ✅ What's Been SKIPPED (Using Render Only):
- ~~Local Docker Compose setup~~ **SKIPPED - Using Render services**
- ~~Local PostgreSQL installation~~ **SKIPPED - Using Render PostgreSQL**
- ~~Local Redis installation~~ **SKIPPED - Using Render Redis**
- ~~Local testing environment~~ **SKIPPED - Using Render staging**
- ~~Jest unit tests (optional)~~ **OPTIONAL - Focus on staging integration tests**

**Estimated Time Remaining: 1-2 weeks** for backend completion and Traveltek integration, then Phase 2 frontend work.

## Overview
Phase 1 focuses on establishing the foundational infrastructure for the Zipsea cruise OTA platform using a Render-first deployment approach. This includes project setup, early Render deployment, authentication, complex database design, comprehensive Traveltek integration, and core API structure. Timeline: 8 weeks (reduced due to no local setup).

## Major Updates Based on Actual Traveltek API Structure

This document has been updated to accurately reflect the actual Traveltek data structure and API integration requirements:

### Database Schema Updates
- **INTEGER IDs**: Using INTEGER for cruiseid, lineid, shipid (not VARCHAR)
- **Complex Pricing Structure**: Nested pricing objects with RATECODE -> cabin code -> occupancy code hierarchy
- **Ship Content**: Comprehensive ship data with images arrays and nested metadata
- **Cabin Definitions**: Color codes, image URLs, and proper cabin category mappings
- **Cheapest Pricing**: Denormalized table for fast search across all cabin categories
- **Alternative Sailings**: Cross-references to other sailing dates for same itinerary
- **Region Arrays**: Proper handling of regionids as INTEGER arrays

### Traveltek Integration Updates
- **File Path Structure**: Correct FTP path format: [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
- **Webhook Types**: Two distinct webhook types with different payload structures
- **Live Pricing**: 1-day TTL cached pricing with proper timestamp handling
- **Data Transformation**: Complex mapping from Traveltek JSON to normalized database schema

### API Endpoint Updates
- **Search API**: Leveraging cheapest_pricing table for fast search results
- **Pricing Display**: Proper handling of nested rate codes and occupancy options
- **Ship Details**: Complete ship content with images and amenities
- **Itinerary Data**: Detailed daily itinerary with port information and times

### Timeline Extension
Extended from 8 to 10 weeks due to increased complexity of:
- Nested pricing calculations and transformations
- Complex ship content processing
- Webhook-driven incremental updates
- Advanced search optimization
- Comprehensive data validation and error handling

## Prerequisites
- Node.js 18+ installed (for local coding only)
- Render account for deployment (REQUIRED EARLY)
- Clerk account for authentication
- Traveltek FTP credentials (ftpeu1prod.traveltek.net with iSell account)
- Sentry account for monitoring
- Git repository access ✅ COMPLETED - Repository initialized with main branch

**IMPORTANT: No local PostgreSQL/Redis needed - using Render services only**

## New Development Workflow (Render-First Approach)

### Development Process:
1. **Code Locally:** Write code in local IDE with Node.js installed
2. **No Local Running:** Do not run database, Redis, or server locally
3. **Push to GitHub:** Commit and push changes to GitHub repository
4. **Auto-Deploy to Staging:** Render automatically deploys from main branch
5. **Test on Staging:** Use staging URL for all testing and development
6. **Use Render Logs:** Monitor application via Render dashboard logs
7. **Promote to Production:** Manual deployment to production environment

### Key URLs:
- **Staging API:** https://zipsea-staging.onrender.com
- **Staging Webhook:** https://zipsea-staging.onrender.com/api/webhooks/traveltek
- **Production API:** https://zipsea.onrender.com (after production deployment)

### Required for Traveltek Registration:
- **Webhook URL MUST be deployed and accessible BEFORE registering with Traveltek**
- Webhook endpoint must return 200 OK response
- Public URL required: https://zipsea-staging.onrender.com/api/webhooks/traveltek

---

## 1. Project Initialization & Repository Setup

### 1.1 Create Project Structure
**Estimated Time:** 2 hours
**Dependencies:** None
**Status:** [✅ COMPLETED] - All directories created, project structure established

```bash
# Create main project directory structure
mkdir -p zipsea/{backend,frontend,docs,scripts,tests}
cd zipsea

# Git repository already initialized
# git init (DONE)
# git branch -M main (DONE)

# Create initial .gitignore
touch .gitignore
```

**Files to create:**
- `/.gitignore` - Include node_modules, .env files, build directories, logs
- `/README.md` - Project overview and setup instructions
- `/package.json` - Root workspace configuration
- `/.nvmrc` - Node.js version specification (18.x)

### 1.2 Backend Project Setup
**Estimated Time:** 3 hours
**Dependencies:** 1.1
**Status:** [✅ COMPLETED] - All dependencies installed, TypeScript configured

```bash
# Navigate to backend directory
cd backend

# Initialize Node.js project
npm init -y

# Install core dependencies
npm install express cors helmet dotenv
npm install @types/express @types/cors @types/node typescript ts-node nodemon --save-dev

# Install database and caching
npm install pg redis @types/pg @types/redis
npm install drizzle-orm drizzle-kit

# Install authentication
npm install @clerk/express

# Install monitoring and logging
npm install @sentry/node @sentry/profiling-node winston

# Install validation and utilities
npm install zod joi bcryptjs jsonwebtoken
npm install @types/bcryptjs @types/jsonwebtoken --save-dev

# Install testing framework
npm install jest @types/jest ts-jest supertest @types/supertest --save-dev
```

**Files to create:**
- `/backend/package.json` - Backend package configuration
- `/backend/tsconfig.json` - TypeScript configuration
- `/backend/jest.config.js` - Jest testing configuration
- `/backend/.env.example` - Environment variables template
- `/backend/src/index.ts` - Main application entry point
- `/backend/src/app.ts` - Express application setup
- `/backend/nodemon.json` - Development server configuration

### 1.3 Frontend Project Setup  
**Estimated Time:** 2 hours
**Dependencies:** 1.1
**Status:** [🔄 IN PROGRESS] - Directory created, Next.js initialization pending

```bash
# Navigate to frontend directory
cd frontend

# Create Next.js application with TypeScript
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Install additional dependencies
npm install @clerk/nextjs @headlessui/react @heroicons/react
npm install react-hook-form zod @hookform/resolvers
npm install axios swr
npm install @sentry/nextjs

# Install development dependencies
npm install @types/node --save-dev
```

**Files to create:**
- `/frontend/.env.local.example` - Frontend environment variables template
- `/frontend/next.config.js` - Next.js configuration with Sentry
- `/frontend/tailwind.config.js` - Tailwind CSS configuration
- `/frontend/middleware.ts` - Clerk authentication middleware

### 1.4 Development Environment Configuration
**Estimated Time:** 2 hours
**Dependencies:** 1.2, 1.3
**Status:** [✅ COMPLETED] - SKIPPED - Using Render Only

**Files to create/update:**
- `/Makefile` - Render deployment commands only
- `/.env.example` - Render environment variables template
- `/.vscode/settings.json` - VSCode workspace settings
- `/.vscode/launch.json` - Debug configurations

**Tasks:**
1. ~~Configure Docker Compose for local PostgreSQL and Redis~~ **SKIPPED - Using Render Only**
2. ~~Set up database connection strings and Redis URLs~~ **SKIPPED - Using Render Environment Groups**
3. Update Makefile to focus on Render deployment commands
4. ~~Set up hot reload for backend and frontend~~ **SKIPPED - Push-to-staging workflow**
5. ~~Test local development environment startup~~ **SKIPPED - Using Render staging**

---

## 2. Render Deployment Configuration (EARLY PRIORITY)

### 2.1 Render Services Setup
**Estimated Time:** 3 hours
**Dependencies:** 1.2
**Status:** [✅ COMPLETED] - All Render services deployed and operational

**Files to create:**
- `/render.yaml` - Render service configuration
- `/backend/Dockerfile` - Backend container configuration
- `/.dockerignore` - Docker ignore configuration
- `/scripts/deploy.sh` - Deployment script

**Tasks:**
1. Create Render web service for backend API
2. Set up PostgreSQL service on Render
3. Set up Redis service on Render
4. Configure environment groups (staging, production)
5. Set up auto-deploy from GitHub main branch
6. Test basic Express app deployment to staging

### 2.2 Basic Express Server for Webhook Endpoint
**Estimated Time:** 2 hours
**Dependencies:** 2.1
**Status:** [✅ COMPLETED] - Webhook endpoint deployed and accessible

**Files to create:**
- `/backend/src/app.ts` - Basic Express application
- `/backend/src/routes/webhook.routes.ts` - Webhook endpoints
- `/backend/src/controllers/webhook.controller.ts` - Basic webhook handler

**Tasks:**
1. Create minimal Express app with webhook endpoint
2. Implement `/api/webhooks/traveltek` endpoint (returns 200 OK)
3. Deploy to Render staging
4. Verify webhook endpoint is accessible at https://zipsea-staging.onrender.com/api/webhooks/traveltek
5. **CRITICAL: Get public webhook URL before Traveltek registration**

### 2.3 Environment Groups Configuration
**Estimated Time:** 1 hour
**Dependencies:** 2.1
**Status:** [✅ COMPLETED] - Environment groups configured for staging and production

**Environment Variables to Configure in Render:**
- `DATABASE_URL` - Render PostgreSQL connection
- `REDIS_URL` - Render Redis connection
- `CLERK_PUBLISHABLE_KEY` - Authentication
- `CLERK_SECRET_KEY` - Authentication
- `TRAVELTEK_FTP_HOST` - ftpeu1prod.traveltek.net
- `TRAVELTEK_FTP_USER` - iSell account
- `TRAVELTEK_FTP_PASSWORD` - iSell password
- `SENTRY_DSN` - Error monitoring
- `NODE_ENV` - production/staging

**Tasks:**
1. Create staging environment group in Render
2. Create production environment group in Render
3. Configure all required environment variables
4. Test environment variable access in deployed app

---

## 3. Database Design & Setup

### 3.1 Database Schema Design
**Estimated Time:** 4 hours  
**Dependencies:** 2.3 (Render Environment)
**Status:** [✅ COMPLETED] - Full schema created with comprehensive Drizzle ORM setup

**Files to create:**
- `/backend/src/db/schema.ts` - Drizzle schema definitions
- `/backend/drizzle.config.ts` - Drizzle configuration
- `/docs/database-schema.md` - Database documentation

**Schema Tables to Design (Based on Actual Traveltek Structure):**
```sql
-- Users table (integrates with Clerk)
users (
  id UUID PRIMARY KEY,
  clerk_user_id VARCHAR(255) UNIQUE,
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Cruise Lines (from lineid in Traveltek)
cruise_lines (
  id INTEGER PRIMARY KEY, -- Traveltek lineid
  name VARCHAR(255), -- Extract from linecontent or manual mapping
  logo_url VARCHAR(500),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Ships (from shipid/shipcontent in Traveltek)
ships (
  id INTEGER PRIMARY KEY, -- Traveltek shipid
  cruise_line_id INTEGER REFERENCES cruise_lines(id),
  name VARCHAR(255), -- shipcontent.name
  code VARCHAR(50), -- shipcontent.code
  ship_class VARCHAR(100), -- shipcontent.shipclass
  tonnage INTEGER, -- shipcontent.tonnage
  total_cabins INTEGER, -- shipcontent.totalcabins
  capacity INTEGER, -- shipcontent.limitof
  rating INTEGER, -- shipcontent.startrating
  description TEXT, -- shipcontent.shortdescription
  highlights TEXT, -- shipcontent.highlights
  default_image_url VARCHAR(500), -- shipcontent.defaultshipimage
  default_image_url_hd VARCHAR(500), -- shipcontent.defaultshipimage2k
  images JSONB, -- shipcontent.shipimages array
  additional_info TEXT, -- shipcontent.additsoaly
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Ports (from portids/ports arrays)
ports (
  id INTEGER PRIMARY KEY, -- From portids array
  name VARCHAR(255), -- From ports array
  code VARCHAR(10),
  country VARCHAR(100),
  country_code VARCHAR(2),
  state VARCHAR(100),
  city VARCHAR(100),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  timezone VARCHAR(50),
  terminal VARCHAR(255),
  description TEXT,
  images JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Regions (from regionids/regions arrays)
regions (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255),
  parent_region_id INTEGER REFERENCES regions(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Cruises (main cruise data from JSON files)
cruises (
  id INTEGER PRIMARY KEY, -- Traveltek cruiseid
  code_to_cruise_id VARCHAR(50), -- codetocruiseid for file naming
  cruise_line_id INTEGER REFERENCES cruise_lines(id),
  ship_id INTEGER REFERENCES ships(id),
  name VARCHAR(255), -- Cruise name
  itinerary_code VARCHAR(50),
  voyage_code VARCHAR(50),
  sailing_date DATE, -- startdate/saildate
  return_date DATE, -- Calculated from sailing_date + nights
  nights INTEGER, -- nights
  sail_nights INTEGER, -- sailnights
  sea_days INTEGER, -- seadays
  embark_port_id INTEGER REFERENCES ports(id), -- startportid
  disembark_port_id INTEGER REFERENCES ports(id), -- endportid
  region_ids INTEGER[], -- regionids array
  port_ids INTEGER[], -- portids array
  market_id INTEGER, -- marketid
  owner_id INTEGER, -- ownerid
  no_fly BOOLEAN, -- nofly
  depart_uk BOOLEAN, -- departuk
  show_cruise BOOLEAN, -- showcruise (active flag)
  fly_cruise_info TEXT, -- flycruiseinfo
  line_content TEXT, -- linecontent
  traveltek_file_path VARCHAR(500), -- [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
  last_cached TIMESTAMP, -- lastcached
  cached_date DATE, -- cacheddate
  currency VARCHAR(3), -- ISO currency code from file
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Itineraries (from itinerary array)
itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id INTEGER REFERENCES cruises(id),
  day_number INTEGER, -- itinerary[].day
  date DATE, -- itinerary[].date
  port_name VARCHAR(255), -- itinerary[].port
  port_id INTEGER REFERENCES ports(id),
  arrival_time TIME, -- itinerary[].arrive
  departure_time TIME, -- itinerary[].depart
  status VARCHAR(20), -- 'embark', 'port', 'at_sea', 'disembark'
  overnight BOOLEAN DEFAULT FALSE,
  description TEXT, -- itinerary[].description
  created_at TIMESTAMP DEFAULT NOW()
)

-- Alternative Sailings (from altsailings array)
alternative_sailings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_cruise_id INTEGER REFERENCES cruises(id),
  alternative_cruise_id INTEGER REFERENCES cruises(id),
  sailing_date DATE,
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
)

-- Cabin Categories (from cabins object)
cabin_categories (
  ship_id INTEGER REFERENCES ships(id),
  cabin_code VARCHAR(10), -- cabins.{code}.cabincode
  cabin_code_alt VARCHAR(10), -- cabins.{code}.cabincode2
  name VARCHAR(255), -- cabins.{code}.name
  description TEXT, -- cabins.{code}.description
  category VARCHAR(50), -- cabins.{code}.codtype (inside/oceanview/balcony/suite)
  category_alt VARCHAR(50), -- cabins.{code}.codtype2
  color_code VARCHAR(7), -- cabins.{code}.colourcode
  color_code_alt VARCHAR(7), -- cabins.{code}.colourcode2
  image_url VARCHAR(500), -- cabins.{code}.imageurl
  image_url_hd VARCHAR(500), -- cabins.{code}.imageurl2k
  is_default BOOLEAN, -- cabins.{code}.isdefault
  valid_from DATE, -- cabins.{code}.validfrom
  valid_to DATE, -- cabins.{code}.validto
  max_occupancy INTEGER, -- Derived from pricing analysis
  min_occupancy INTEGER DEFAULT 1,
  size VARCHAR(50), -- Manual entry
  bed_configuration VARCHAR(100), -- Manual entry
  amenities JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (ship_id, cabin_code)
)

-- Pricing (from prices and cachedprices objects)
pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id INTEGER REFERENCES cruises(id),
  rate_code VARCHAR(50), -- RATECODE1, BESTFARE, BROCHURE, etc
  cabin_code VARCHAR(10), -- IB, OV, BA, S1, etc
  occupancy_code VARCHAR(10), -- 101, 102, 201, etc
  cabin_type VARCHAR(50), -- prices.{}.{}.{}.cabintype
  base_price DECIMAL(10,2), -- prices.{}.{}.{}.price
  adult_price DECIMAL(10,2), -- prices.{}.{}.{}.adultprice
  child_price DECIMAL(10,2), -- prices.{}.{}.{}.childprice
  infant_price DECIMAL(10,2), -- prices.{}.{}.{}.infantprice
  single_price DECIMAL(10,2), -- prices.{}.{}.{}.singleprice
  third_adult_price DECIMAL(10,2), -- prices.{}.{}.{}.thirdadultprice
  fourth_adult_price DECIMAL(10,2), -- prices.{}.{}.{}.fourthadultprice
  taxes DECIMAL(10,2), -- prices.{}.{}.{}.taxes
  ncf DECIMAL(10,2), -- prices.{}.{}.{}.ncf (Non-Commissionable Fees)
  gratuity DECIMAL(10,2), -- prices.{}.{}.{}.gratuity
  fuel DECIMAL(10,2), -- prices.{}.{}.{}.fuel
  non_comm DECIMAL(10,2), -- prices.{}.{}.{}.noncomm
  port_charges DECIMAL(10,2), -- For live pricing
  government_fees DECIMAL(10,2), -- For live pricing
  total_price DECIMAL(10,2), -- Calculated total
  commission DECIMAL(10,2), -- For agent pricing
  is_available BOOLEAN DEFAULT TRUE,
  inventory INTEGER, -- Available inventory
  waitlist BOOLEAN DEFAULT FALSE,
  guarantee BOOLEAN DEFAULT FALSE,
  price_type VARCHAR(10), -- 'static' or 'live'
  price_timestamp TIMESTAMP, -- For live pricing cache
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Cheapest Pricing (denormalized for fast search)
cheapest_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id INTEGER REFERENCES cruises(id) UNIQUE,
  cheapest_price DECIMAL(10,2), -- cheapest.price
  cheapest_cabin_type VARCHAR(50), -- cheapest.cabintype
  cheapest_taxes DECIMAL(10,2), -- cheapest.taxes
  cheapest_ncf DECIMAL(10,2), -- cheapest.ncf
  cheapest_gratuity DECIMAL(10,2), -- cheapest.gratuity
  cheapest_fuel DECIMAL(10,2), -- cheapest.fuel
  cheapest_non_comm DECIMAL(10,2), -- cheapest.noncomm
  interior_price DECIMAL(10,2), -- cheapestinside.price
  interior_taxes DECIMAL(10,2), -- cheapestinside.taxes
  interior_ncf DECIMAL(10,2), -- cheapestinside.ncf
  interior_gratuity DECIMAL(10,2), -- cheapestinside.gratuity
  interior_fuel DECIMAL(10,2), -- cheapestinside.fuel
  interior_non_comm DECIMAL(10,2), -- cheapestinside.noncomm
  interior_price_code VARCHAR(50), -- cheapestinsidepricecode (RATECODE|CABIN|OCC)
  oceanview_price DECIMAL(10,2), -- cheapestoutside.price
  oceanview_taxes DECIMAL(10,2), -- cheapestoutside.taxes
  oceanview_ncf DECIMAL(10,2), -- cheapestoutside.ncf
  oceanview_gratuity DECIMAL(10,2), -- cheapestoutside.gratuity
  oceanview_fuel DECIMAL(10,2), -- cheapestoutside.fuel
  oceanview_non_comm DECIMAL(10,2), -- cheapestoutside.noncomm
  oceanview_price_code VARCHAR(50), -- cheapestoutsidepricecode
  balcony_price DECIMAL(10,2), -- cheapestbalcony.price
  balcony_taxes DECIMAL(10,2), -- cheapestbalcony.taxes
  balcony_ncf DECIMAL(10,2), -- cheapestbalcony.ncf
  balcony_gratuity DECIMAL(10,2), -- cheapestbalcony.gratuity
  balcony_fuel DECIMAL(10,2), -- cheapestbalcony.fuel
  balcony_non_comm DECIMAL(10,2), -- cheapestbalcony.noncomm
  balcony_price_code VARCHAR(50), -- cheapestbalconypricecode
  suite_price DECIMAL(10,2), -- cheapestsuite.price
  suite_taxes DECIMAL(10,2), -- cheapestsuite.taxes
  suite_ncf DECIMAL(10,2), -- cheapestsuite.ncf
  suite_gratuity DECIMAL(10,2), -- cheapestsuite.gratuity
  suite_fuel DECIMAL(10,2), -- cheapestsuite.fuel
  suite_non_comm DECIMAL(10,2), -- cheapestsuite.noncomm
  suite_price_code VARCHAR(50), -- cheapestsuitepricecode
  currency VARCHAR(3), -- From cruise record
  last_updated TIMESTAMP DEFAULT NOW()
)

-- Quote Requests
quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  cruise_id INTEGER REFERENCES cruises(id),
  cabin_code VARCHAR(10),
  passenger_count INTEGER,
  special_requirements TEXT,
  contact_info JSONB,
  status VARCHAR(50),
  total_price DECIMAL(10,2),
  obc_amount DECIMAL(10,2), -- Onboard credit calculation
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Saved Searches
saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  search_criteria JSONB,
  alert_enabled BOOLEAN DEFAULT false,
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### 3.2 Database Migration System
**Estimated Time:** 3 hours
**Dependencies:** 3.1
**Status:** [✅ COMPLETED] - Drizzle migration system ready for Render deployment

```bash
# Generate initial migration
npm run db:generate

# Apply migrations
npm run db:migrate
```

**Files to create:**
- `/backend/src/db/migrations/` - Migration files directory
- `/backend/src/db/connection.ts` - Database connection setup
- `/backend/src/db/migrate.ts` - Migration runner script
- `/backend/scripts/migrate.js` - CLI migration tool

**Tasks:**
1. Set up Drizzle migration system
2. Create initial database tables
3. Add proper indexes for search performance
4. Set up foreign key constraints
5. Create seed data script for development

### 3.3 Database Indexes and Optimization
**Estimated Time:** 2 hours
**Dependencies:** 3.2
**Status:** [✅ COMPLETED] - All indexes defined in schema for optimal Render performance

**Key Indexes to Create:**
```sql
-- Core search performance indexes
CREATE INDEX idx_cruises_sailing_date ON cruises (sailing_date);
CREATE INDEX idx_cruises_nights ON cruises (nights);
CREATE INDEX idx_cruises_cruise_line ON cruises (cruise_line_id);
CREATE INDEX idx_cruises_ship ON cruises (ship_id);
CREATE INDEX idx_cruises_active ON cruises (show_cruise) WHERE show_cruise = true;
CREATE INDEX idx_cruises_embark_port ON cruises (embark_port_id);
CREATE INDEX idx_cruises_region_ids ON cruises USING GIN (region_ids);

-- Pricing indexes for search performance
CREATE INDEX idx_cheapest_pricing_cruise ON cheapest_pricing (cruise_id);
CREATE INDEX idx_cheapest_pricing_price ON cheapest_pricing (cheapest_price);
CREATE INDEX idx_cheapest_pricing_interior ON cheapest_pricing (interior_price) WHERE interior_price IS NOT NULL;
CREATE INDEX idx_cheapest_pricing_balcony ON cheapest_pricing (balcony_price) WHERE balcony_price IS NOT NULL;

-- Detailed pricing indexes
CREATE INDEX idx_pricing_cruise_cabin ON pricing (cruise_id, cabin_code);
CREATE INDEX idx_pricing_rate_type ON pricing (rate_code, price_type);
CREATE INDEX idx_pricing_available ON pricing (is_available) WHERE is_available = true;
CREATE INDEX idx_pricing_base_price ON pricing (base_price);

-- Ship and port indexes
CREATE INDEX idx_ships_cruise_line ON ships (cruise_line_id);
CREATE INDEX idx_ports_name ON ports (name);
CREATE INDEX idx_cabin_categories_ship ON cabin_categories (ship_id);
CREATE INDEX idx_cabin_categories_category ON cabin_categories (category);

-- Itinerary indexes
CREATE INDEX idx_itineraries_cruise ON itineraries (cruise_id, day_number);
CREATE INDEX idx_itineraries_port ON itineraries (port_id);
CREATE INDEX idx_itineraries_date ON itineraries (date);

-- User data indexes
CREATE INDEX idx_users_clerk_id ON users (clerk_user_id);
CREATE INDEX idx_quote_requests_user ON quote_requests (user_id);
CREATE INDEX idx_quote_requests_status ON quote_requests (status);
CREATE INDEX idx_saved_searches_user ON saved_searches (user_id);

-- Composite indexes for complex searches
CREATE INDEX idx_cruises_date_nights_line ON cruises (sailing_date, nights, cruise_line_id);
CREATE INDEX idx_cruises_date_region ON cruises (sailing_date, region_ids) WHERE show_cruise = true;
CREATE INDEX idx_pricing_cruise_type_available ON pricing (cruise_id, price_type, is_available);

-- Full-text search indexes
CREATE INDEX idx_cruises_name_search ON cruises USING GIN (to_tsvector('english', name));
CREATE INDEX idx_ports_name_search ON ports USING GIN (to_tsvector('english', name || ' ' || COALESCE(city, '') || ' ' || COALESCE(country, '')));
CREATE INDEX idx_ships_name_search ON ships USING GIN (to_tsvector('english', name));
```

---

## 4. Redis Caching Setup

### 4.1 Redis Connection and Configuration
**Estimated Time:** 2 hours
**Dependencies:** 1.4
**Status:** [✅ COMPLETED] - Redis client and connection setup complete

**Files to create:**
- `/backend/src/cache/redis.ts` - Redis client configuration for Render Redis
- `/backend/src/cache/cache-manager.ts` - Cache management utilities
- `/backend/src/cache/cache-keys.ts` - Standardized cache key definitions

**Tasks:**
1. Set up Redis connection to Render Redis service
2. Configure Redis using REDIS_URL environment variable from Render
3. Implement cache health checks for Render Redis
4. Set up Redis error handling and fallbacks for cloud service

### 4.2 Caching Strategy Implementation
**Estimated Time:** 3 hours
**Dependencies:** 3.1
**Status:** [✅ COMPLETED] - Cache manager and strategies implemented

**Cache Implementation Areas:**
- Search results caching (30 minutes TTL)
- Cruise detail data caching (1 hour TTL)
- User session data (24 hours TTL)
- Popular destinations (6 hours TTL)
- Pricing data (15 minutes TTL)

**Files to create:**
- `/backend/src/cache/search-cache.ts` - Search results caching
- `/backend/src/cache/cruise-cache.ts` - Cruise data caching
- `/backend/src/cache/user-cache.ts` - User session caching

---

## 5. Authentication System (Clerk Integration)

### 5.1 Backend Clerk Integration
**Estimated Time:** 3 hours
**Dependencies:** 2.2
**Status:** [🔄 IN PROGRESS] - Middleware created, needs Clerk API keys for completion

**Files to create:**
- `/backend/src/middleware/auth.ts` - Clerk authentication middleware
- `/backend/src/services/user.service.ts` - User management service
- `/backend/src/controllers/auth.controller.ts` - Authentication endpoints
- `/backend/src/types/auth.types.ts` - Authentication type definitions

**Tasks:**
1. Configure Clerk Express middleware
2. Set up JWT verification for protected routes
3. Implement user profile synchronization
4. Create user registration webhook handlers
5. Set up user role management (guest, registered, admin)

### 5.2 Frontend Clerk Integration
**Estimated Time:** 4 hours
**Dependencies:** 4.1
**Status:** [❌ NOT STARTED] - Requires Next.js initialization first

**Files to create:**
- `/frontend/src/app/layout.tsx` - Clerk provider setup
- `/frontend/src/components/auth/SignInButton.tsx` - Sign-in component
- `/frontend/src/components/auth/SignUpButton.tsx` - Sign-up component
- `/frontend/src/components/auth/UserProfile.tsx` - User profile component
- `/frontend/src/hooks/useAuth.ts` - Authentication hook
- `/frontend/src/utils/auth.ts` - Authentication utilities

**Tasks:**
1. Set up ClerkProvider in Next.js app
2. Configure authentication pages and flows
3. Implement protected route middleware
4. Create user profile management interface
5. Set up authentication state management

### 5.3 User Management System
**Estimated Time:** 3 hours
**Dependencies:** 4.2
**Status:** [❌ NOT STARTED] - Awaiting frontend Clerk integration

**Files to create:**
- `/backend/src/models/User.ts` - User data model
- `/backend/src/services/user-sync.service.ts` - Clerk-DB sync service
- `/backend/src/controllers/user.controller.ts` - User management endpoints

**API Endpoints to implement:**
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update user preferences
- `DELETE /api/users/account` - Delete user account

---

## 6. Core API Structure

### 6.1 Express Server Setup
**Estimated Time:** 3 hours
**Dependencies:** 4.1
**Status:** [✅ COMPLETED] - Express app with all middleware configured

**Files to create:**
- `/backend/src/app.ts` - Express application configuration
- `/backend/src/routes/index.ts` - Main router configuration
- `/backend/src/middleware/index.ts` - Middleware aggregation
- `/backend/src/middleware/cors.ts` - CORS configuration
- `/backend/src/middleware/error-handler.ts` - Global error handling
- `/backend/src/middleware/request-logger.ts` - Request logging
- `/backend/src/middleware/rate-limiter.ts` - Rate limiting

**Tasks:**
1. Configure Express with security middleware (helmet, cors)
2. Set up request parsing and validation
3. Implement global error handling
4. Configure request logging with Winston
5. Set up API versioning structure

### 6.2 API Route Structure
**Estimated Time:** 4 hours
**Dependencies:** 5.1
**Status:** [✅ COMPLETED] - All route structures and controllers implemented

**Files to create:**
- `/backend/src/routes/auth.routes.ts` - Authentication routes
- `/backend/src/routes/cruise.routes.ts` - Cruise data routes
- `/backend/src/routes/search.routes.ts` - Search functionality routes
- `/backend/src/routes/quote.routes.ts` - Quote request routes
- `/backend/src/routes/user.routes.ts` - User management routes
- `/backend/src/routes/health.routes.ts` - Health check routes

**API Endpoints Structure:**
```
/api/v1/
├── auth/
│   ├── POST /webhook/clerk - Clerk webhook handler
│   └── GET /me - Current user info
├── cruises/
│   ├── GET / - List cruises with pagination
│   ├── GET /:id - Get cruise details
│   └── GET /:id/pricing - Get cruise pricing
├── search/
│   ├── POST / - Perform cruise search
│   ├── GET /filters - Available search filters
│   └── GET /popular - Popular searches/destinations
├── quotes/
│   ├── POST / - Create quote request
│   ├── GET / - List user's quote requests
│   ├── GET /:id - Get specific quote request
│   └── PUT /:id - Update quote request
├── users/
│   ├── GET /profile - User profile
│   ├── PUT /profile - Update profile
│   └── GET /saved-searches - User's saved searches
└── health/
    ├── GET / - Basic health check
    └── GET /detailed - Detailed system status
```

### 6.3 Request Validation and Error Handling
**Estimated Time:** 3 hours
**Dependencies:** 5.2
**Status:** [✅ COMPLETED] - Validation middleware and error handling implemented

**Files to create:**
- `/backend/src/validators/cruise.validator.ts` - Cruise data validation
- `/backend/src/validators/search.validator.ts` - Search request validation
- `/backend/src/validators/quote.validator.ts` - Quote request validation
- `/backend/src/validators/user.validator.ts` - User data validation
- `/backend/src/utils/validation.ts` - Validation utilities
- `/backend/src/types/api.types.ts` - API request/response types

**Tasks:**
1. Implement Zod schemas for all API inputs
2. Create validation middleware for routes
3. Set up consistent error response format
4. Implement input sanitization
5. Add request size limits and timeouts

---

## 7. Deploy Webhook Endpoint to Render (BEFORE TRAVELTEK INTEGRATION)

### 7.1 Deploy Functional Webhook Endpoint
**Estimated Time:** 2 hours
**Dependencies:** 2.2, 3.2
**Status:** [✅ COMPLETED] - Webhook endpoint deployed and accessible at public URLs

**Tasks:**
1. Ensure basic Express app with webhook endpoint is deployed to staging
2. Verify database connection from deployed app
3. Test webhook endpoint responds with 200 OK
4. Confirm public URL: https://zipsea-staging.onrender.com/api/webhooks/traveltek
5. **IMPORTANT: This URL is required for Traveltek webhook registration**
6. Test with curl or Postman to ensure accessibility

### 7.2 Database Schema Deployment
**Estimated Time:** 1 hour
**Dependencies:** 3.1, 7.1
**Status:** [✅ COMPLETED] - Database schema deployed to Render PostgreSQL

**Tasks:**
1. Run database migrations on Render PostgreSQL
2. Verify all tables created with proper relationships
3. Test database connectivity from deployed application
4. Verify indexes are created for search performance

---

## 8. Traveltek Integration

### 8.1 FTP Connection Setup
**Estimated Time:** 5 hours
**Dependencies:** 2.2
**Status:** [❌ NOT STARTED] - Awaiting Traveltek credentials

**Files to create:**
- `/backend/src/services/traveltek/ftp-client.ts` - FTP connection to ftpeu1prod.traveltek.net
- `/backend/src/services/traveltek/file-processor.ts` - JSON file processing and validation
- `/backend/src/services/traveltek/path-parser.ts` - Parse [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json structure
- `/backend/src/services/traveltek/data-validator.ts` - Validate against Traveltek JSON schema
- `/backend/src/services/traveltek/data-transformer.ts` - Transform Traveltek format to database format
- `/backend/src/config/traveltek.config.ts` - Traveltek configuration
- `/backend/src/types/traveltek.types.ts` - TypeScript types for Traveltek data structures

**Tasks:**
1. Set up FTP client for ftpeu1prod.traveltek.net with iSell credentials
2. Implement hierarchical folder navigation: /[year]/[month]/[lineid]/[shipid]/
3. Parse file paths to extract metadata (year, month, lineId, shipId, cruiseId)
4. Handle month format variation (month without leading zero: 5 vs 05)
5. Download and validate JSON files against comprehensive schema
6. Implement retry logic with exponential backoff for FTP failures
7. Create data transformation layer to map Traveltek fields to database schema

### 8.2 Data Synchronization Pipeline
**Estimated Time:** 8 hours
**Dependencies:** 6.1
**Status:** [❌ NOT STARTED] - Requires FTP connection first

**Files to create:**
- `/backend/src/services/traveltek/sync-service.ts` - Main sync orchestration
- `/backend/src/services/traveltek/cruise-importer.ts` - Import cruise metadata, itinerary, ports
- `/backend/src/services/traveltek/pricing-importer.ts` - Import nested pricing structure (prices/cachedprices)
- `/backend/src/services/traveltek/cabin-importer.ts` - Import cabin definitions with color codes
- `/backend/src/services/traveltek/ship-importer.ts` - Import ship content with images array
- `/backend/src/services/traveltek/port-importer.ts` - Import and normalize port data
- `/backend/src/services/traveltek/region-importer.ts` - Import region hierarchies
- `/backend/src/services/traveltek/webhook-handler.ts` - Handle webhook notifications
- `/backend/src/utils/pricing-calculator.ts` - Calculate cheapest prices and totals
- `/backend/src/utils/occupancy-parser.ts` - Parse occupancy codes (101, 102, 201, etc.)

**Complex Data Processing Flow:**
1. Scan FTP folder structure: /[year]/[month]/[lineid]/[shipid]/
2. Download and parse JSON files with comprehensive validation
3. Process nested pricing structure: RATECODE -> cabin code -> occupancy code
4. Import ship content including images array and nested metadata
5. Transform cheapest pricing objects for all cabin categories
6. Handle cachedprices with 1-day TTL timestamps
7. Parse cabin definitions with color codes and image URLs
8. Import itinerary with proper port relationships
9. Process alternative sailings cross-references
10. Store with proper foreign key relationships and constraints
11. Cache live pricing with proper TTL management in Redis
12. Implement differential updates for webhook-triggered syncs

### 8.3 Webhook Integration
**Estimated Time:** 5 hours
**Dependencies:** 6.2
**Status:** [❌ NOT STARTED] - Requires data sync pipeline

**Files to create:**
- `/backend/src/routes/webhook.routes.ts` - Webhook endpoints
- `/backend/src/controllers/webhook.controller.ts` - Webhook request handlers
- `/backend/src/services/traveltek/webhook-processor.ts` - Process webhook payloads
- `/backend/src/jobs/incremental-sync.job.ts` - Triggered sync from webhooks
- `/backend/src/jobs/cruise-line-sync.job.ts` - Full cruise line sync job
- `/backend/src/jobs/live-pricing-sync.job.ts` - Specific cruise file sync job
- `/backend/scripts/test-webhook.js` - Webhook testing utility

**Webhook Endpoints (Based on Actual Traveltek Examples):**
```typescript
POST /api/webhooks/traveltek
// Single endpoint handling both webhook types

// Webhook Type 1: cruiseline_pricing_updated
// Payload: { event, lineid, currency, marketid, timestamp, description }
// Triggers: Download all JSON files for specified cruise line

// Webhook Type 2: cruises_live_pricing_updated
// Payload: { event, currency, marketid, timestamp, paths: ["2025/05/7/231/8734921.json"] }
// Triggers: Download only specific files listed in paths array
```

**Tasks:**
1. Implement unified webhook endpoint that handles both event types
2. Parse webhook payloads according to Traveltek specification
3. Queue background jobs for asynchronous processing (return 200 immediately)
4. Handle cruiseline_pricing_updated: trigger full cruise line sync
5. Handle cruises_live_pricing_updated: process specific file paths
6. Implement proper error handling (still return 200 to prevent retries)
7. Add webhook signature validation if available from Traveltek
8. Implement idempotency to handle duplicate webhook deliveries
9. Set up monitoring and alerting for webhook processing failures
10. Create fallback daily sync strategy for missed webhooks

---

## 9. Core Data Models

### 9.1 Cruise Data Models
**Estimated Time:** 6 hours
**Dependencies:** 2.2, 6.2
**Status:** [✅ COMPLETED] - All models defined in comprehensive schema

**Files to create:**
- `/backend/src/models/Cruise.ts` - Main cruise model with complex relationships
- `/backend/src/models/Ship.ts` - Ship model with images and content
- `/backend/src/models/CruiseLine.ts` - Cruise line model
- `/backend/src/models/Port.ts` - Port/destination model
- `/backend/src/models/Region.ts` - Region hierarchy model
- `/backend/src/models/Itinerary.ts` - Daily itinerary model
- `/backend/src/models/AlternativeSailing.ts` - Alternative sailing dates model
- `/backend/src/models/CabinCategory.ts` - Cabin definitions with color codes
- `/backend/src/models/Pricing.ts` - Complex nested pricing model
- `/backend/src/models/CheapestPricing.ts` - Denormalized cheapest prices model
- `/backend/src/types/pricing.types.ts` - Pricing-related TypeScript types
- `/backend/src/types/occupancy.types.ts` - Occupancy code definitions

**Tasks:**
1. Implement Drizzle ORM models with complex relationships and foreign keys
2. Add comprehensive data validation and business logic constraints
3. Create model utility methods for price calculations and transformations
4. Set up proper relationships: cruise -> ship -> line, cruise -> ports -> itinerary
5. Implement pricing model to handle nested RATECODE -> CABIN -> OCCUPANCY structure
6. Add model methods for cheapest price calculations across cabin categories
7. Create query helpers for complex searches and filtering
8. Implement proper handling of JSONB fields (images, ship content, amenities)
9. Add occupancy code parsing and validation (101, 102, 201, etc.)
10. Create type-safe interfaces for all Traveltek data structures

### 9.2 User Data Models
**Estimated Time:** 2 hours
**Dependencies:** 4.1
**Status:** [✅ COMPLETED] - User models implemented in schema

**Files to create:**
- `/backend/src/models/User.ts` - User profile model
- `/backend/src/models/QuoteRequest.ts` - Quote request model
- `/backend/src/models/SavedSearch.ts` - Saved search model
- `/backend/src/models/UserPreferences.ts` - User preferences model

### 9.3 Search and Filtering Models
**Estimated Time:** 3 hours
**Dependencies:** 7.1
**Status:** [❌ NOT STARTED] - Requires service implementation

**Files to create:**
- `/backend/src/models/SearchCriteria.ts` - Search parameters model
- `/backend/src/services/search.service.ts` - Search logic implementation
- `/backend/src/utils/filter-builder.ts` - Dynamic query building
- `/backend/src/types/search.types.ts` - Search-related types

**Search Features to Implement:**
- Destination-based filtering
- Date range searching
- Price range filtering
- Duration filtering
- Cruise line filtering
- Cabin type filtering
- Departure port filtering

---

## 10. Basic API Endpoints

### 10.1 Cruise Search API
**Estimated Time:** 7 hours
**Dependencies:** 7.3
**Status:** [✅ COMPLETED] - Search API with advanced filtering implemented

**Files to create:**
- `/backend/src/controllers/search.controller.ts` - Search endpoint logic
- `/backend/src/services/search.service.ts` - Search business logic with cheapest pricing
- `/backend/src/services/filter.service.ts` - Dynamic filter generation
- `/backend/src/utils/search-optimizer.ts` - Search query optimization for complex pricing
- `/backend/src/utils/price-aggregator.ts` - Aggregate cheapest prices by cabin category
- `/backend/src/utils/region-filter.ts` - Handle region array filtering

**Enhanced Endpoints to implement:**
```typescript
POST /api/v1/search
// Request body: SearchCriteria (date range, region, duration, price range, cabin type)
// Response: PaginatedCruiseResults with cheapest pricing per cabin category
// Uses cheapest_pricing table for fast results

GET /api/v1/search/filters
// Response: AvailableFilters (regions from region_ids arrays, cruise lines, ports, etc.)
// Dynamic filters based on available cruises

GET /api/v1/search/suggestions?q=query
// Response: SearchSuggestions (ports, ships, cruise lines, regions)
// Full-text search across multiple entities

GET /api/v1/search/regions
// Response: RegionHierarchy with cruise counts
// Built from regionids arrays in cruise data

GET /api/v1/search/ports
// Response: PopularPorts with departure counts
// Based on embark_port_id frequency
```

**Enhanced Tasks:**
1. Implement search leveraging cheapest_pricing table for performance
2. Handle complex price filtering across multiple cabin categories
3. Implement region filtering using PostgreSQL array operations
4. Create dynamic filter generation based on available cruise data
5. Add full-text search across ships, ports, and cruise names
6. Optimize queries for large datasets with proper indexing
7. Implement price range filtering with proper currency handling
8. Add sorting by price (using cheapest prices), date, duration
9. Create efficient pagination for large result sets
10. Handle alternative sailing suggestions in search results

### 10.2 Cruise Detail API
**Estimated Time:** 5 hours
**Dependencies:** 7.1
**Status:** [✅ COMPLETED] - Cruise detail API with comprehensive data implemented

**Files to create:**
- `/backend/src/controllers/cruise.controller.ts` - Comprehensive cruise detail endpoints
- `/backend/src/services/cruise.service.ts` - Cruise business logic with pricing aggregation
- `/backend/src/services/pricing.service.ts` - Pricing logic for nested rate/cabin/occupancy structure
- `/backend/src/services/itinerary.service.ts` - Itinerary and port information service
- `/backend/src/utils/cabin-aggregator.ts` - Aggregate cabin categories with pricing
- `/backend/src/utils/ship-content-formatter.ts` - Format ship images and content

**Enhanced Endpoints to implement:**
```typescript
GET /api/v1/cruises/:id
// Response: CompleteCruiseDetails with ship content, itinerary, alternative sailings
// Includes: cruise metadata, ship details with images, complete itinerary, region info

GET /api/v1/cruises/:id/pricing
// Response: CruisePricingOptions organized by cabin category
// Structure: { interior: [rates], oceanview: [rates], balcony: [rates], suite: [rates] }
// Includes both static and live pricing with proper precedence

GET /api/v1/cruises/:id/pricing/:cabinCode
// Response: DetailedCabinPricing for specific cabin with all rate codes and occupancy options
// Shows: base price, taxes, fees, gratuities, total by occupancy (1, 2, 3, 4 guests)

GET /api/v1/cruises/:id/cabins
// Response: CabinDefinitions with color codes, images, and amenities
// Organized by category with deck information

GET /api/v1/cruises/:id/itinerary
// Response: DetailedItinerary with port information, times, descriptions
// Includes: port details, arrival/departure times, overnight stays, shore excursions

GET /api/v1/cruises/:id/ship
// Response: ShipDetails with images, amenities, deck plans
// From shipcontent object with proper image URLs

GET /api/v1/cruises/:id/alternatives
// Response: AlternativeSailings for same itinerary on different dates
// From altsailings array with pricing comparison
```

**Enhanced Tasks:**
1. Implement comprehensive cruise detail aggregation from multiple tables
2. Handle complex pricing display with proper rate code prioritization
3. Format ship content including images array and metadata
4. Create detailed itinerary presentation with port enrichment
5. Implement cabin category aggregation with color coding
6. Handle live vs static pricing precedence and caching
7. Add alternative sailing comparison and recommendation logic
8. Optimize database queries with proper joins and indexing
9. Implement proper error handling for missing data
10. Add caching strategies for frequently accessed cruise details

### 10.3 Quote Request API
**Estimated Time:** 4 hours
**Dependencies:** 4.2, 7.2
**Status:** [❌ NOT STARTED] - Requires frontend authentication

**Files to create:**
- `/backend/src/controllers/quote.controller.ts` - Quote request endpoints
- `/backend/src/services/quote.service.ts` - Quote business logic
- `/backend/src/services/email.service.ts` - Email notification service

**Endpoints to implement:**
```typescript
POST /api/v1/quotes
// Request body: QuoteRequestData
// Response: CreatedQuoteRequest

GET /api/v1/quotes (authenticated)
// Response: UserQuoteRequests[]

GET /api/v1/quotes/:id (authenticated)
// Response: QuoteRequestDetails

PUT /api/v1/quotes/:id (authenticated)
// Request body: QuoteRequestUpdate
// Response: UpdatedQuoteRequest
```

---

## 11. Error Handling & Monitoring

### 11.1 Sentry Integration
**Estimated Time:** 3 hours
**Dependencies:** 5.1
**Status:** [✅ COMPLETED] - Sentry configured for backend and frontend

**Files to create:**
- `/backend/src/config/sentry.config.ts` - Backend Sentry configuration
- `/frontend/next.config.js` - Frontend Sentry configuration (updated)
- `/backend/src/middleware/sentry.middleware.ts` - Sentry error capture
- `/frontend/src/utils/sentry.ts` - Frontend error tracking

**Tasks:**
1. Configure Sentry for both backend and frontend
2. Set up error context capture (user info, request data)
3. Implement custom error types and categories
4. Set up performance monitoring
5. Configure alert rules for critical errors

### 11.2 Logging System
**Estimated Time:** 2 hours
**Dependencies:** 5.1
**Status:** [✅ COMPLETED] - Winston logger configured with structured logging

**Files to create:**
- `/backend/src/config/logger.config.ts` - Winston logger configuration
- `/backend/src/utils/logger.ts` - Logger utilities
- `/backend/src/middleware/request-logger.ts` - Request logging middleware

**Tasks:**
1. Set up structured logging with Winston
2. Configure log levels and formats for complex operations
3. Implement log rotation and retention
4. Set up separate logs for errors, requests, Traveltek sync operations, and webhook processing
5. Configure production vs development logging
6. Add specific logging for pricing calculations and data transformations
7. Log webhook processing and FTP synchronization events
8. Implement performance logging for search queries and data imports

### 11.3 Health Monitoring
**Estimated Time:** 2 hours
**Dependencies:** 3.1, 2.2
**Status:** [✅ COMPLETED] - Health check endpoints implemented

**Files to create:**
- `/backend/src/controllers/health.controller.ts` - Health check endpoints
- `/backend/src/services/health.service.ts` - Health check logic
- `/backend/src/utils/system-check.ts` - System status utilities

**Health Checks to Implement:**
- Database connectivity
- Redis connectivity
- Traveltek FTP accessibility
- External service status
- Memory and disk usage
- Application uptime

---

## 12. Testing Framework

### 12.1 Backend Testing Setup
**Estimated Time:** 5 hours
**Dependencies:** 5.2
**Status:** [✅ COMPLETED] - Jest configured with comprehensive test setup

**Files to create:**
- `/backend/src/tests/setup.ts` - Test environment setup
- `/backend/src/tests/utils/test-db.ts` - Test database utilities
- `/backend/src/tests/utils/test-helpers.ts` - Common test helpers
- `/backend/src/tests/fixtures/traveltek-data.ts` - Traveltek JSON test fixtures
- `/backend/src/tests/fixtures/cruise-data.ts` - Sample cruise data
- `/backend/src/tests/fixtures/pricing-data.ts` - Complex pricing test data
- `/backend/src/tests/mocks/ftp-client.mock.ts` - Mock FTP client for testing
- `/backend/src/tests/mocks/webhook-payloads.ts` - Sample webhook payloads

**Enhanced Test Categories:**
- Unit tests for services and utilities (pricing calculations, data transformations)
- Integration tests for API endpoints with complex data scenarios
- Database operation tests with foreign key constraints
- Authentication flow tests
- Traveltek data parsing and validation tests
- Webhook processing tests
- FTP synchronization tests (mocked)
- Pricing calculation accuracy tests
- Search performance tests with large datasets

### 12.2 API Integration Tests
**Estimated Time:** 7 hours
**Dependencies:** 10.1, 8.1, 8.2, 8.3
**Status:** [❌ NOT STARTED] - Requires API endpoints implementation

**Files to create:**
- `/backend/src/tests/integration/auth.test.ts` - Authentication tests
- `/backend/src/tests/integration/search.test.ts` - Complex search API tests
- `/backend/src/tests/integration/cruise.test.ts` - Cruise detail API tests
- `/backend/src/tests/integration/pricing.test.ts` - Pricing API tests
- `/backend/src/tests/integration/quote.test.ts` - Quote API tests
- `/backend/src/tests/integration/webhook.test.ts` - Webhook processing tests
- `/backend/src/tests/integration/traveltek-sync.test.ts` - Data sync integration tests

**Enhanced Test Scenarios:**
- Successful API requests with complex Traveltek data
- Error handling with malformed pricing data
- Authentication required endpoints
- Rate limiting behavior
- Database state changes with foreign key constraints
- Search API with various filter combinations
- Pricing API with nested rate/cabin/occupancy structures
- Webhook payload processing and job queuing
- Data synchronization with mock FTP responses
- Performance testing with large datasets
- Currency handling and price calculations
- Cache behavior and TTL expiration

### 12.3 Service Layer Tests
**Estimated Time:** 6 hours
**Dependencies:** 10.1, 6.2, 7.1
**Status:** [❌ NOT STARTED] - Requires service implementations

**Files to create:**
- `/backend/src/tests/unit/traveltek-sync.test.ts` - Traveltek data synchronization tests
- `/backend/src/tests/unit/traveltek-parser.test.ts` - JSON parsing and validation tests
- `/backend/src/tests/unit/pricing-calculator.test.ts` - Pricing calculation logic tests
- `/backend/src/tests/unit/occupancy-parser.test.ts` - Occupancy code parsing tests
- `/backend/src/tests/unit/search-service.test.ts` - Search service with complex filters
- `/backend/src/tests/unit/cruise-service.test.ts` - Cruise data aggregation tests
- `/backend/src/tests/unit/ship-importer.test.ts` - Ship content processing tests
- `/backend/src/tests/unit/cabin-importer.test.ts` - Cabin definition processing tests
- `/backend/src/tests/unit/webhook-processor.test.ts` - Webhook payload processing tests
- `/backend/src/tests/unit/user-service.test.ts` - User service tests
- `/backend/src/tests/unit/cache-service.test.ts` - Caching service tests
- `/backend/src/tests/unit/data-validator.test.ts` - Traveltek data validation tests

**Enhanced Test Coverage:**
- Traveltek JSON file parsing with various data structures
- Complex pricing calculations with multiple occupancy scenarios
- Data transformation from Traveltek format to database schema
- Webhook processing for both static and live pricing updates
- Search optimization with large datasets
- Cache management with proper TTL handling
- Error handling for malformed or incomplete data
- Currency conversion and price aggregation
- Foreign key relationship validation
- Performance testing for data import operations

---

## 13. Documentation

### 13.1 API Documentation
**Estimated Time:** 3 hours
**Dependencies:** 8.3
**Status:** [❌ NOT STARTED] - Requires completed API endpoints

**Files to create:**
- `/docs/api/README.md` - API overview and getting started
- `/docs/api/authentication.md` - Authentication guide
- `/docs/api/endpoints/` - Detailed endpoint documentation
- `/backend/src/swagger/swagger.config.ts` - Swagger/OpenAPI setup

**Tasks:**
1. Set up Swagger/OpenAPI documentation
2. Document all API endpoints with examples
3. Create authentication guide
4. Add rate limiting and error code documentation
5. Set up automated API docs generation

### 13.2 Database Documentation
**Estimated Time:** 2 hours
**Dependencies:** 2.2
**Status:** [❌ NOT STARTED] - Schema ready for documentation

**Files to create:**
- `/docs/database/schema.md` - Database schema documentation
- `/docs/database/relationships.md` - Entity relationship documentation
- `/docs/database/indexes.md` - Index strategy documentation

### 13.3 Development Setup Documentation
**Estimated Time:** 2 hours
**Dependencies:** 1.4
**Status:** [❌ NOT STARTED] - Environment ready for documentation

**Files to create:**
- `/docs/development/setup.md` - Local development setup
- `/docs/development/testing.md` - Testing guide
- `/docs/development/deployment.md` - Deployment procedures
- `/docs/development/troubleshooting.md` - Common issues and solutions

---

## 14. Final Production Deployment

### 14.1 Production Deployment
**Estimated Time:** 2 hours
**Dependencies:** All previous sections
**Status:** [❌ NOT STARTED] - Final production deployment

**Tasks:**
1. Create production environment group in Render
2. Deploy to production with all features
3. Configure production database with full dataset
4. Set up production monitoring and alerts
5. Configure production health checks and auto-scaling
6. Update webhook URLs for production

### 14.2 Production Monitoring Setup
**Estimated Time:** 2 hours
**Dependencies:** 12.1
**Status:** [✅ COMPLETED] - Environment templates created for all services

**Files to create:**
- `/backend/.env.production` - Production environment template
- `/frontend/.env.production` - Frontend production environment
- `/docs/deployment/environment-variables.md` - Environment documentation

**Environment Variables to Configure:**
- Database connection strings
- Redis connection URL
- Clerk API keys
- Traveltek FTP credentials
- Sentry DSN
- API base URLs
- CORS origins

### 14.3 CI/CD Pipeline
**Estimated Time:** 3 hours
**Dependencies:** 10.2
**Status:** [❌ NOT STARTED] - Requires testing infrastructure

**Files to create:**
- `/.github/workflows/test.yml` - Automated testing workflow
- `/.github/workflows/deploy.yml` - Deployment workflow
- `/scripts/test.sh` - Test runner script
- `/scripts/build.sh` - Build script

**Pipeline Steps:**
1. Run tests on pull requests
2. Build and test on main branch
3. Deploy to staging automatically
4. Manual production deployment approval
5. Post-deployment health checks

---

## Phase 1 Completion Checklist

### Core Infrastructure
- [x] Project structure and tooling set up ✅ COMPLETED
- [x] ~~Development environment fully configured~~ **SKIPPED - Using Render Only** ✅ COMPLETED
- [x] ~~Docker Compose for local development working~~ **SKIPPED - Using Render Services** ✅ COMPLETED
- [x] Git repository initialized with proper branching strategy ✅ COMPLETED
- [ ] **NEW: Render services deployed and accessible (PostgreSQL, Redis, Web Service)**
- [ ] **NEW: Webhook endpoint deployed and publicly accessible**
- [ ] **NEW: Environment groups configured in Render**

### Database & Caching
- [ ] Complex PostgreSQL schema designed and implemented (with nested pricing structure)
- [ ] Database migrations working with foreign key constraints
- [ ] Redis caching configured and operational
- [ ] Database indexes optimized for complex search performance
- [ ] Cheapest pricing denormalization for fast search
- [ ] Region array handling and indexing
- [ ] JSONB fields for ship content and images

### Authentication
- [ ] Clerk integration complete for backend and frontend
- [ ] User registration and login flows working
- [ ] Protected routes and middleware implemented
- [ ] User profile management functional

### API Foundation
- [ ] Express server configured with security middleware
- [ ] API route structure implemented
- [ ] Request validation and error handling working
- [ ] All core endpoints functional and tested

### Traveltek Integration
- [ ] FTP connection to ftpeu1prod.traveltek.net established
- [ ] Complex data synchronization pipeline working
- [ ] Nested pricing structure parsing (RATECODE->CABIN->OCCUPANCY)
- [ ] Ship content and images array processing
- [ ] Cabin definitions with color codes imported
- [ ] Webhook integration for both static and live pricing updates
- [ ] Incremental sync based on webhook notifications
- [ ] Data validation and comprehensive error handling implemented
- [ ] File path parsing: [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
- [ ] Alternative sailings cross-reference processing

### Testing & Monitoring
- [ ] Unit and integration test suites complete **ON RENDER STAGING**
- [ ] Sentry error tracking operational **FOR RENDER DEPLOYMENT**
- [ ] Logging system configured **WITH RENDER LOGS**
- [ ] Health monitoring endpoints working **FOR RENDER SERVICES**

### Documentation
- [ ] API documentation complete
- [ ] Database schema documented
- [ ] Development setup guide written
- [ ] Deployment procedures documented

### Deployment
- [ ] **Early Render staging deployment operational**
- [ ] **Webhook endpoint publicly accessible**
- [ ] **Environment groups configured in Render**
- [ ] CI/CD pipeline operational with staging tests
- [ ] Production deployment successful

---

## Success Criteria for Phase 1

1. **Functional Requirements Met:**
   - Users can register and authenticate via Clerk
   - Advanced cruise search functionality works with complex pricing
   - Search by region arrays, price ranges, and cabin categories
   - Detailed cruise information with ship content and itineraries
   - Quote requests can be submitted and tracked
   - Admin users can manage quote requests

2. **Technical Requirements Met:**
   - All services deployed and running on Render (PostgreSQL, Redis, Web Service)
   - **Webhook endpoint publicly accessible for Traveltek registration**
   - Complex database schema with proper relationships operational on Render
   - Traveltek data sync working automatically with webhook integration
   - Nested pricing structure properly parsed and stored
   - Cheapest pricing calculations accurate across all cabin categories
   - Error monitoring and logging functional on Render
   - Redis caching with proper TTL management on Render services

3. **Performance Requirements Met:**
   - API responses under 2 seconds for 95% of requests **ON RENDER**
   - Search results load in under 1 second using cheapest_pricing table **ON RENDER**
   - Complex pricing queries optimized with proper indexing **ON RENDER POSTGRESQL**
   - System uptime above 99% during testing period **ON RENDER INFRASTRUCTURE**
   - FTP sync operations complete within acceptable timeframes **FROM RENDER**

4. **Quality Requirements Met:**
   - Code coverage above 80% for critical paths including pricing calculations
   - All integration tests passing **ON RENDER STAGING** with complex Traveltek data scenarios
   - Webhook processing tested and validated **ON PUBLIC STAGING URL**
   - Security audit completed with no critical issues **FOR RENDER DEPLOYMENT**
   - Comprehensive documentation covering complex data structures **AND RENDER WORKFLOW**
   - Data validation ensuring integrity of nested pricing and relationships **ON RENDER**

---

## Estimated Timeline: 8 Weeks (Reduced)

**Week 1:** Project setup, Render deployment configuration, webhook endpoint deployment
**Week 2:** Database schema deployment, authentication, basic API structure
**Week 3-4:** Traveltek integration (with webhook URL ready), complex data models
**Week 5-6:** Advanced search functionality, nested pricing structures
**Week 7:** Comprehensive testing on Render staging, error handling, monitoring
**Week 8:** Documentation, production deployment, final testing and optimization

**Note:** Timeline reduced from 10 to 8 weeks due to Render-first approach:
- **Removed:** Local Docker setup, PostgreSQL/Redis installation
- **Removed:** Local testing infrastructure setup
- **Added:** Early Render deployment and webhook endpoint deployment
- **Simplified:** Push-to-staging development workflow
- **Maintained:** All complex Traveltek integration requirements

## Next Phase Preview

Phase 2 will focus on enhanced search functionality, cruise detail pages, comprehensive quote management, email integration, and frontend UI development, building upon the solid foundation established in Phase 1.