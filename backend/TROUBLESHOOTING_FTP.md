# Troubleshooting Traveltek FTP Sync

## Current Status
- ✅ Webhook endpoints working
- ✅ Database tables created
- ✅ Sync triggered successfully
- ❌ No data appearing in database

## How to Check Render Logs

### 1. Access Render Dashboard
1. Go to https://dashboard.render.com
2. Click on `zipsea-backend-production` service
3. Go to "Logs" tab

### 2. Search for Key Log Messages

Look for these patterns in the logs:

#### FTP Connection Issues:
```
"FTP connection error"
"Failed to initiate FTP connection"
"Connected to Traveltek FTP server"
```

#### Sync Process:
```
"🔄 Manually triggering recent data sync"
"Starting hourly recent data sync"
"Syncing cruise data file"
```

#### Errors:
```
"error"
"Error"
"failed"
"Failed"
```

## Common FTP Issues and Solutions

### 1. Authentication Failed
**Log Message:** `530 Login authentication failed`
**Solution:** Verify credentials in Render environment:
- `TRAVELTEK_FTP_USER`
- `TRAVELTEK_FTP_PASSWORD`

### 2. Connection Timeout
**Log Message:** `Error: Timeout while connecting`
**Solution:** FTP server might be blocking the connection. Contact Traveltek.

### 3. No Files Found
**Log Message:** `No cruise files found in directory`
**Solution:** The FTP directory structure might be different or empty.

### 4. Environment Variables Not Set
**Log Message:** `FTP credentials not found`
**Solution:** Ensure environment variables are set in Render:
1. Go to service settings
2. Check Environment tab
3. Verify TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD exist

## Manual Verification Steps

### Step 1: Check if credentials are configured
```bash
curl https://zipsea-production.onrender.com/health/detailed
```
Look for healthy database and redis connections.

### Step 2: Trigger a sync
```bash
curl -X POST https://zipsea-production.onrender.com/api/v1/admin/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"type": "recent"}'
```

### Step 3: Wait 30 seconds and check for data
```bash
curl -X POST https://zipsea-production.onrender.com/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"limit": 1}'
```

### Step 4: Check cron job status
```bash
curl https://zipsea-production.onrender.com/api/v1/admin/cron/status
```

## What the Sync Process Does

1. **Connect to FTP**: ftpeu1prod.traveltek.net
2. **Navigate to**: /[year]/[month]/
3. **List cruise lines**: Each directory is a line ID
4. **List ships**: Each subdirectory is a ship ID
5. **Download JSON files**: Each .json file contains cruise data
6. **Process and store**: Parse JSON and save to database

## Expected FTP Directory Structure
```
/
├── 2025/
│   ├── 08/        # August 2025
│   │   ├── 7/     # Royal Caribbean (line ID)
│   │   │   ├── 231/  # Ship ID
│   │   │   │   ├── 8734921.json  # Cruise file
│   │   │   │   ├── 8734922.json
│   │   │   │   └── ...
```

## If No Data After Sync

1. **Check Render Logs**: Most important - will show exact error
2. **Verify Credentials**: Double-check with Traveltek
3. **Contact Traveltek**: Ask if:
   - Credentials are active
   - IP needs whitelisting
   - Data is available for your market
4. **Try Different Sync Type**:
   ```bash
   # Try weekly sync (more comprehensive)
   curl -X POST https://zipsea-production.onrender.com/api/v1/admin/sync/trigger \
     -H "Content-Type: application/json" \
     -d '{"type": "weekly"}'
   ```

## Test with Minimal Data

If sync continues to fail, we can manually insert test data to verify the system works:
1. Create a test cruise entry
2. Verify search API works
3. Confirm issue is with FTP, not the application

## Contact Support

- **Traveltek**: For FTP access issues
- **Render**: For service/environment issues
- **Application**: Check GitHub issues

---

**Most likely issue**: FTP credentials or connection. Check Render logs for specific error messages.