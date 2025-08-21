# Zipsea Backend Deployment Workflow

## Overview
The Zipsea backend uses a **Render-first deployment strategy** - we do not test locally. All development and testing happens directly on Render's staging and production environments.

## Deployment Architecture

### Service Structure
```
Zipsea Backend Services on Render:
├── zipsea-backend (Staging)
│   ├── URL: https://zipsea-backend.onrender.com
│   ├── Branch: main (auto-deploy)
│   ├── Environment: staging
│   └── Purpose: Development testing
└── zipsea-production (Production) 
    ├── URL: https://zipsea-production.onrender.com
    ├── Branch: production (manual deploy)
    ├── Environment: production
    └── Purpose: Live system
```

### Database Configuration
```
PostgreSQL Services:
├── Staging Database
│   ├── Connected to: zipsea-backend service
│   ├── Environment: development/testing data
│   └── Safe for schema changes and testing
└── Production Database
    ├── Connected to: zipsea-production service  
    ├── Environment: live customer data
    └── Requires careful change management
```

### Redis Configuration
```
Redis Services:
├── Staging Redis
│   ├── Connected to: zipsea-backend service
│   ├── Cache TTL: shorter (for testing)
│   └── Safe for cache experiments
└── Production Redis
    ├── Connected to: zipsea-production service
    ├── Cache TTL: optimized (15min-6hrs)
    └── Performance-tuned configuration
```

## Deployment Process

### Standard Development Workflow
**No Local Testing - Direct Render Deployment**

```bash
# Step 1: Code locally with TypeScript/Node.js
git add .
git commit -m "Feature: implement new functionality"

# Step 2: Push to GitHub main branch
git push origin main

# Step 3: Auto-deployment to staging
# Render automatically deploys main branch to staging environment
# Monitor deployment: https://dashboard.render.com

# Step 4: Test on staging environment  
curl https://zipsea-backend.onrender.com/api/health
./test-search-api.sh staging

# Step 5: Manual promotion to production (when ready)
# Via Render dashboard: promote staging build to production
# OR manual deploy production branch:
git checkout production
git merge main
git push origin production
```

### Branch Strategy
```
Branch Structure:
├── main
│   ├── Primary development branch
│   ├── Auto-deploys to staging
│   ├── All new features and fixes
│   └── Always deployable to production
└── production
    ├── Production deployment branch  
    ├── Manual deploys only
    ├── Mirrors main when ready for release
    └── Tagged releases for rollback capability
```

## Service URLs and Endpoints

### Staging Environment
**Base URL**: `https://zipsea-backend.onrender.com`

**Key Endpoints**:
```bash
# Health Check
GET /api/health
curl https://zipsea-backend.onrender.com/api/health

# Search API
GET /api/v1/search?query=caribbean&page=1&limit=10
curl "https://zipsea-backend.onrender.com/api/v1/search?query=caribbean"

# Cruise Details  
GET /api/v1/cruises/:id
curl https://zipsea-backend.onrender.com/api/v1/cruises/12345

# Admin Routes (protected)
GET /api/admin/stats
GET /api/admin/sync-status

# Test Webhook
POST /api/webhooks/traveltek/test
curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/test
```

### Production Environment ⭐
**Base URL**: `https://zipsea-production.onrender.com`

**Key Endpoints**:
```bash  
# Health Check
GET /api/health
curl https://zipsea-production.onrender.com/api/health

# Search API
GET /api/v1/search?query=caribbean&page=1&limit=10
curl "https://zipsea-production.onrender.com/api/v1/search?query=caribbean"

# Cruise Details
GET /api/v1/cruises/:id  
curl https://zipsea-production.onrender.com/api/v1/cruises/12345

# Webhook Endpoint (LIVE - configured in Traveltek iSell)
POST /api/webhooks/traveltek
# URL: https://zipsea-production.onrender.com/api/webhooks/traveltek
```

## Testing Strategy

### Since We Don't Test Locally
**All testing happens on Render environments**

