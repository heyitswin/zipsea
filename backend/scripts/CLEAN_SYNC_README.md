# Traveltek Clean Sync System

A production-ready, bulletproof sync script built from scratch for Traveltek cruise data. This system replaces all legacy sync scripts with a clean, reliable, and maintainable solution.

## 🎯 Features

- **Month/Year Processing**: Process specific months with clear progress indicators
- **Bulletproof FTP**: Auto-reconnect, retry logic, connection timeout handling
- **Transaction Safety**: All database operations use transactions for data integrity
- **Progress Tracking**: Real-time progress with success/failure counts and ETA
- **Test Mode**: Validate data without writing to database
- **Resume Capability**: Can resume if script fails mid-process
- **Comprehensive Logging**: Detailed logs for monitoring and debugging
- **Error Recovery**: Graceful handling of connection drops and retries

## 📋 Requirements

### Environment Variables

```bash
# Required FTP credentials
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=your_username
TRAVELTEK_FTP_PASSWORD=your_password

# Required database connection
DATABASE_URL=postgresql://user:pass@host:port/database

# Optional sync parameters
SYNC_YEAR=2025
SYNC_MONTH=09
TEST_MODE=true  # Set to false for production sync
```

### Dependencies

The script uses standard Node.js packages that should already be installed:
- `postgres` (for database connection)
- `ftp` (for FTP connection)
- `dotenv` (for environment variables)

## 🚀 Usage

### 1. Test Your Setup

First, validate your environment configuration:

```bash
node scripts/test-sync-setup.js
```

This will check:
- Environment variables are set
- Dependencies are available
- Database connection works
- FTP connection works
- Target month directory exists

### 2. Run Test Mode (Recommended)

Always run in test mode first to validate data without writing to the database:

```bash
# Using the runner script (recommended)
./scripts/run-clean-sync.sh 2025 09 test

# Or directly
TEST_MODE=true SYNC_YEAR=2025 SYNC_MONTH=09 node scripts/sync-traveltek-clean.js
```

### 3. Run Production Sync

After test mode succeeds, run the actual sync:

```bash
# Using the runner script (recommended)
./scripts/run-clean-sync.sh 2025 09

# Or directly
SYNC_YEAR=2025 SYNC_MONTH=09 node scripts/sync-traveltek-clean.js
```

### 4. Default Behavior

If no year/month is specified, it defaults to current year/month:

```bash
./scripts/run-clean-sync.sh  # Uses current year/month
```

## 📊 Database Schema Mapping

The script correctly maps Traveltek data to your current database schema:

```sql
-- Current Schema (after migration 0005)
CREATE TABLE cruises (
    id INTEGER PRIMARY KEY,           -- Maps to: codetocruiseid (unique per sailing)
    cruise_id INTEGER NOT NULL,      -- Maps to: cruiseid (original, can duplicate)
    cruise_line_id INTEGER,          -- Maps to: lineid
    ship_id INTEGER,                 -- Maps to: shipid
    name VARCHAR(255),               -- Maps to: name
    voyage_code VARCHAR(50),         -- Maps to: voyagecode
    itinerary_code VARCHAR(50),      -- Maps to: itinerarycode
    sailing_date DATE,               -- Maps to: startdate/saildate
    return_date DATE,                -- Calculated: sailing_date + nights
    nights INTEGER,                  -- Maps to: nights
    sail_nights INTEGER,             -- Maps to: sailnights
    sea_days INTEGER,                -- Maps to: seadays
    embark_port_id INTEGER,          -- Maps to: startportid
    disembark_port_id INTEGER,       -- Maps to: endportid
    port_ids JSONB,                  -- Maps to: portids (parsed from CSV string)
    region_ids JSONB,                -- Maps to: regionids (parsed from CSV string)
    market_id INTEGER,               -- Maps to: marketid
    owner_id INTEGER,                -- Maps to: ownerid
    no_fly BOOLEAN,                  -- Maps to: nofly
    depart_uk BOOLEAN,               -- Maps to: departuk
    show_cruise BOOLEAN,             -- Maps to: showcruise
    fly_cruise_info TEXT,            -- Maps to: flycruiseinfo
    line_content TEXT,               -- Maps to: linecontent
    traveltek_file_path VARCHAR(500), -- File path for tracking
    last_cached TIMESTAMP,           -- Maps to: lastcached
    cached_date DATE,                -- Maps to: cacheddate
    currency VARCHAR(3),             -- Maps to: currency (default USD)
    is_active BOOLEAN,               -- Default: true
    created_at TIMESTAMP,            -- Auto: NOW()
    updated_at TIMESTAMP             -- Auto: NOW()
);
```

