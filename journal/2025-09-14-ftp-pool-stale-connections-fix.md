# FTP Connection Pool Stale Connection Bug - Fixed

## The Problem
Webhook processing stopped working because the FTP connection pool was holding onto dead connections. When Traveltek's FTP server temporarily refused connections, the pool's connections became stale but were never properly replaced.

## Why Deployment Fixed It (Temporarily)
Deploying any code change causes Render to restart the service (`npm start`), which:
1. Destroys the old FTP connection pool with broken connections
2. Creates a brand new pool with fresh connections
3. Fresh connections work immediately

This is why webhook processing suddenly started working after deploying the test scripts.

## Root Cause Analysis

### The Bug
In `webhook-processor-optimized-v2.service.ts`, when a connection died:
```javascript
// OLD BROKEN CODE:
if (connectionFails) {
  availableConn.inUse = true; // Mark as permanently in use
  // This connection is now LOST FOREVER from the pool!
}
```

The connection was marked as `inUse = true` to prevent reuse, but was never:
- Released back to the pool
- Removed from the pool
- Replaced with a working connection

Eventually all 8 connections would become "permanently in use" even though they were actually dead, causing complete failure.

### The Sequence of Events
1. FTP server blocks connections temporarily (network issue, firewall change, etc.)
2. Pool connections try to reconnect and fail
3. Failed connections marked as `inUse = true` permanently
4. Pool gradually exhausts as each connection fails
5. No working connections left, all marked as "in use"
6. Webhook processing completely stops
7. Service restart creates new pool → everything works again

## The Fix

### 1. Remove Dead Connections
Instead of marking dead connections as permanently in use, remove them from the pool:
```javascript
const deadIndex = ftpPool.indexOf(availableConn);
if (deadIndex !== -1) {
  ftpPool.splice(deadIndex, 1);
}
```

### 2. Create Replacement Connections
Immediately try to create a replacement for the dead connection:
```javascript
try {
  const newClient = new ftp.Client();
  await newClient.access(ftpConfig);
  const newConn = { client: newClient, inUse: true, lastUsed: Date.now() };
  ftpPool.push(newConn);
  return newConn;
} catch (error) {
  // Handle replacement failure
}
```

### 3. Pool Reset Mechanism
If the pool gets critically low (< 2 connections), trigger a complete reset:
```javascript
if (ftpPool.length < 2) {
  poolInitialized = false;
  ftpPool = [];
  await initializeFtpPool();
}
```

### 4. Proactive Health Checks
The keep-alive mechanism now also removes and replaces dead connections:
```javascript
setInterval(async () => {
  // Test each idle connection
  // Remove dead ones
  // Create replacements
  // Trigger reset if pool is critically low
}, KEEP_ALIVE_INTERVAL);
```

## Prevention
1. **Connection Health Checks**: Proactively test and replace dead connections
2. **Automatic Recovery**: Pool can now recover from temporary network issues
3. **Pool Reset**: Complete reinitialization when too many connections fail
4. **Proper Cleanup**: Dead connections are removed, not left in limbo

## Monitoring
Watch for these log messages:
- `[OPTIMIZED-V2] Removed dead connection from pool`
- `[OPTIMIZED-V2] Created replacement connection`
- `[OPTIMIZED-V2] FTP pool critically low, triggering reset`

## Long-term Improvements
Consider:
1. Circuit breaker pattern for FTP connections
2. Exponential backoff for pool recreation
3. Metrics tracking for connection health
4. Alert when pool size drops below threshold