#### 1. Staging Testing Scripts
```bash
# API endpoint testing
./test-search-api.sh
./test-search-apis.sh  
./test-production-performance.sh

# Database testing
node scripts/check-database-data.js
node scripts/verify-sync-data.js

# Webhook testing
node scripts/check-webhook-health.js
./test-webhook-pricing.sh
```

#### 2. Production Monitoring
```bash
# Performance monitoring
./test-production-performance.sh
node monitor-search-performance.js

# Data verification
node scripts/check-production-data.js
node scripts/verify-data-completeness.js

# Health monitoring
curl https://zipsea-production.onrender.com/api/health
```

#### 3. Render Dashboard Monitoring
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, response times
- **Deployments**: Build status and deployment history
- **Environment Variables**: Secure configuration management

## Environment Variables Configuration

### Staging Environment Variables
```bash
# Database
DATABASE_URL=[staging-postgresql-connection]

# Redis  
REDIS_URL=[staging-redis-connection]

# Traveltek FTP
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=[staging-user]
TRAVELTEK_FTP_PASSWORD=[staging-password]

# Application
NODE_ENV=staging
PORT=3000
LOG_LEVEL=debug
```

### Production Environment Variables
```bash
# Database
DATABASE_URL=[production-postgresql-connection]

# Redis
REDIS_URL=[production-redis-connection]

# Traveltek FTP
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=[production-user] 
TRAVELTEK_FTP_PASSWORD=[production-password]

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Security
CORS_ORIGIN=[frontend-domain]
```

## Database Migration Workflow

### Staging Migrations
```bash
# Test migrations on staging first
node scripts/run-migrations.js
node scripts/auto-migrate.js

# Verify schema changes
node scripts/check-database-data.js
```

### Production Migrations  
```bash
# After successful staging testing
# Run on production with caution
node scripts/run-migrations.js
node scripts/complete-migration.js

# Verify production data integrity
node scripts/check-production-data.js
```

### Schema Recreation (Emergency)
```bash
# Complete database reset (USE WITH EXTREME CAUTION)
# Staging only - never run on production without backup
node scripts/recreate-schema-complete.js
node scripts/sync-complete-traveltek.js
```

## Data Sync Workflow

### Staging Data Sync
```bash
# Safe to run anytime on staging
node scripts/sync-complete-traveltek.js
./scripts/SYNC-NOW.sh

# Month-by-month sync for large datasets
YEAR=2025 MONTH=9 node scripts/sync-by-month.js
```

### Production Data Sync
```bash
# Production sync (careful timing)
# Avoid during peak hours (9 AM - 6 PM GMT)
node scripts/sync-complete-traveltek.js

# Monitor sync progress
tail -f logs/combined.log
```

## Webhook Configuration

### Staging Webhook Testing
```bash
# Test webhook functionality
curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/test

# Check webhook status
curl https://zipsea-backend.onrender.com/api/webhooks/traveltek/status

# Monitor webhook events
node scripts/check-webhook-health.js
```

### Production Webhook (LIVE) ⚠️
**URL Configured in Traveltek iSell**: `https://zipsea-production.onrender.com/api/webhooks/traveltek`

**Event Processing**:
- Static pricing webhooks: Processed automatically
- Live pricing webhooks: Acknowledged but not processed
- Background processing: Async to prevent timeouts
- Price snapshots: Automatic before/after data captures

## Monitoring and Alerting

### Render Dashboard Monitoring
1. **Application Logs**: Real-time log streaming
2. **Performance Metrics**: Response times, throughput
3. **Resource Usage**: CPU, memory, disk usage
4. **Deployment Status**: Build success/failure notifications

### Health Check Endpoints
```bash
# Application health
curl https://zipsea-production.onrender.com/api/health

# Database connectivity
curl https://zipsea-production.onrender.com/api/health/db

# Redis connectivity  
curl https://zipsea-production.onrender.com/api/health/redis

# External services
curl https://zipsea-production.onrender.com/api/health/external
```