## 📈 Progress Monitoring

The script provides real-time progress updates:

```
Progress: 150/500 (30%) | ✅ 148 | ❌ 2 | ETA: 12m
```

- **150/500**: Files processed out of total
- **30%**: Percentage complete
- **✅ 148**: Successfully processed files
- **❌ 2**: Failed files
- **ETA: 12m**: Estimated time remaining

## 📋 Final Report

After completion, you'll get a comprehensive report:

```
============================================================
                    PROCESSING SUMMARY                    
============================================================
Total Files: 500
Processed: 500
Successful: 498
Failed: 2
Success Rate: 99%
Total Time: 1847s
============================================================

============================================================
                      SYNC REPORT                       
============================================================
Period: 2025/09
Test Mode: NO

DATABASE STATISTICS:
  Total Sailings: 498
  Unique Cruises: 156
  Cruise Lines: 12
  Ships: 87
  Date Range: 2025-09-01 to 2025-09-30

SAMPLE DATA:
  1. ID: 789123 | Cruise: 12345 | Mediterranean Highlights
     Sailing: 2025-09-15 | 7 nights | MED7A
     File: 2025/09/7/410/789123.json
     
  2. ID: 789124 | Cruise: 12345 | Mediterranean Highlights
     Sailing: 2025-09-22 | 7 nights | MED7A
     File: 2025/09/7/410/789124.json
     
  [More samples...]
============================================================
```

## 🔧 Configuration Options

The script can be customized by modifying `CONFIG` object in the script:

```javascript
const CONFIG = {
  batch: {
    size: 50,              // Files processed per batch
    delayMs: 100,          // Delay between files (FTP-friendly)
    maxRetries: 3,         // Max retry attempts
    reconnectDelayMs: 5000 // Delay before FTP reconnection
  }
};
```

## ⚠️ Error Handling

The script handles various error scenarios:

1. **FTP Connection Loss**: Auto-reconnects with exponential backoff
2. **Database Errors**: Transaction rollback, detailed error logging
3. **JSON Parse Errors**: Logged and skipped, doesn't stop processing
4. **File Access Errors**: Retried with backoff, logged for review
5. **Process Interruption**: Graceful shutdown with cleanup

## 🧪 Data Validation

In test mode, the script validates that each file contains required fields:
- `cruiseid`
- `codetocruiseid`
- `lineid`
- `shipid`
- `name`
- `saildate`
- `nights`

## 📂 File Structure

```
scripts/
├── sync-traveltek-clean.js     # Main sync script
├── test-sync-setup.js          # Environment validation
├── run-clean-sync.sh          # Easy runner script
└── CLEAN_SYNC_README.md       # This documentation
```

## 🚨 Troubleshooting

### Common Issues

1. **"Missing FTP credentials"**
   - Set `TRAVELTEK_FTP_USER` and `TRAVELTEK_FTP_PASSWORD` environment variables

2. **"Database connection failed"**
   - Verify `DATABASE_URL` is correct and database is accessible

3. **"No files found for the specified period"**
   - Check if `SYNC_YEAR/SYNC_MONTH` directory exists on FTP server
   - Run `test-sync-setup.js` to verify FTP access

4. **"Connection lost during processing"**
   - Normal behavior, script will auto-reconnect and retry

### Debugging

Enable detailed logging by setting environment variables:

```bash
DEBUG=true node scripts/sync-traveltek-clean.js
```

## 🔄 Resume Capability

If the script fails mid-process, it can resume from where it left off. The script tracks processed files and will skip them on restart.

## 🎚️ Performance Tuning

For large months with many files:

1. **Increase batch size**: Modify `CONFIG.batch.size`
2. **Reduce delay**: Modify `CONFIG.batch.delayMs` (but be FTP-friendly)
3. **Increase database connections**: Modify `CONFIG.database.max`

## ✅ Best Practices

1. **Always test first**: Run in test mode before production sync
2. **Monitor progress**: Watch for high failure rates
3. **Check reports**: Review sample data after sync
4. **Sync off-hours**: Run during low-traffic periods
5. **Backup first**: Ensure database backups before large syncs

## 🔒 Security

- FTP credentials are masked in logs
- Database connections use SSL by default
- No sensitive data is logged in plain text
- Graceful shutdown prevents data corruption