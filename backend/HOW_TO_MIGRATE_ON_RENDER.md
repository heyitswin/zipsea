# How to Run Database Migrations on Render

Since we don't test locally and only on staging/production, here's how to run migrations on Render:

## Option 1: Using Render Shell (Recommended)

### For Staging:
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on `zipsea-backend-staging` service
3. Click on "Shell" tab in the left sidebar
4. Run these commands:
```bash
cd backend
npm run db:migrate
```

### For Production:
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on `zipsea-backend-production` service  
3. Click on "Shell" tab in the left sidebar
4. Run these commands:
```bash
cd backend
npm run db:migrate
```

## Option 2: Create a Migration Endpoint (Alternative)

We can create a temporary admin endpoint to run migrations:

### Add to admin.routes.ts:
```typescript
// TEMPORARY - Remove after migration
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const { exec } = require('child_process');
    exec('npm run db:migrate', (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, output: stdout });
    });
  } catch (error) {
    res.status(500).json({ error: 'Migration failed' });
  }
});
```

Then trigger it:
```bash
curl -X POST https://zipsea-backend.onrender.com/api/v1/admin/migrate
```

## Option 3: Use Build Command (For New Deployments)

Update your `render.yaml` to run migrations during build:
```yaml
buildCommand: npm install && npm run db:migrate && npm run build
```

⚠️ **Note**: This runs migrations on every deployment, which might not be ideal.

## Option 4: Manual SQL Execution

If migrations fail, you can run the SQL manually:

1. Go to Render Dashboard
2. Click on your PostgreSQL database (`zipsea-postgres-staging` or `zipsea-postgres-production`)
3. Click on "PSQL Command" or use the connection string
4. Copy the SQL from `/backend/src/db/migrations/0001_messy_banshee.sql`
5. Execute it directly

## Current Migration Needed

The price history system requires these new tables:
- `price_history` - Stores historical price snapshots
- `price_trends` - Stores aggregated trend data
- Various indexes for performance

## Verification

After running migrations, verify they worked:

### Check if tables exist:
```bash
curl https://zipsea-backend.onrender.com/api/v1/price-history
```

Should return an empty array `[]` if tables were created successfully.

### Check the logs:
Look for any migration errors in the Render logs.

## Rollback (If Needed)

To rollback migrations:
1. Access Render Shell
2. Run: `npm run db:drop` (be careful!)
3. Or manually drop the new tables via PSQL

## For This Specific Migration

Since we just added the price history system:

1. **Wait for deployment** (2-3 minutes for Render to build and deploy)
2. **Access Render Shell** for staging
3. **Run migration**:
```bash
cd backend
npm run db:migrate
```
4. **Verify** by checking the new endpoint:
```bash
curl https://zipsea-backend.onrender.com/api/v1/price-history
```
5. **Repeat for production** when ready

## Important Notes

- Always run migrations on **staging first**
- Check logs for any errors
- The price history system will automatically start capturing snapshots after migration
- No data loss - this only adds new tables
- The system is backward compatible

## Troubleshooting

If migration fails:
1. Check Render logs for database connection issues
2. Ensure DATABASE_URL is set correctly
3. Check if database has sufficient permissions
4. Try running the SQL directly via PSQL if needed

The migration is safe and only adds new tables without affecting existing data.