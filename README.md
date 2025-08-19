# Zipsea Cruise OTA Platform

A modern cruise-focused Online Travel Agency (OTA) platform built with cutting-edge technology to revolutionize how customers search, discover, and book cruise vacations.

## 🚀 Project Overview

Zipsea differentiates itself by offering significantly more onboard credit (OBC) back to customers compared to existing cruise OTAs, while providing a superior user experience through modern design and intuitive functionality.

### Key Features

- **Advanced Cruise Search**: Multi-criteria search with real-time filtering
- **Comprehensive Cruise Details**: Ship information, itineraries, and pricing
- **Quote Request System**: Streamlined quote process with tracking
- **Traveltek Integration**: Automated data synchronization from Traveltek FTP
- **User Management**: Clerk-based authentication and profile management
- **Performance Optimized**: Redis caching and optimized database queries

## 🏗️ Architecture

### Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Caching**: Redis 7+ for performance optimization
- **Authentication**: Clerk for user management
- **Monitoring**: Sentry for error tracking and performance
- **Email**: Resend for transactional emails

### Database Design
- Complex schema optimized for Traveltek data structure
- INTEGER IDs for cruiseid, lineid, shipid
- Nested pricing structure with RATECODE → CABIN → OCCUPANCY hierarchy
- Denormalized cheapest pricing table for fast search performance
- Comprehensive indexing for search optimization

### Key Integrations
- **Traveltek FTP**: Automated cruise data synchronization
- **Webhook Processing**: Real-time updates for pricing changes
- **Live Pricing Cache**: 1-day TTL cached pricing with proper handling

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zipsea
   ```

2. **Set up the development environment**
   ```bash
   make setup
   ```

3. **Start development**
   ```bash
   make dev
   ```

### Manual Setup

If you prefer manual setup:

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Docker services**
   ```bash
   docker compose up -d postgres redis
   ```

4. **Run database migrations**
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📋 Available Commands

### Development
- `make dev` - Start development server
- `make build` - Build for production
- `make test` - Run test suite
- `make lint` - Run ESLint
- `make format` - Format code with Prettier

### Database
- `make db-migrate` - Run database migrations
- `make db-seed` - Seed database with sample data
- `make db-studio` - Open Drizzle Studio
- `make db-reset` - Reset database to clean state

### Docker
- `make docker-up` - Start Docker services
- `make docker-down` - Stop Docker services
- `make docker-logs` - View Docker logs

### Quality Assurance
- `make check` - Run all quality checks
- `make typecheck` - TypeScript type checking
- `make test-coverage` - Run tests with coverage

### Utilities
- `make reset` - Complete environment reset
- `make clean` - Clean build artifacts
- `make status` - Show environment status
- `make help` - Show all available commands

## 🗄️ Database Schema

### Core Tables
- **cruises**: Main cruise data with INTEGER IDs and JSON arrays for regions/ports
- **ships**: Ship information with images and amenities
- **cruise_lines**: Cruise line master data
- **ports**: Port information with coordinates and details
- **pricing**: Complex nested pricing structure
- **cheapest_pricing**: Denormalized for fast search performance
- **cabin_categories**: Cabin definitions with color codes
- **itineraries**: Daily cruise itinerary details

### Relationships
- Cruises → Ships → Cruise Lines
- Cruises → Ports (embark/disembark)
- Cruises → Pricing (multiple rate codes)
- Cruises → Itineraries (daily breakdown)

## 🔧 Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL=postgresql://zipsea_user:zipsea_password@localhost:5432/zipsea_dev

# Redis
REDIS_URL=redis://:redis_password@localhost:6379

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Traveltek
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=your_ftp_username
TRAVELTEK_FTP_PASSWORD=your_ftp_password

# Monitoring
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
```

## 🧪 Testing

### Test Structure
- **Unit Tests**: Individual function and class testing
- **Integration Tests**: API endpoint and database testing
- **Service Tests**: Traveltek integration and complex business logic

### Running Tests
```bash
# Run all tests
make test

# Run tests in watch mode
make test-watch

# Run with coverage
make test-coverage
```

## 📚 API Documentation

### Core Endpoints

#### Health Check
- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed system status

#### Cruise Search (Planned)
- `POST /api/v1/search` - Search cruises with filters
- `GET /api/v1/cruises/:id` - Get cruise details
- `GET /api/v1/cruises/:id/pricing` - Get cruise pricing

#### User Management (Planned)
- `GET /api/v1/users/profile` - User profile
- `PUT /api/v1/users/profile` - Update profile

#### Quote Requests (Planned)
- `POST /api/v1/quotes` - Create quote request
- `GET /api/v1/quotes` - List user quotes

## 🔄 Data Synchronization

### Traveltek Integration
- **FTP Connection**: ftpeu1prod.traveltek.net
- **File Structure**: `[year]/[month]/[lineid]/[shipid]/[codetocruiseid].json`
- **Webhook Support**: Real-time updates for pricing changes
- **Data Processing**: Complex transformation from Traveltek format to normalized schema

### Sync Process
1. Connect to Traveltek FTP server
2. Download JSON files based on webhooks or scheduled sync
3. Parse and validate data structure
4. Transform nested pricing objects
5. Update database with proper relationships
6. Invalidate relevant caches

## 🚀 Deployment

### Render Deployment

Zipsea is configured for deployment on Render using Infrastructure as Code with the `render.yaml` Blueprint.

#### Quick Deployment

1. **Fork and Connect Repository**
   ```bash
   # Push your code to GitHub
   git remote add origin https://github.com/your-username/zipsea.git
   git push -u origin main
   ```

2. **Deploy with Render Blueprint**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically read `render.yaml` and create all services

