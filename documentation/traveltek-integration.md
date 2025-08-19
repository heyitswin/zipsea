# Traveltek Integration Guide

## Overview
Traveltek provides cruise data through JSON exports accessible via FTP, with webhook notifications for updates.

## FTP Access

### Connection Details
- **Server**: `ftp://ftpeu1prod.traveltek.net/`
- **Authentication**: Credentials provisioned through iSell platform
- **Protocol**: Secure FTP
- **Access Control**: Managed by authorized technical teams

### File Structure
Files are organized in a hierarchical folder structure:
```
[year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
```

Example path:
```
2025/05/7/231/8734921.json
```

Where:
- `year`: 4-digit year (e.g., 2025)
- `month`: 1-2 digit month (e.g., 05 or 5)
- `lineid`: Cruise line identifier
- `shipid`: Ship identifier
- `codetocruiseid`: Unique cruise identifier

## Webhook Integration

### Webhook Types

1. **Static Pricing Updates**
   - Event: `cruiseline_pricing_updated`
   - Triggered: When static pricing is updated (daily processing)
   - Contains: Notification of which cruise lines have updated pricing

2. **Live Pricing Updates**
   - Event: `cruises_live_pricing_updated`
   - Triggered: When live pricing is updated for specific cruises
   - Contains: List of specific cruise IDs with updated pricing

### Webhook Requirements
- Accept POST requests
- Return HTTP 200 OK status code
- Handle JSON payloads
- No automatic retry on failure (implement own retry logic if needed)
- Webhook delivery is not guaranteed

### Implementation Strategy
1. Set up webhook endpoints for both event types
2. Validate incoming requests
3. Queue updates for processing
4. Trigger FTP download for updated files
5. Update local database with new data

## Data Update Frequency

### Static Pricing
- **Frequency**: Daily processing
- **Time**: Typically overnight (check with Traveltek for specific times)
- **Coverage**: All available sailings

### Live Pricing
- **Cache TTL**: 1 day
- **Updates**: Real-time when available
- **Coverage**: Not guaranteed for all sailings/cabin types

## Data Characteristics

### File Format
- **Type**: JSON
- **Encoding**: UTF-8
- **Currency**: Single market-specific currency per file
- **Size**: Varies by cruise complexity (typically 50KB - 500KB)

### Content Structure
Each JSON file contains:
- Cruise-level metadata
- Sailing dates and duration
- Complete itinerary with ports
- Ship information
- Deck plans and cabin categories
- Comprehensive pricing breakdowns
- Availability status

## Integration Best Practices

### Initial Data Load
1. Connect to FTP server with provided credentials
2. Recursively scan directory structure
3. Download all JSON files
4. Parse and validate JSON structure
5. Import into database with transaction support
6. Build search indexes

### Incremental Updates
1. Listen for webhook notifications
2. Parse webhook payload for updated items
3. Download only changed files via FTP
4. Validate new data before updating
5. Update database records
6. Invalidate relevant caches

### Error Handling
- Implement exponential backoff for FTP connection failures
- Log all webhook receipts for audit trail
- Validate JSON schema before processing
- Maintain data consistency with database transactions
- Keep historical data for rollback capability

### Performance Optimization
- Use connection pooling for FTP
- Implement parallel file downloads
- Cache frequently accessed data in Redis
- Use database bulk operations for imports
- Implement rate limiting to respect server limits

## Security Considerations
- Store FTP credentials securely (environment variables)
- Validate webhook origins
- Implement webhook signature verification if available
- Use secure connections (FTPS/SFTP)
- Audit log all data access and modifications

## Monitoring
- Track FTP connection success/failure rates
- Monitor webhook receipt rates
- Alert on missing expected updates
- Track data freshness metrics
- Monitor import processing times