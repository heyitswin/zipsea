# Zipsea Deployment Reference Guide

## Quick Reference

### Deployment Flow
```
Feature Branch → Main Branch (Auto-Deploy to Staging) → Production Branch (Auto-Deploy to Production)
```

### Service URLs
- **Staging API**: https://zipsea-backend.onrender.com
- **Production API**: https://zipsea-production.onrender.com
- **Health Check**: `GET /health` on either service

### Branch Strategy
- **Feature branches**: Development work, no auto-deploy
- **Main branch**: Auto-deploys to staging environment
- **Production branch**: Auto-deploys to production environment

## Common Deployment Tasks

### 1. Deploy to Staging
```bash
# From your feature branch
git checkout main
git merge your-feature-branch
git push origin main
# Auto-deploys to zipsea-backend service
```

### 2. Deploy to Production
```bash
# After staging testing is complete
git checkout production
git merge main
git push origin production
# Auto-deploys to zipsea-production service
```

### 3. Force Redeploy
- Go to Render Dashboard
- Select the service (zipsea-backend or zipsea-production)
- Click "Manual Deploy" → "Clear cache and deploy"

### 4. Check Deployment Status
```bash
# Check staging health
curl https://zipsea-backend.onrender.com/health

# Check production health
curl https://zipsea-production.onrender.com/health
```

### 5. View Logs
- Render Dashboard → Service → Logs tab
- Or use Render CLI: `render logs service-name`

## Environment Variables Management

### Required for All Environments
- `NODE_ENV` (staging/production)
- `PORT` (10000)
- `DATABASE_URL` (auto-configured)
- `REDIS_URL` (auto-configured)

### Manual Configuration Required
Access Render Dashboard → Service → Environment → Add Environment Variable:

```bash
# Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Monitoring (Optional)
SENTRY_DSN=https://...@sentry.io/...

# Data Integration
TRAVELTEK_FTP_HOST=ftp.example.com
TRAVELTEK_FTP_USER=username
TRAVELTEK_FTP_PASSWORD=password
```

### Environment-Specific Variables

#### Staging
```bash
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=100
```

#### Production
```bash
CORS_ORIGIN=https://zipsea.com
LOG_LEVEL=warn
RATE_LIMIT_MAX_REQUESTS=200
```

## Troubleshooting Guide

### Common Issues

#### 1. SENTRY_DSN Validation Error
**Error**: `Invalid environment variables: SENTRY_DSN: Invalid url`

