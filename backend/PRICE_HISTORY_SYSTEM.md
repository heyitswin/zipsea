# Price History Tracking System

This document describes the comprehensive price history tracking system implemented for the Zipsea cruise platform. The system captures, stores, and analyzes historical price data to provide insights into pricing trends and changes over time.

## Overview

The price history system addresses the limitation where webhook updates from Traveltek would overwrite existing prices without maintaining historical records. Now, every price change is captured and stored, enabling trend analysis and price volatility tracking.

## Architecture

### Database Schema

#### `price_history` Table
- **Primary Function**: Stores historical snapshots of pricing data
- **Key Fields**:
  - `cruise_id`: Reference to the cruise
  - `rate_code`, `cabin_code`, `occupancy_code`: Pricing combination identifier
  - Price fields: `base_price`, `adult_price`, `taxes`, etc.
  - `snapshot_date`: When the snapshot was taken
  - `change_type`: 'insert', 'update', 'delete'
  - `change_reason`: Why the change occurred (e.g., 'webhook_update', 'ftp_sync')
  - `price_change`: Absolute price difference from previous
  - `price_change_percent`: Percentage change from previous
  - `batch_id`: Groups related price changes

#### `price_trends` Table
- **Primary Function**: Stores aggregated trend analysis data
- **Key Fields**:
  - `cruise_id`, `cabin_code`, `rate_code`: Identifies the pricing combination
  - `trend_period`: 'daily', 'weekly', 'monthly'
  - `start_price`, `end_price`, `min_price`, `max_price`, `avg_price`
  - `trend_direction`: 'increasing', 'decreasing', 'stable', 'volatile'
  - `price_volatility`: Standard deviation of prices
  - `change_count`: Number of price changes in the period

### Performance Optimizations

#### Database Indexes
```sql
-- Efficient querying by cruise and date
CREATE INDEX idx_price_history_cruise_snapshot ON price_history (cruise_id, snapshot_date);

-- Fast cabin/rate lookups
CREATE INDEX idx_price_history_cruise_cabin_date ON price_history 
  (cruise_id, cabin_code, rate_code, snapshot_date);

-- Trend analysis optimization
CREATE INDEX idx_price_trends_cruise_cabin_period ON price_trends 
  (cruise_id, cabin_code, trend_period, period_start);
```

## Core Components

### 1. PriceHistoryService

The main service class that handles all price history operations.

#### Key Methods

**`captureSnapshot(cruiseId, changeReason, batchId?)`**
- Captures current pricing state before updates
- Returns batch ID for tracking related changes
- Used automatically in data sync operations

**`calculatePriceChanges(batchId)`**
- Compares current snapshot with previous prices
- Calculates absolute and percentage changes
- Updates change metadata

**`getHistoricalPrices(query)`**
- Retrieves historical price data with filtering
- Supports pagination and date ranges
- Optimized for large datasets

**`generateTrendAnalysis(cruiseId, cabinCode, rateCode, period, days)`**
- Analyzes price trends over specified periods
- Calculates volatility and trend direction
- Returns comprehensive trend analysis

**`cleanupOldHistory(retentionDays)`**
- Removes old price history records
- Default retention: 90 days
- Runs automatically via cron jobs

### 2. Integration with Data Sync

The system is automatically integrated with the existing data sync process:

```typescript
// In DataSyncService.syncCruiseDataFile()
// 1. Capture price snapshot before updating
const batchId = await priceHistoryService.captureSnapshot(
  data.cruiseid, 
  'ftp_sync_update'
);

// 2. Update pricing data (existing logic)
await this.syncPricing(tx, data);

// 3. Calculate price changes
await priceHistoryService.calculatePriceChanges(batchId);
```

### 3. API Endpoints

#### Historical Price Data
```http
GET /api/v1/price-history
```
**Query Parameters:**
- `cruiseId`: Filter by specific cruise
- `cruiseIds`: Comma-separated list of cruise IDs
- `cabinCode`: Filter by cabin type
- `rateCode`: Filter by rate code
- `startDate`, `endDate`: Date range filter
- `changeType`: Filter by change type
- `limit`, `offset`: Pagination

#### Trend Analysis
```http
GET /api/v1/price-history/trends/{cruiseId}/{cabinCode}/{rateCode}
```
**Query Parameters:**
- `period`: 'daily', 'weekly', 'monthly'
- `days`: Number of days to analyze

#### Price Changes
```http
GET /api/v1/price-history/changes/{cruiseId}
```
Returns detailed price change analysis for a cruise.

#### Volatility Metrics
```http
GET /api/v1/price-history/volatility/{cruiseId}
```
Provides price volatility statistics.

#### Summary Dashboard
```http
GET /api/v1/price-history/summary/{cruiseId}
```
High-level price trend summary for dashboards.

