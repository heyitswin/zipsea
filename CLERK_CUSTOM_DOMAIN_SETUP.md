# Clerk Custom Domain Setup for clerk.zipsea.com

## Current Issue
The subdomain `clerk.zipsea.com` is configured but doesn't have an SSL certificate, causing the error:
```
net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH
```

## Solution Steps

### 1. Set Up DNS Records

Add the following CNAME record in your DNS provider (Cloudflare/Namecheap/etc):

```
Type: CNAME
Name: clerk
Value: frontend.clerk.services
TTL: Auto
Proxy: Disabled (if using Cloudflare, set to DNS only - gray cloud)
```

### 2. Configure Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Domains** or **Production** settings
3. Add custom domain: `clerk.zipsea.com`
4. Follow Clerk's verification process
5. Wait for SSL certificate provisioning (usually takes 10-30 minutes)

### 3. Update Environment Variables on Render

For the **frontend** service, ensure these environment variables are set:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_KEY_HERE
CLERK_SECRET_KEY=sk_live_YOUR_ACTUAL_SECRET_HERE

# Optional: Explicitly set the domain
NEXT_PUBLIC_CLERK_DOMAIN=clerk.zipsea.com
```

### 4. Verify SSL Certificate

Once DNS propagates and Clerk provisions the certificate, test:

```bash
# Check SSL certificate
curl -I https://clerk.zipsea.com

# Should return 200 OK or redirect
```

## Alternative: Use Clerk's Default Domain

If you prefer not to set up a custom domain, you can use Clerk's default domain:

1. Remove the custom domain configuration from Clerk dashboard
2. Update environment variables:

```bash
# Remove or comment out
# NEXT_PUBLIC_CLERK_DOMAIN=

# Clerk will use its default domain like:
# your-app.clerk.accounts.dev
```

3. Update ClerkProviderWrapper.tsx:

```typescript
// Remove the domain prop or set it to undefined
<ClerkProvider 
  publishableKey={publishableKey}
  // domain={domain} // Remove this line
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  afterSignInUrl="/"
  afterSignUpUrl="/"
>
```

## Testing

After setup is complete:

1. Clear browser cache
2. Visit https://www.zipsea.com
3. Check browser console - no SSL errors should appear
4. Test sign-in/sign-up functionality

## Troubleshooting

### SSL Still Not Working?

1. **Check DNS propagation**: Use [whatsmydns.net](https://www.whatsmydns.net) to verify CNAME is propagated
2. **Verify in Clerk Dashboard**: Ensure domain shows as "verified" and "SSL active"
3. **Clear Cloudflare cache**: If using Cloudflare, purge cache for the domain
4. **Wait longer**: SSL provisioning can sometimes take up to 1 hour

### Fallback Option

If urgent, temporarily disable Clerk by clearing the environment variables:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

The app will continue to work without authentication features.