# URGENT: Fix Redis Connection Issue in Production

## The Problem
Production backend is trying to connect to `localhost:6379` instead of the production Redis service.
This is because services are using `process.env.REDIS_URL` directly which returns `undefined`.

## The Solution
Replace `process.env.REDIS_URL` with `env.REDIS_URL` in all affected services.
The `env` module properly validates and loads environment variables.

## Quick Fix - Run This Command

```bash
cd backend
chmod +x fix-redis-urgent.sh
./fix-redis-urgent.sh
```

## OR Manual Fix - Edit These Files

### 1. webhook-processor-optimized-v2.service.ts
- **Line 19:** Add after the crypto import:
  ```typescript
  import { env } from '../config/environment';
  ```
- **Line 84:** Change:
  ```typescript
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  ```
  To:
  ```typescript
  const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
  ```
- **Lines 257-259 and 404-406:** Change FTP config from `process.env.TRAVELTEK_*` to `env.TRAVELTEK_*`

### 2. redis-maintenance.service.ts
- Add at top of file:
  ```typescript
  import { env } from '../config/environment';
  ```
- Replace ALL occurrences of `process.env.REDIS_URL` with `env.REDIS_URL`

### 3. webhook-processor-optimized.service.ts
- Add import near top
- Lines 47-48: Change `process.env.REDIS_URL` to `env.REDIS_URL`

### 4. webhook-processor-fixed.service.ts
- Add import near top
- Lines 49-50: Change `process.env.REDIS_URL` to `env.REDIS_URL`

### 5. webhook-processor-robust.service.ts
- Add import near top
- Lines 55-56: Change `process.env.REDIS_URL` to `env.REDIS_URL`

## Deploy the Fix

```bash
# 1. Build to verify no errors
npm run build

# 2. Commit the changes
git add -A
git commit -m "Fix Redis connection - use env module instead of process.env"

# 3. Push to main
git push origin main

# 4. Merge to production and push
git checkout production
git merge main
git push origin production
```

## Verify the Fix
After deployment (takes ~2-3 minutes on Render):
1. Check Render logs - should no longer see `ECONNREFUSED 127.0.0.1:6379`
2. Redis should connect to the proper production URL

## Why This Happened
This was likely changed for local testing (using `process.env` directly works locally) but wasn't reverted before deploying to production. The `env` module ensures environment variables are properly loaded and validated.