#### Data Cleanup (Admin)
```http
DELETE /api/v1/price-history/cleanup
```
**Query Parameters:**
- `retentionDays`: Days to retain (1-365)

## Automated Operations

### Cron Jobs

The system includes automated maintenance operations:

#### Daily Operations (6:00 AM UTC)
- **Price History Cleanup**: Removes records older than 90 days
- Configurable retention period
- Logs deletion statistics

#### Every 6 Hours
- **Trend Analysis Generation**: Analyzes active cruises with recent changes
- Generates and stores trend data
- Limits processing to prevent performance impact

### Data Retention Strategy

#### Default Retention: 90 Days
- Balances storage efficiency with analytical needs
- Sufficient for seasonal pricing pattern analysis
- Configurable per environment

#### Storage Optimization
- Automatic cleanup of old records
- Efficient indexing for common queries
- Batch operations to minimize performance impact

## Usage Examples

### Basic Price History Retrieval
```typescript
// Get last 30 days of price changes for a cruise
const history = await priceHistoryService.getHistoricalPrices({
  cruiseId: 12345,
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  changeType: 'update',
  limit: 100
});
```

### Trend Analysis
```typescript
// Analyze price trends for interior cabins
const trends = await priceHistoryService.generateTrendAnalysis(
  12345,           // cruise ID
  'IB',           // cabin code (Interior Balcony)
  'BESTFARE',     // rate code
  'daily',        // period
  30              // days to analyze
);

if (trends) {
  console.log(`Trend: ${trends.trendDirection}`);
  console.log(`Change: ${trends.totalChangePercent}%`);
  console.log(`Volatility: ${trends.volatility}`);
}
```

### API Usage
```javascript
// Frontend: Get price history for display
const response = await fetch('/api/v1/price-history/summary/12345?days=30');
const summary = await response.json();

// Display trend indicators
summary.data.recentTrends.forEach(trend => {
  console.log(`${trend.cabinCode}: ${trend.trendDirection}`);
});
```

## Error Handling

### Graceful Degradation
- Price snapshots are non-blocking operations
- Failures don't prevent normal pricing updates
- Comprehensive error logging

### Data Integrity
- Transactions ensure consistency
- Batch IDs track related changes
- Validation prevents corrupt data

### Performance Safeguards
- Query limits prevent excessive resource usage
- Batch processing for large operations
- Index optimization for common queries

## Monitoring and Alerts

### Key Metrics
- Price snapshot success rate
- Historical data query performance
- Storage growth trends
- Cleanup operation effectiveness

### Recommended Alerts
- Failed price snapshot captures
- Unusual price volatility detected
- Storage approaching limits
- API response time degradation

## Testing

### Comprehensive Test Suite
- Unit tests for all service methods
- Integration tests for webhook updates
- API endpoint testing
- Performance benchmarks

### Test Coverage
- Price snapshot capture and calculation
- Trend analysis accuracy
- Data cleanup functionality
- Error handling scenarios

### Running Tests
```bash
# Run price history tests
npm test src/tests/price-history.service.test.ts

# Run integration tests
npm test src/tests/webhook-price-history.test.ts

# Run all API tests
npm test src/tests/price-history.controller.test.ts
```

## Deployment

### Migration
```bash
# Generate migration (already created)
npx drizzle-kit generate:pg

# Apply migration
npm run db:migrate

# Setup and test system
npm run setup:price-history
```

### Production Considerations
- Enable cron jobs: `ENABLE_CRON=true`
- Monitor storage usage
- Configure appropriate retention periods
- Set up monitoring and alerting

### Environment Variables
```env
# Price history retention (days)
PRICE_HISTORY_RETENTION_DAYS=90

# Enable automated trend analysis
ENABLE_TREND_ANALYSIS=true

# Batch size for processing
PRICE_HISTORY_BATCH_SIZE=100
```

## Future Enhancements

### Planned Features
1. **Real-time Price Alerts**: Notify users of significant price changes
2. **Price Prediction Models**: ML-based price forecasting
3. **Comparative Analysis**: Cross-cruise price comparisons
4. **Historical Export**: CSV/Excel export functionality
5. **Advanced Visualizations**: Price charts and trend graphs

### Scalability Improvements
1. **Partitioning**: Date-based table partitioning for large datasets
2. **Archival System**: Move old data to cold storage
3. **Caching Layer**: Redis caching for frequently accessed trends
4. **Stream Processing**: Real-time price change processing

## Support and Maintenance

### Regular Tasks
- Monitor storage usage and cleanup effectiveness
- Review and tune database indexes
- Validate data integrity
- Performance optimization

### Troubleshooting
- Check cron job logs for automated operations
- Verify database connections and permissions
- Monitor API response times and error rates
- Validate price snapshot accuracy

### Contact
For technical questions or issues with the price history system, contact the development team or refer to the main project documentation.