# Shared vs Environment-Specific Variables

## Actually Shared (Same Value for Both Staging & Production)

Very few things are truly shared:

```bash
# Maybe shared (if using same FTP server)
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net

# That's probably it!
```

## Everything Else is Environment-Specific

### Different API Keys per Environment:
```bash
# Staging                          # Production
CLERK_SECRET_KEY=sk_test_...      CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_test_... CLERK_PUBLISHABLE_KEY=pk_live_...
SENTRY_DSN=staging_project_dsn    SENTRY_DSN=production_project_dsn
RESEND_API_KEY=re_test_...        RESEND_API_KEY=re_live_...
```

### Different Secrets per Environment:
```bash
# Staging                          # Production
JWT_SECRET=staging_secret_123     JWT_SECRET=production_secret_456
WEBHOOK_SECRET=staging_webhook     WEBHOOK_SECRET=production_webhook
TRAVELTEK_FTP_USER=staging_user   TRAVELTEK_FTP_USER=production_user
TRAVELTEK_FTP_PASSWORD=stage_pw   TRAVELTEK_FTP_PASSWORD=prod_pw
```

### Different Config per Environment:
```bash
# Staging                          # Production
NODE_ENV=staging                  NODE_ENV=production
LOG_LEVEL=info                    LOG_LEVEL=warn
CORS_ORIGIN=localhost:3000        CORS_ORIGIN=https://zipsea.com
RATE_LIMIT_MAX_REQUESTS=100       RATE_LIMIT_MAX_REQUESTS=200
```

### Auto-Generated (Different Instances):
```bash
# Staging                          # Production
DATABASE_URL=staging_db_url       DATABASE_URL=production_db_url
REDIS_URL=staging_redis_url       REDIS_URL=production_redis_url
```

## The Verdict: Almost Nothing is Shared!

Since only `TRAVELTEK_FTP_HOST` might be shared, here's the simplest approach:

## Recommended Final Setup

### Option 1: No Shared Group (Simplest) ✅

**Just put EVERYTHING on the services directly:**

#### On `zipsea-backend` (staging):
```yaml
envVars:
  # All staging values
  - key: NODE_ENV
    value: staging
  - key: CLERK_SECRET_KEY
    value: sk_test_...
  - key: CLERK_PUBLISHABLE_KEY
    value: pk_test_...
  - key: TRAVELTEK_FTP_HOST
    value: ftpeu1prod.traveltek.net
  # ... etc
```

#### On `zipsea-backend-production`:
```yaml
envVars:
  # All production values
  - key: NODE_ENV
    value: production
  - key: CLERK_SECRET_KEY
    value: sk_live_...
  - key: CLERK_PUBLISHABLE_KEY
    value: pk_live_...
  - key: TRAVELTEK_FTP_HOST
    value: ftpeu1prod.traveltek.net
  # ... etc
```

### Option 2: Separate Secrets Only (Slightly Better) ⭐

**Create groups just for sensitive data:**

#### `zipsea-staging-secrets` group:
```bash
# Sensitive staging credentials only
CLERK_SECRET_KEY=sk_test_...
TRAVELTEK_FTP_PASSWORD=staging_password
JWT_SECRET=staging_secret
WEBHOOK_SECRET=staging_webhook
```

#### On staging service directly:
```bash
# Non-sensitive staging config
NODE_ENV=staging
CLERK_PUBLISHABLE_KEY=pk_test_...  # Public key, not sensitive
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=staging_user
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
# ... etc
```

## Why Option 2 is Slightly Better

1. **Security**: Sensitive keys are in a group with restricted access
2. **Rotation**: Easy to rotate secrets without touching config
3. **Clarity**: Clear separation between secrets and config
4. **But**: Still simple - only 2 groups total (staging & production secrets)

## Final Recommendation

Since almost nothing is truly shared:

1. **Delete the concept of "shared" env group** - it's not worth it for one variable
2. **Create `zipsea-staging-secrets`** - for sensitive staging credentials
3. **Create `zipsea-production-secrets`** - for sensitive production credentials
4. **Put everything else directly on each service** - it's clearer this way

## The Simple Truth

```
Shared values across environments: ~1-2 variables
Environment-specific values: ~20+ variables

Conclusion: Don't optimize for sharing!
```

Just duplicate that one `TRAVELTEK_FTP_HOST` in both places and keep it simple!