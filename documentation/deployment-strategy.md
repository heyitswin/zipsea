# Zipsea Deployment Strategy

## Git Branching Strategy

### Branches
- **`main`** - Staging environment (auto-deploy enabled)
- **`production`** - Production environment (manual deploy or PR merge from main)

### Deployment Flow

```
Feature Branch → main (Staging) → production (Production)
```

1. **Development Work**
   - Create feature branches from `main`
   - Test locally with `NODE_ENV=staging`
   - Push to feature branch

2. **Staging Deployment**
   - Merge feature branch to `main`
   - Automatically deploys to staging environment on Render
   - Test at https://zipsea-backend.onrender.com

3. **Production Deployment**
   - After staging validation, create PR from `main` to `production`
   - Review and approve PR
   - Merge triggers production deployment
   - Production runs at separate URL with production resources

## Environment Configuration

### Staging (main branch)
- **Auto-deploy**: Yes
- **Database**: zipsea-postgres-staging (free tier)
- **Redis**: zipsea-redis-staging (free tier)
- **NODE_ENV**: staging
- **URL**: https://zipsea-backend.onrender.com

### Production (production branch)
- **Auto-deploy**: No (only on PR merge from main)
- **Database**: zipsea-postgres-production (paid tier)
- **Redis**: zipsea-redis-production (paid tier)
- **NODE_ENV**: production
- **URL**: https://api.zipsea.com (or similar)

## Setting Up the Branches

### 1. Create Production Branch
```bash
# Create production branch from current main
git checkout -b production
git push origin production
```

### 2. Update Render Configuration

In Render Dashboard:

#### For Staging Service (zipsea-backend):
- Branch: `main`
- Auto-deploy: `Enabled`
- Environment: `NODE_ENV=staging`

#### For Production Service (create new):
- Name: `zipsea-backend-production`
- Branch: `production`
- Auto-deploy: `Enabled` (but only triggers on production branch updates)
- Environment: `NODE_ENV=production`

### 3. Update render.yaml

The render.yaml should specify:
- Staging service uses `main` branch
- Production service uses `production` branch

## Deployment Commands

### Deploy to Staging
```bash
# Merge feature to main
git checkout main
git merge feature/your-feature
git push origin main
# Automatically deploys to staging
```

### Deploy to Production
```bash
# After staging is validated
git checkout production
git merge main
git push origin production
# Or create a PR from main to production in GitHub
```

## Rollback Strategy

### Staging Rollback
```bash
git checkout main
git revert HEAD
git push origin main
```

### Production Rollback
```bash
git checkout production
git revert HEAD
git push origin production
```

## Best Practices

1. **Never push directly to production branch**
   - Always go through main (staging) first
   - Use PRs for production deployments

2. **Test in staging before production**
   - Validate all features in staging
   - Run integration tests
   - Check logs and monitoring

3. **Use environment-specific configs**
   - Different API keys for staging/production
   - Different database connections
   - Different rate limits

4. **Monitor deployments**
   - Check Render dashboard during deployments
   - Monitor health endpoints after deployment
   - Check error tracking (Sentry)

## Emergency Hotfix Process

For critical production issues:

```bash
# Create hotfix from production
git checkout production
git checkout -b hotfix/critical-fix

# Make fix
# ...

# Deploy to staging first (if time permits)
git checkout main
git merge hotfix/critical-fix
git push origin main
# Test in staging

# Deploy to production
git checkout production
git merge hotfix/critical-fix
git push origin production

# Backport to main
git checkout main
git merge production
git push origin main
```