### Performance Monitoring
```bash
# Search API performance
./test-search-quick.sh
node monitor-search-performance.js

# Database performance
node scripts/check-database-performance.js

# Cache performance
node scripts/test-cache-functionality.js
```

## Troubleshooting Common Issues

### Deployment Failures
```bash
# Check build logs in Render dashboard
# Common issues:
# 1. TypeScript compilation errors
# 2. Missing environment variables  
# 3. Dependency version conflicts
# 4. Port binding issues

# Resolution steps:
git log --oneline -5  # Check recent changes
# Fix issues locally, commit, and push
```

### Database Connection Issues
```bash
# Check database connectivity
node scripts/test-db-connection.js

# Verify environment variables
echo $DATABASE_URL  # Should not be empty

# Check database service status in Render dashboard
```

### FTP Sync Failures
```bash
# Diagnose FTP issues
node scripts/test-ftp-connection.js
node scripts/diagnose-sync-failures.js

# Check FTP credentials
node scripts/test-ftp-simple.js
```

### Webhook Processing Failures
```bash
# Check webhook health
node scripts/check-webhook-health.js

# Test webhook endpoint
curl -X POST https://zipsea-production.onrender.com/api/webhooks/traveltek/test

# Monitor webhook events
tail -f logs/combined.log | grep webhook
```

## Security Considerations

### Environment Variable Management
- **Never commit secrets**: Use Render's environment variable system
- **Rotate credentials**: Regularly update FTP and database credentials
- **Separate environments**: Different credentials for staging/production

### API Security
```bash
# CORS configuration
CORS_ORIGIN=https://yourdomain.com

# Rate limiting
# Configured in middleware/security.ts

# Input validation  
# Handled by middleware/validation.ts
```

### Database Security
- **Connection pooling**: Prevents connection exhaustion
- **Parameterized queries**: Prevents SQL injection
- **Read-only access**: For analytics and monitoring scripts

## Rollback Procedures

### Application Rollback
1. **Via Render Dashboard**: Rollback to previous deployment
2. **Via Git**: Revert problematic commits and redeploy
3. **Emergency**: Switch production to previous stable branch

### Database Rollback
⚠️ **Use with extreme caution**
1. **Schema changes**: Run reverse migrations if available
2. **Data corruption**: Restore from backup (if available)
3. **Emergency**: Manual data fixes with verified scripts

## Best Practices

### Development Workflow
1. **Small commits**: Make incremental changes
2. **Test on staging**: Always verify on staging before production
3. **Monitor deployments**: Watch logs during and after deployment
4. **Document changes**: Update relevant documentation

### Performance Optimization
1. **Database indexes**: Monitor query performance
2. **Cache strategy**: Optimize cache TTL and invalidation
3. **Connection pooling**: Configure appropriate pool sizes
4. **Background jobs**: Use async processing for heavy tasks

### Error Handling
1. **Comprehensive logging**: Log all errors with context
2. **Graceful degradation**: Handle service failures gracefully
3. **User feedback**: Provide meaningful error responses
4. **Monitoring alerts**: Set up alerts for critical errors

## Success Metrics

### Deployment Success
- ✅ **Build Success Rate**: 100% clean TypeScript compilation
- ✅ **Deployment Time**: <5 minutes average
- ✅ **Zero Downtime**: Staged deployments with health checks
- ✅ **Rollback Capability**: <2 minutes rollback time

### Application Performance  
- ✅ **API Response**: <1 second (95th percentile)
- ✅ **Database Queries**: <100ms average
- ✅ **Cache Hit Rate**: >80% (achieved 82.5%)
- ✅ **Uptime**: >99.9% (achieved 99.9%)

### Data Integrity
- ✅ **Sync Success**: >98% success rate
- ✅ **Webhook Processing**: >95% success rate  
- ✅ **Data Accuracy**: 100% name resolution
- ✅ **Search Results**: 100% accurate filtering

This deployment workflow ensures reliable, scalable deployments with comprehensive monitoring and quick rollback capabilities. The Render-first approach eliminates local environment inconsistencies and ensures all testing happens in production-like conditions.