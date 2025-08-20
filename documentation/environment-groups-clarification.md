# Environment Groups Clarification

## Current Situation
The render.yaml defines 3 environment groups that **are NOT currently being used** by any service. They were planned but never linked.

## Original Intent of Each Group

### 1. `zipsea-shared-env` 
**Purpose**: Variables that NEVER change between staging and production
```yaml
# Constants across all environments
API_PREFIX=/api
API_VERSION=v1
PORT=10000
RATE_LIMIT_WINDOW_MS=900000
TRAVELTEK_API_URL=https://api.traveltek.net  # Same endpoint for all
```

### 2. `zipsea-staging-env`
**Purpose**: Staging-specific configuration values
```yaml
NODE_ENV=staging
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://zipsea-staging-frontend.onrender.com,http://localhost:3000
```

### 3. `zipsea-production-env`
**Purpose**: Production-specific configuration values
```yaml
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_MAX_REQUESTS=200
CORS_ORIGIN=https://zipsea.com
```

## The Problem
These groups were defined but the service doesn't reference them! The service currently has all variables defined directly on it.

## Recommended New Structure

Instead of the current unused structure, here's what we should actually do:

### Option 1: Keep It Simple (Recommended)
Delete the unused groups and create just ONE group for secrets:

**`zipsea-staging-secrets`** (New group to create)
```yaml
# API Keys & Secrets
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
TRAVELTEK_FTP_USER=...
TRAVELTEK_FTP_PASSWORD=...
JWT_SECRET=...
WEBHOOK_SECRET=...
SENTRY_DSN=...
RESEND_API_KEY=...
```

Keep everything else on the service directly (as it is now).

### Option 2: Use the Original Structure
Link the existing groups to your service:

1. **Link all 3 groups** to staging service:
   - `zipsea-shared-env` (shared constants)
   - `zipsea-staging-env` (staging config)
   - `zipsea-staging-secrets` (create new for secrets)

2. **For production** (later):
   - `zipsea-shared-env` (same shared constants)
   - `zipsea-production-env` (production config)
   - `zipsea-production-secrets` (create new for secrets)

## Current Reality vs Plan

### What Was Planned:
```yaml
services:
  - type: web
    name: zipsea-backend
    envVarGroups:  # <-- This is MISSING
      - zipsea-shared-env
      - zipsea-staging-env
    envVars:
      # Service-specific vars...
```

### What Actually Exists:
```yaml
services:
  - type: web
    name: zipsea-backend
    # No envVarGroups linked!
    envVars:
      # Everything is defined here directly
      - key: NODE_ENV
        value: staging
      - key: PORT
        value: 10000
      # ... etc
```

## Recommended Action

### Step 1: Decide on Structure
Since the groups aren't being used, I recommend:
1. **Delete** the unused group definitions from render.yaml
2. **Create** one new group `zipsea-staging-secrets` in Render Dashboard
3. **Keep** the current setup where config is on the service

### Step 2: Create the Secrets Group
In Render Dashboard:
1. Create `zipsea-staging-secrets` group
2. Add your API keys there
3. Link it to your service

### Step 3: Clean Up render.yaml
Remove the unused `envVarGroups` section since it's not doing anything.

## Why This Happened
The render.yaml was set up with a theoretical structure but:
1. The groups were never created in Render
2. The services don't reference them
3. All variables are directly on the service instead

## Summary

**Current State**: 
- 3 groups defined in YAML but not used
- All env vars are directly on the service
- It's working but not organized

**Recommended State**:
- 1 secrets group for API keys (create in Render Dashboard)
- Keep config on service (already working)
- Delete unused group definitions from render.yaml

This is simpler and matches what's actually deployed!