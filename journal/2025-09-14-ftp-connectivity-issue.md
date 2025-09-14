# Critical Issue: FTP Connectivity Blocked from Render Servers

## Issue Summary
As of September 13, 2025 at 23:00 UTC, all webhook sync operations are failing because Traveltek's FTP server (ftpeu1prod.traveltek.net / 18.200.114.254) is refusing connections from Render's production servers.

## Evidence
1. **FTP Connection Errors**: All webhook processing jobs failing with `ECONNREFUSED 18.200.114.254:21`
2. **Local Test Success**: FTP server is accessible from local machine (tested with nc and FTP client)
3. **Webhooks Still Arriving**: Traveltek is still sending webhooks which are being queued successfully
4. **Redis Healthy**: Redis memory stable at ~100MB/1.5GB, no eviction issues
5. **Last Successful Processing**: No successful FTP connections in the past 24+ hours

## Root Cause
Traveltek's FTP server is blocking connections from Render's IP addresses. This could be due to:
- Firewall rule changes on Traveltek's side
- IP-based rate limiting or blocking
- Security policy changes

## Impact
- **No price updates** for any cruises since Sept 13 23:00
- **Webhook queue building up** (though Redis has plenty of capacity)
- **Customer-facing impact**: Prices shown on site are becoming stale

## Immediate Actions Required

### 1. Contact Traveltek Support
Request to whitelist Render's Oregon region IP addresses:
- Render's static IP documentation: https://render.com/docs/static-outbound-ip-addresses
- Specific IPs for Oregon region need to be whitelisted

### 2. Temporary Workarounds (if Traveltek can't resolve quickly)
- Set up a proxy server with a different IP to relay FTP connections
- Move FTP processing to a different cloud provider temporarily
- Request alternative data access method from Traveltek (API, different FTP server, etc.)

### 3. Monitoring
- Check webhook queue status: Jobs are being created but failing at FTP connection step
- Monitor Redis memory (currently stable)
- Watch for any successful connections if Traveltek makes changes

## Technical Details
```
Error: connect ECONNREFUSED 18.200.114.254:21
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1595:16) {
  errno: -111,
  code: 'ECONNREFUSED',
  syscall: 'connect',
  address: '18.200.114.254',
  port: 21
}
```

## Contact Information Needed
- Traveltek technical support contact
- Account manager at Traveltek
- Render support (if we need their specific IP list)

## Test Commands
```bash
# Test from production (will fail currently)
node scripts/test-ftp-connection-prod.js

# Check webhook processing status
curl https://zipsea-production.onrender.com/api/admin/webhook-status

# Monitor Redis
redis-cli -u $REDIS_URL info memory
```

## Resolution Steps
1. ✅ Identified the issue: FTP server blocking Render IPs
2. ⏳ Contact Traveltek support with IP whitelist request
3. ⏳ Implement monitoring to detect when connection is restored
4. ⏳ Process backlog of webhooks once connection restored
5. ⏳ Add alerting for future FTP connectivity issues