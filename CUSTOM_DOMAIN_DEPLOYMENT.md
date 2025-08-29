# Custom Domain Deployment Guide for zipsea.com

## Current Issues & Resolutions

### 1. ✅ API SSL Certificate Issue - RESOLVED
**Problem**: `api.zipsea.com` was having SSL handshake failures
**Solution**: Updated frontend to proxy API calls through the main domain using Next.js rewrites

### 2. ✅ Frontend API Configuration - RESOLVED  
**Problem**: Frontend was using localhost API URL in production
**Solution**: Configured API to use relative paths that proxy to backend through Next.js rewrites

### 3. ⚠️ Missing Images
**Status**: Images exist in `frontend/public/images/` folder
**Action Required**: Ensure Render deployment includes the public folder

### 4. ⚠️ Clerk Authentication 
**Problem**: `clerk.zipsea.com` subdomain not configured
**Solution**: Need to configure Clerk custom domain or use Clerk's hosted domain

## Deployment Configuration

### Frontend (zipsea-frontend-production)

#### Environment Variables Required:
```bash
# Backend URL for API proxy (already set via rewrites)
BACKEND_URL=https://zipsea-production.onrender.com

# Clerk Authentication (if using custom domain)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Optional: Override API URL
NEXT_PUBLIC_API_URL=/api/v1  # Use relative path
```

#### DNS Configuration:
- `zipsea.com` → CNAME → `zipsea-frontend-production.onrender.com`
- `www.zipsea.com` → CNAME → `zipsea-frontend-production.onrender.com`

### Backend (zipsea-production)

#### CORS Configuration:
The backend is already configured to accept requests from:
- `https://zipsea.com`
- `https://www.zipsea.com`
- `https://zipsea-frontend-production.onrender.com`

#### Environment Variables:
Ensure these are set in Render:
```bash
NODE_ENV=production
CORS_ORIGIN=https://zipsea.com,https://www.zipsea.com
```

## API Endpoint Changes

### Old Configuration:
- Frontend tried to call `https://api.zipsea.com/api/v1/*`
- This failed due to SSL certificate issues

### New Configuration:
- Frontend calls `/api/v1/*` (relative path)
- Next.js rewrites proxy these to `https://zipsea-production.onrender.com/api/v1/*`
- No SSL issues, no CORS issues

## Testing After Deployment

1. **Check API Health**:
   ```bash
   curl https://www.zipsea.com/api/v1/health
   ```

2. **Check Direct Backend**:
   ```bash
   curl https://zipsea-production.onrender.com/health
   ```

3. **Verify Images Load**:
   - Visit https://www.zipsea.com
   - Check browser console for 404 errors
   - Images should load from `/images/*` path

4. **Test API Calls**:
   - Open browser DevTools Network tab
   - Navigate the site
   - API calls should go to `/api/v1/*` and return 200 status

## Troubleshooting

### If API calls fail:
1. Check Render logs for CORS errors
2. Verify `BACKEND_URL` environment variable is set correctly
3. Ensure backend is running and healthy

### If images don't load:
1. Check if public folder was deployed
2. Verify image paths in the code match file structure
3. Check Render build logs for any asset processing errors

### If Clerk authentication fails:
1. Either configure custom domain in Clerk dashboard
2. Or use Clerk's default domain (e.g., `your-app.clerk.accounts.dev`)
3. Update environment variables accordingly

## Next Steps

1. **Monitor Deployment**: Watch Render dashboard for build completion
2. **Test All Features**: Once deployed, test search, API calls, and images
3. **Configure Clerk**: Set up proper authentication domain
4. **SSL Monitoring**: Ensure all resources load over HTTPS

## Important Notes

- The `api.zipsea.com` subdomain is no longer needed
- All API traffic now goes through the main domain
- This approach avoids SSL certificate complications
- Backend remains on Render's domain but is proxied through frontend