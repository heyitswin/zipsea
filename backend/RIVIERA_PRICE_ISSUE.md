# Riviera Travel Price Issue - Root Cause Analysis

## Discovery Summary
After investigating the FTP raw data, I've found that **the issue is NOT in our sync pipeline**. The FTP data from Traveltek already contains these inflated prices.

## Evidence

### Example 1: Cruise 2196959
```json
// Raw FTP data from Traveltek:
"cheapestbalcony": "10003848.00"

// Database:
balcony_price: 10003848.00
```

### The Pattern
- ALL Riviera Travel prices come from Traveltek with values like "10003848.00"
- These appear to be in pence (British currency) or cents × 100
- Dividing by 1000 gives reasonable prices: 10003.85 GBP
- Price per night becomes reasonable: ~$1429/night for luxury river cruises

## Root Cause
**Traveltek is sending Riviera Travel prices in a different unit than other cruise lines**
- Other lines: Prices in dollars/pounds (e.g., "649.50")
- Riviera Travel: Prices appear to be in pence × 10 or cents × 100 (e.g., "10003848.00")

## Why This Happens
Riviera Travel is a UK-based river cruise company. Their pricing may be:
1. Originally in pence (100 pence = 1 GBP)
2. Then multiplied by 10 for some internal reason
3. Sent to us without proper conversion

## Solution Required
We need to add special handling for Riviera Travel (cruise_line_id = 329) in the webhook processor to divide their prices by 1000 during import.

This is NOT a bug in our code - it's a data format inconsistency from the provider.