**Solution**: 
- Either provide a valid Sentry DSN URL
- Or leave SENTRY_DSN unset (it's optional)
- Recent fix: Code now handles empty string values properly

#### 2. Database Connection Error
**Error**: `Error: connect ECONNREFUSED` or `database connection failed`

**Causes**:
- Database service is down
- DATABASE_URL is incorrect
- Database is at connection limit

**Solution**:
```bash
# Check database service status in Render Dashboard
# Verify DATABASE_URL is configured correctly
# For free tier: Check if database auto-paused after inactivity
```

#### 3. Redis Connection Error
**Error**: `Redis connection failed` or `ECONNREFUSED redis`

**Causes**:
- Redis service is down
- REDIS_URL is incorrect
- Redis memory limit exceeded

**Solution**:
```bash
# Check Redis service status in Render Dashboard
# Verify REDIS_URL is configured correctly
# Check Redis memory usage and eviction policy
```

#### 4. Build Failures
**Error**: `Build failed` or `npm install failed`

**Common Causes**:
- package.json dependencies conflicts
- Node.js version mismatch
- Build command not found

**Solution**:
```bash
# Check build logs in Render Dashboard
# Verify package-lock.json is committed
# Check Node.js version in package.json engines field
```

#### 5. Service Won't Start
**Error**: `Service failed to start` or `Process exited`

**Debugging Steps**:
1. Check service logs for specific error messages
2. Verify all required environment variables are set
3. Test locally if possible
4. Check if start command is correct

#### 6. Health Check Failures
**Error**: `Health check timeout` or `502 Bad Gateway`

**Solution**:
```bash
# Verify /health endpoint responds correctly
# Check if service is binding to correct port (10000)
# Ensure health check path is /health
```

### Advanced Troubleshooting

#### Database Issues
```bash
# Check database logs
# Look for connection pool exhaustion
# Verify SSL configuration
# Check for long-running queries blocking connections
```

#### Performance Issues
```bash
# Check CPU and memory usage in Render Dashboard
# Look for memory leaks in Node.js application
# Monitor Redis hit rates
# Check for N+1 query problems
```

#### CORS Issues
```bash
# Verify CORS_ORIGIN is set correctly
# For staging: http://localhost:3000
# For production: https://zipsea.com
# Check browser network tab for CORS errors
```

## Deployment Best Practices

### Pre-Deployment Checklist
- [ ] All tests pass locally
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Breaking changes documented
- [ ] Feature flags configured if needed

### Staging Deployment
- [ ] Deploy to staging first
- [ ] Test all critical user flows
- [ ] Check health endpoint
- [ ] Verify database connectivity
- [ ] Test external integrations (Traveltek, Clerk)

### Production Deployment
- [ ] Staging testing complete
- [ ] Backup plan ready
- [ ] Monitor deployment logs
- [ ] Verify health checks pass
- [ ] Test critical functionality immediately
- [ ] Monitor error rates and performance

### Post-Deployment
- [ ] Check application logs for errors
- [ ] Monitor response times
- [ ] Verify external service connectivity
- [ ] Check database performance
- [ ] Update deployment documentation

## Rollback Procedures

### Quick Rollback (Last Working Commit)
```bash
# Go to Render Dashboard
# Service → Deploys tab
# Click "Redeploy" on last successful deployment
```

### Git-Based Rollback
```bash
# For production rollback
git checkout production
git reset --hard <last-good-commit>
git push --force-with-lease origin production

# For staging rollback
git checkout main
git reset --hard <last-good-commit>
git push --force-with-lease origin main
```

### Emergency Procedures
1. **Service Down**: Use Render Dashboard to redeploy last working version
2. **Database Issues**: Check connection limits, restart if necessary
3. **External Service Failures**: Check Traveltek/Clerk status pages
4. **Performance Issues**: Monitor CPU/memory, scale up if needed

## Monitoring and Alerts

### Health Monitoring
```bash
# Set up external monitoring for:
GET https://zipsea-backend.onrender.com/health    # Staging
GET https://zipsea-production.onrender.com/health # Production
```

### Key Metrics to Monitor
- Response time (< 2s for API calls)
- Error rate (< 1% for 5xx errors)
- CPU usage (< 80% average)
- Memory usage (< 80% of allocated)
- Database connections (< 80% of pool)

### Log Monitoring
```bash
# Key log patterns to alert on:
ERROR   # Application errors
WARN    # Warning conditions
"connection refused"   # Service connectivity issues
"timeout"             # Performance issues
"validation failed"   # Input validation problems
```

## Performance Optimization

### Database Optimization
- Use connection pooling (configured in environment.ts)
- Implement query caching with Redis
- Monitor slow queries
- Use database indexes appropriately

### Caching Strategy
- Search results: 1 hour TTL
- Cruise details: 6 hours TTL
- Pricing data: 15 minutes TTL
- Use Redis for session storage

### Rate Limiting
- Staging: 100 requests per 15 minutes per IP
- Production: 200 requests per 15 minutes per IP
- Adjust based on actual usage patterns

## Security Checklist

### Environment Security
- [ ] All secrets use Render's auto-generation or secure storage
- [ ] No hardcoded credentials in code
- [ ] HTTPS enforced for all production traffic
- [ ] CORS properly configured for each environment

### Database Security
- [ ] SSL connections enabled
- [ ] Connection limits configured
- [ ] Regular security updates
- [ ] No direct database access from outside services

### API Security
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Proper error handling (no sensitive data in errors)
- [ ] Authentication required for protected endpoints

## Contact Information

### Support Escalation
1. **First**: Check this troubleshooting guide
2. **Second**: Review Render service logs
3. **Third**: Check external service status pages (Clerk, Sentry, Traveltek)
4. **Last Resort**: Contact Render support

### Service Status Pages
- **Render**: https://status.render.com/
- **Clerk**: https://status.clerk.com/
- **Sentry**: https://status.sentry.io/

---

**Last Updated**: August 2025
**Version**: 1.0