3. **Set Required Environment Variables**
   ```bash
   # Required for production
   CLERK_PUBLISHABLE_KEY=pk_live_your_publishable_key
   CLERK_SECRET_KEY=sk_live_your_secret_key
   SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
   
   # Traveltek Integration
   TRAVELTEK_API_KEY=your_traveltek_api_key
   TRAVELTEK_DEALER_CODE=your_dealer_code
   ```

#### Available Environments

**Staging Environment**
- URL: `https://zipsea-staging.onrender.com`
- Auto-deploys from `main` branch
- Webhook URL: `https://zipsea-staging.onrender.com/api/webhooks/traveltek`

**Production Environment**
- URL: `https://zipsea.onrender.com`
- Manual deploys from `production` branch
- Webhook URL: `https://zipsea.onrender.com/api/webhooks/traveltek`

#### Services Created

1. **PostgreSQL Database** (`zipsea-postgres`)
   - Plan: Starter (free tier available)
   - Persistent storage with automatic backups

2. **Redis Cache** (`zipsea-redis`)
   - Plan: Starter (free tier available)
   - Session storage and API caching

3. **Backend API** (`zipsea-staging` / `zipsea-production`)
   - Node.js runtime with TypeScript build
   - Automatic health checks on `/health`
   - Environment-specific configuration

#### Manual Deployment Steps

If you prefer manual setup:

1. **Create Services Individually**
   ```bash
   # Create PostgreSQL database
   render services create database \
     --name zipsea-postgres \
     --plan starter

   # Create Redis instance
   render services create redis \
     --name zipsea-redis \
     --plan starter

   # Create web service
   render services create web \
     --name zipsea-staging \
     --build-command "cd backend && npm ci && npm run build" \
     --start-command "cd backend && npm start" \
     --env-var NODE_ENV=staging
   ```

2. **Configure Environment Variables**
   Set all required environment variables in Render dashboard or via CLI

3. **Connect Database**
   Link the PostgreSQL and Redis services to your web service

#### Build Process

The deployment uses these scripts:

```bash
# Build command (automatic)
cd backend && npm ci && npm run build

# Start command (automatic)
cd backend && npm start
```

**Build script** (`backend/build.sh`):
- Installs dependencies
- Runs TypeScript compilation
- Validates build artifacts

**Start script** (`backend/start.sh`):
- Runs database migrations
- Validates environment
- Starts the application

#### Health Checks

Render monitors these endpoints:

- **Basic Health**: `GET /health`
- **Detailed Status**: `GET /health/detailed`
- **Webhook Health**: `GET /api/webhooks/traveltek/health`

#### Environment Variables

**Auto-Generated** (by Render):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `WEBHOOK_SECRET` - Webhook signature validation

**Required** (set manually):
```bash
# Authentication
CLERK_PUBLISHABLE_KEY=pk_live_your_key
CLERK_SECRET_KEY=sk_live_your_key

# Monitoring
SENTRY_DSN=https://your_dsn@sentry.io/project

# Traveltek
TRAVELTEK_API_KEY=your_api_key
TRAVELTEK_DEALER_CODE=your_dealer_code
```

**Environment-Specific**:
```bash
# Staging
NODE_ENV=staging
CORS_ORIGIN=https://zipsea-staging-frontend.onrender.com,http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=100

# Production
NODE_ENV=production
CORS_ORIGIN=https://zipsea.onrender.com
RATE_LIMIT_MAX_REQUESTS=200
```

#### Webhook Configuration

For Traveltek integration, register these webhook URLs:

- **Staging**: `https://zipsea-staging.onrender.com/api/webhooks/traveltek`
- **Production**: `https://zipsea.onrender.com/api/webhooks/traveltek`

The webhook endpoints support:
- Price updates
- Availability changes
- Booking confirmations
- Cancellations

#### Deployment Workflow

1. **Development** → Push to `main` → **Staging** (auto-deploy)
2. **Staging** → Create PR to `production` → **Production** (manual deploy)

#### Monitoring

- **Health Checks**: Automatic monitoring via `/health`
- **Error Tracking**: Sentry integration for error monitoring
- **Performance**: Built-in Render metrics
- **Logs**: Centralized logging via Render dashboard

#### Troubleshooting

**Build Failures**:
```bash
# Check build logs in Render dashboard
# Common issues:
# - Missing environment variables
# - TypeScript compilation errors
# - Node.js version mismatch
```

**Runtime Issues**:
```bash
# Check application logs
# Common issues:
# - Database connection failures
# - Missing environment variables
# - Redis connection issues
```

**Health Check Failures**:
```bash
# Verify endpoints respond:
curl https://your-app.onrender.com/health
curl https://your-app.onrender.com/api/webhooks/traveltek/health
```

### Production Checklist
- [ ] GitHub repository connected to Render
- [ ] Render Blueprint deployed successfully
- [ ] Environment variables configured
- [ ] Database migrations applied automatically
- [ ] Redis cache connected and functional
- [ ] Health checks responding (200 OK)
- [ ] Sentry monitoring configured
- [ ] Webhook URLs registered with Traveltek
- [ ] SSL certificates automatically configured
- [ ] DNS configured (if using custom domain)

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes with tests
3. Run quality checks: `make check`
4. Submit pull request

### Code Quality
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Comprehensive test coverage
- Database migration discipline

## 📄 License

This project is proprietary and confidential.

## 🆘 Support

For development support:
1. Check the logs: `make docker-logs`
2. Verify environment: `make status`
3. Reset if needed: `make reset`
4. Review documentation in `/documentation/`

---

**Built with ❤️ for the cruise industry**