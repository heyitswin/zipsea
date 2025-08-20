# Traveltek FTP Integration Setup Guide

## Current Status
✅ **Backend Infrastructure: READY**
✅ **Webhook Endpoints: DEPLOYED**
⏳ **Awaiting: FTP Credentials**

## Required Traveltek Credentials

### FTP Connection Details
The following environment variables need to be configured in Render Dashboard:

```bash
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=[Your iSell Account Username]
TRAVELTEK_FTP_PASSWORD=[Your iSell Account Password]
```

### Webhook URLs (Already Deployed)
Your webhook endpoints are live and ready for registration with Traveltek:

- **Staging**: `https://zipsea-backend.onrender.com/api/webhooks/traveltek`
- **Production**: `https://zipsea-production.onrender.com/api/webhooks/traveltek`

**Important**: The production URL is `zipsea-production.onrender.com` NOT `zipsea-backend-production.onrender.com`

## How to Configure in Render

### Step 1: Access Render Dashboard
1. Log into [Render Dashboard](https://dashboard.render.com)
2. Navigate to the Zipsea project

### Step 2: Add Environment Variables to Staging
1. Click on `zipsea-backend-staging` service
2. Go to "Environment" tab
3. Add the following variables:
   - `TRAVELTEK_FTP_HOST` = `ftpeu1prod.traveltek.net`
   - `TRAVELTEK_FTP_USER` = [Your Username]
   - `TRAVELTEK_FTP_PASSWORD` = [Your Password]
4. Click "Save Changes" (service will auto-restart)

### Step 3: Add Environment Variables to Production
1. Click on `zipsea-backend-production` service (labeled as "zipsea-backend-production" in Render)
2. Go to "Environment" tab
3. Add the same variables as staging
4. Click "Save Changes" (service will auto-restart)

## Register Webhooks with Traveltek

### Contact Traveltek Support
Provide them with your webhook URLs to register for notifications:

1. **Staging Webhook URL**: 
   ```
   https://zipsea-backend.onrender.com/api/webhooks/traveltek
   ```

2. **Production Webhook URL**: 
   ```
   https://zipsea-production.onrender.com/api/webhooks/traveltek
   ```

### Webhook Event Types to Register
Request registration for both event types:
- `cruiseline_pricing_updated` - Full cruise line sync
- `cruises_live_pricing_updated` - Specific file updates

## Test FTP Connection

After configuring credentials, test the connection:

### Via API Endpoint (Staging)
```bash
curl -X POST https://zipsea-backend.onrender.com/api/v1/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'
```

### Expected Response
```json
{
  "status": "success",
  "message": "FTP connection successful",
  "details": {
    "connected": true,
    "host": "ftpeu1prod.traveltek.net"
  }
}
```

## Initial Data Sync

Once FTP credentials are configured:

### 1. Test Connection First
```bash
# Test FTP connectivity
curl -X POST https://zipsea-backend.onrender.com/api/v1/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'
```

### 2. Run Initial Sync (Recent Data)
```bash
# Sync last 7 days of data
curl -X POST https://zipsea-backend.onrender.com/api/v1/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"type": "recent", "days": 7}'
```

### 3. Monitor Sync Progress
```bash
# Check sync status
curl https://zipsea-backend.onrender.com/api/v1/admin/sync/status
```

## FTP Directory Structure

Traveltek FTP follows this structure:
```
/
├── [year]/           # e.g., 2025
│   ├── [month]/      # e.g., 5 or 05
│   │   ├── [lineid]/ # Cruise line ID
│   │   │   ├── [shipid]/  # Ship ID
│   │   │   │   ├── [codetocruiseid].json  # Cruise data files
```

## Data Processing Pipeline

Once credentials are configured, the system will:

1. **Connect to FTP** - Establish secure connection to ftpeu1prod.traveltek.net
2. **Navigate Directories** - Browse year/month/lineid/shipid structure
3. **Download JSON Files** - Retrieve cruise data files
4. **Process Data** - Transform and validate Traveltek format
5. **Store in Database** - Save to PostgreSQL with proper relationships
6. **Update Cache** - Refresh Redis cache for fast searches
7. **Handle Webhooks** - Process real-time updates from Traveltek

## Webhook Processing

The webhook endpoint handles two types of events:

### 1. Cruise Line Pricing Updated
```json
{
  "event": "cruiseline_pricing_updated",
  "lineid": 7,
  "currency": "GBP",
  "marketid": 1,
  "timestamp": "2024-12-19T10:00:00Z",
  "description": "Royal Caribbean pricing updated"
}
```

### 2. Specific Cruises Updated
```json
{
  "event": "cruises_live_pricing_updated",
  "currency": "GBP",
  "marketid": 1,
  "timestamp": "2024-12-19T10:00:00Z",
  "paths": [
    "2025/05/7/231/8734921.json",
    "2025/05/7/231/8734922.json"
  ]
}
```

## Monitoring and Logs

### View Service Logs in Render
1. Go to service dashboard
2. Click "Logs" tab
3. Filter by:
   - `[FTP]` - FTP connection logs
   - `[SYNC]` - Data synchronization logs
   - `[WEBHOOK]` - Webhook processing logs

### Check System Health
```bash
# Detailed health check including FTP status
curl https://zipsea-backend.onrender.com/health/detailed
```

## Troubleshooting

### Common Issues

#### FTP Connection Failed
- Verify credentials are correct
- Check if IP needs whitelisting with Traveltek
- Ensure port 21 is not blocked

#### Webhook Not Receiving Events
- Confirm webhook URL is registered with Traveltek
- Check Render logs for incoming requests
- Verify webhook endpoint returns 200 OK

#### Data Sync Issues
- Check available disk space in Render
- Monitor memory usage during sync
- Review error logs for specific file issues

## Support Contacts

### Traveltek Support
- FTP Issues: Contact your iSell account manager
- Webhook Registration: Technical support team
- Data Format Questions: API documentation team

### Render Support
- Service Issues: support@render.com
- Environment Variables: Dashboard > Service > Environment
- Logs: Dashboard > Service > Logs

## Next Steps After Setup

1. ✅ Configure FTP credentials in Render
2. ✅ Test FTP connection
3. ✅ Register webhook URLs with Traveltek
4. ✅ Run initial data sync
5. ✅ Verify data in database
6. ✅ Test search API with real data
7. 🚀 Begin frontend development

---

**Note**: The backend is fully prepared and waiting for these credentials. Once configured, the system will automatically begin processing Traveltek data.