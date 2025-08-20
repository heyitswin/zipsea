# Zipsea Render Services Overview

## Current Service Architecture

### Active Services (In Use)

#### Database Services
- **zipsea-postgres-staging** (PostgreSQL - Free Plan)
  - Purpose: Staging environment database
  - Database: `zipsea_staging_db`
  - User: `zipsea_staging_user`
  - Region: Oregon
  - Status: ✅ Active and in use

#### Cache Services
- **zipsea-redis-staging** (Valkey 8 - Free Plan)
  - Purpose: Staging environment Redis cache
  - Region: Oregon
  - MaxMemory Policy: allkeys-lru
  - Status: ✅ Active and in use

#### Application Services
- **zipsea-backend** (Node.js - Starter Plan)
  - Purpose: Main staging API service
  - Branch: `main` (auto-deploy enabled)
  - Environment: staging
  - Build: `cd backend && npm ci && npm run build`
  - Start: `cd backend && npm start`
  - Health Check: `/health`
  - Status: ✅ Active and in use

- **zipsea-production** (Node.js)
  - Purpose: Production API service
  - Branch: `production`
  - Environment: production
  - Status: ❌ Currently failing (SENTRY_DSN validation error)
  - Note: This service was manually created and may not follow the render.yaml config

### Legacy/Unused Services (Cleanup Candidates)

#### Database Services
- **zipsea-postgres** (PostgreSQL)
  - Status: 🟡 Legacy/Unused
  - Recommendation: Can be safely deleted if confirmed unused
  - Action: Verify no connections exist, then remove

#### Cache Services
- **zipsea-redis** (Valkey 8)
  - Status: 🟡 Legacy/Unused
  - Recommendation: Can be safely deleted if confirmed unused
  - Action: Verify no connections exist, then remove

#### Application Services
- **zipsea-staging** (Node.js)
  - Status: 🟡 Legacy/Duplicate
  - Recommendation: Remove this duplicate staging service
  - Note: `zipsea-backend` is the primary staging service

## Deployment Strategy

### Development Workflow
```
Feature Branches → Main Branch (Staging) → Production Branch (Production)
```

### Key Principles
1. **No Local Testing**: All testing happens in staging environment
2. **Staging-First**: Main branch auto-deploys to staging for testing
3. **Production Gate**: Only production branch deploys to production
4. **Auto-Deploy**: Both staging and production use auto-deployment

### Branch Configuration
- **Main Branch**: Auto-deploys to `zipsea-backend` (staging)
- **Production Branch**: Should auto-deploy to production service

## Environment Configuration

### Staging Environment (`zipsea-backend`)
```yaml
NODE_ENV: staging
PORT: 10000
DATABASE_URL: [from zipsea-postgres-staging]
REDIS_URL: [from zipsea-redis-staging]
CORS_ORIGIN: http://localhost:3000
LOG_LEVEL: info
RATE_LIMIT_WINDOW_MS: 900000
RATE_LIMIT_MAX_REQUESTS: 100
JWT_SECRET: [auto-generated]
WEBHOOK_SECRET: [auto-generated]
```

**Manual Environment Variables** (set in Render Dashboard):
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `SENTRY_DSN` (optional)
- `TRAVELTEK_FTP_HOST`
- `TRAVELTEK_FTP_USER`
- `TRAVELTEK_FTP_PASSWORD`

### Production Environment (Target Configuration)
```yaml
NODE_ENV: production
PORT: 10000
DATABASE_URL: [from zipsea-postgres-production]
REDIS_URL: [from zipsea-redis-production]
CORS_ORIGIN: https://zipsea.com
LOG_LEVEL: warn
RATE_LIMIT_WINDOW_MS: 900000
RATE_LIMIT_MAX_REQUESTS: 200
JWT_SECRET: [auto-generated]
WEBHOOK_SECRET: [auto-generated]
```

## Render.yaml vs Actual Services

### Defined in render.yaml
- Staging: `zipsea-backend` ✅ (matches actual)
- Production: `zipsea-backend-production` ❌ (commented out, not created)

### Actual Services in Render
- Staging: `zipsea-backend` ✅
- Production: `zipsea-production` ❌ (manually created, doesn't match yaml)

### Discrepancy Issue
The production service `zipsea-production` was manually created and doesn't follow the render.yaml configuration. This explains the current production deployment failures.

## Service Health Status

| Service | Type | Plan | Status | Issues |
|---------|------|------|--------|---------|
| zipsea-postgres-staging | Database | Free | ✅ Healthy | None |
| zipsea-redis-staging | Cache | Free | ✅ Healthy | None |
| zipsea-backend | API | Starter | ✅ Healthy | None |
| zipsea-production | API | Unknown | ❌ Failing | SENTRY_DSN validation |
| zipsea-postgres | Database | Unknown | 🟡 Unused | Legacy service |
| zipsea-redis | Cache | Unknown | 🟡 Unused | Legacy service |
| zipsea-staging | API | Unknown | 🟡 Unused | Duplicate service |

## Recommended Actions

### Immediate Fixes
1. **Fix Production Deployment**: SENTRY_DSN validation error has been resolved in code
2. **Verify Environment Variables**: Ensure all required production env vars are set
3. **Test Production Deploy**: Trigger a production deployment after fixes

### Service Cleanup
1. **Delete Legacy Services**:
   - `zipsea-postgres` (if confirmed unused)
   - `zipsea-redis` (if confirmed unused) 
   - `zipsea-staging` (duplicate)

2. **Align Production Service**:
   - Consider renaming `zipsea-production` to `zipsea-backend-production`
   - Or update render.yaml to match current service name

### Infrastructure Improvements
1. **Enable Production Infrastructure**:
   - Uncomment production database in render.yaml
   - Uncomment production Redis in render.yaml
   - Create proper production service following yaml config

2. **Implement Proper Plans**:
   - Upgrade production database to Starter plan
   - Upgrade production Redis to Starter plan
   - Upgrade production API to Standard plan

## Cost Optimization

### Current Costs
- Free tier services: $0/month
- Starter plan services: ~$7/month per service
- Standard plan services: ~$25/month per service

### Optimization Opportunities
1. Remove unused legacy services
2. Right-size production plans based on actual usage
3. Consider consolidating Redis instances if traffic is low

## Security Considerations

### Environment Variables
- All secrets use Render's auto-generation where possible
- Manual secrets should be rotated regularly
- SENTRY_DSN is now properly optional

### Network Security
- All services use IP allow lists (currently empty - all IPs allowed)
- Consider restricting access for production services
- Redis instances use LRU eviction policy

### SSL/TLS
- All services in Oregon region
- SSL termination handled by Render
- Database connections use SSL in staging/production

## Monitoring and Alerting

### Health Checks
- All API services use `/health` endpoint
- Database connectivity verified on startup
- Redis connectivity verified on startup

### Logging
- Staging: `info` level logging
- Production: `warn` level logging (reduces noise)
- All logs available in Render dashboard

### Missing Monitoring
- No external uptime monitoring configured
- No performance metrics dashboard
- No automated alerting for service failures

## Next Steps

1. Deploy fixed code to resolve SENTRY_DSN error
2. Verify production service functionality
3. Clean up legacy/unused services
4. Implement production infrastructure per render.yaml
5. Set up proper monitoring and alerting
6. Document environment variable management process