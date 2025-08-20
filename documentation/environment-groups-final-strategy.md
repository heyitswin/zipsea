# Final Environment Groups Strategy

## The Right Approach: Separate Secrets per Environment

Since API keys differ between staging and production (Clerk uses `sk_test_` vs `sk_live_`), we need separate secret groups:

## Recommended Structure

### 1. `zipsea-staging-secrets` (Create this now)
```bash
# Staging API Keys (test/sandbox versions)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
TRAVELTEK_FTP_USER=staging_username
TRAVELTEK_FTP_PASSWORD=staging_password
JWT_SECRET=<generate-random-for-staging>
WEBHOOK_SECRET=<generate-random-for-staging>

# Optional - staging versions
SENTRY_DSN=https://...@sentry.io/staging-project
RESEND_API_KEY=re_test_...
```

### 2. `zipsea-production-secrets` (Create later when ready)
```bash
# Production API Keys (live versions)
CLERK_SECRET_KEY=sk_live_...  # Different!
CLERK_PUBLISHABLE_KEY=pk_live_...  # Different!
TRAVELTEK_FTP_USER=production_username
TRAVELTEK_FTP_PASSWORD=production_password
JWT_SECRET=<different-random-for-production>
WEBHOOK_SECRET=<different-random-for-production>

# Optional - production versions
SENTRY_DSN=https://...@sentry.io/production-project
RESEND_API_KEY=re_live_...
```

### 3. `zipsea-shared-constants` (Optional - only if you have true constants)
```bash
# Only put things here that NEVER change between environments
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net  # Same host for both
# That might be the only one!
```

## Why Separate Secret Groups?

### Clerk Keys Are Different:
- **Staging**: `sk_test_...` and `pk_test_...`
- **Production**: `sk_live_...` and `pk_live_...`

### Other Services Too:
- **Stripe**: `sk_test_` vs `sk_live_`
- **Resend**: Test API keys vs Production keys
- **Sentry**: Different DSNs for different projects
- **Traveltek**: Might have sandbox credentials

### Security Benefits:
- Production secrets never touch staging
- Can restrict access to production group
- Easy to rotate staging without affecting production

## Implementation Plan

### For Staging (Do Now):

1. **Create `zipsea-staging-secrets` in Render Dashboard:**
   ```
   CLERK_SECRET_KEY = sk_test_ABC123...
   CLERK_PUBLISHABLE_KEY = pk_test_XYZ789...
   TRAVELTEK_FTP_USER = your_staging_user
   TRAVELTEK_FTP_PASSWORD = your_staging_pass
   JWT_SECRET = [move from service or generate new]
   WEBHOOK_SECRET = [move from service or generate new]
   ```

2. **Link to staging service:**
   - Go to `zipsea-backend` service
   - Settings → Linked Environment Groups
   - Add `zipsea-staging-secrets`

3. **Keep on service directly:**
   - NODE_ENV=staging
   - PORT, CORS_ORIGIN, LOG_LEVEL
   - Rate limiting settings
   - DATABASE_URL, REDIS_URL (auto-generated)

### For Production (Later):

1. **Create `zipsea-production-secrets` in Render:**
   ```
   CLERK_SECRET_KEY = sk_live_DEF456...  # Production key!
   CLERK_PUBLISHABLE_KEY = pk_live_UVW123...  # Production key!
   TRAVELTEK_FTP_USER = your_production_user
   TRAVELTEK_FTP_PASSWORD = your_production_pass
   JWT_SECRET = [different random value]
   WEBHOOK_SECRET = [different random value]
   ```

2. **Link to production service:**
   - `zipsea-backend-production` service
   - Link `zipsea-production-secrets` (NOT staging secrets!)

## Clean Up render.yaml

Since we're using Render Dashboard groups instead of the YAML-defined ones:

```yaml
# Remove this entire section from render.yaml:
envVarGroups:  # DELETE THIS
  - name: zipsea-staging-env  # DELETE THIS
  - name: zipsea-production-env  # DELETE THIS
  - name: zipsea-shared-env  # DELETE THIS
```

These were never actually used and just add confusion.

## Example: Clerk Setup

### Getting Your Keys:

1. **For Staging:**
   - Go to https://dashboard.clerk.com
   - Select/create your development instance
   - Copy the test keys (start with `_test_`)

2. **For Production:**
   - Create a production instance in Clerk
   - Get production keys (start with `_live_`)
   - These go in the production secrets group

## Summary

### The Simple Rule:
- **Different API keys per environment?** → Separate secret groups
- **Same value across environments?** → Could share (but rarely happens)
- **Config that changes per environment?** → Keep on service

### Your Setup:
1. `zipsea-staging-secrets` - Staging API keys (test keys)
2. `zipsea-production-secrets` - Production API keys (live keys)
3. Service-specific vars - Everything else stays on the service

This way:
- Staging never accidentally uses production keys
- Production never uses test keys
- Clear separation of environments
- Easy to manage and secure

## Quick Checklist

### Create `zipsea-staging-secrets` now with:
- [ ] CLERK_SECRET_KEY (sk_test_...)
- [ ] CLERK_PUBLISHABLE_KEY (pk_test_...)
- [ ] TRAVELTEK_FTP_USER
- [ ] TRAVELTEK_FTP_PASSWORD
- [ ] JWT_SECRET (move from service)
- [ ] WEBHOOK_SECRET (move from service)

### Later for production:
- [ ] Create `zipsea-production-secrets`
- [ ] Add production versions of all keys
- [ ] Link to production service only