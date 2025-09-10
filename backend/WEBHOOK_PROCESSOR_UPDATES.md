# Webhook Processor Updates

## Summary of Changes

### 1. Dynamic Date Range Scanning
- **Previous**: Hard-coded to scan only 3 months ahead
- **Updated**: Dynamically scans from current month forward, checking all available months on FTP
- **Logic**: Scans up to 3 years ahead but stops after 6 consecutive empty months
- **Benefit**: Automatically discovers all available cruises without manual configuration

### 2. Accurate Slack Notifications
Updated all Slack notifications to reflect actual processing:
- Shows actual date range discovered (e.g., "2025/09 to 2027/12")
- Reports number of months scanned
- Shows progress updates at 25%, 50%, 75%, 100%
- Displays processing speed (files/sec)
- Shows success rate and detailed metrics
- Sends queued notification when another webhook is already processing
- Different status emojis (✅ for success, ⚠️ for warnings, ❌ for errors)

### 3. New Cruise Handling
- **Detection**: Checks if cruise exists in database by cruise code
- **New Cruises**: 
  - Marked as "new_cruise_detected" in webhook_events
  - Full cruise data stored in metadata for later processing
  - Logged with 🆕 emoji for visibility
- **Existing Cruises**: 
  - Marked as "updated" in webhook_events
  - Ready for price comparison and updates

### 4. Removed Artificial Limits
- **Previous**: Only processed first 20 files
- **Updated**: Processes ALL discovered files
- **Benefit**: Handles large cruise lines like Royal Caribbean (465+ files)

## How It Works

### File Discovery Process
```javascript
// Dynamic discovery - scans forward from current month
for (let yearOffset = 0; yearOffset <= maxYearsAhead; yearOffset++) {
  // Check each month for data
  // Stop after 6 consecutive empty months
}
```

### New Cruise Detection
```javascript
// Check if cruise exists
const existingCruise = await db
  .select()
  .from(cruises)
  .where(eq(cruises.id, cruiseId))
  .limit(1);

if (existingCruise.length === 0) {
  // New cruise - store for creation
  action = 'new_cruise_detected';
} else {
  // Existing cruise - store for update
  action = 'updated';
}
```

### Webhook Event Storage
All cruise data is stored in webhook_events table with:
- `webhookType`: 'new_cruise' or 'cruise_update'
- `metadata.cruiseData`: Full JSON data from FTP
- `metadata.action`: 'new_cruise_detected' or 'updated'

## Next Steps

A separate sync process should:
1. Read webhook_events with status='processed'
2. For 'new_cruise' events:
   - Create cruise in database using CruiseCreationService
   - Create pricing records
   - Create itinerary records
3. For 'cruise_update' events:
   - Update existing cruise data
   - Compare and update pricing
   - Track price changes

## Testing

Use the provided test scripts:
- `test-line22-months.js` - Verify all months are discovered
- `test-new-cruise-handling.js` - Test new cruise detection
- `test-webhook-slack.js` - Verify Slack notifications

## Example Output

When a new cruise is detected:
```
[SIMPLE] 🆕 New cruise RCI_2027_SYMPHONY_7N_CARIBBEAN detected (not in database)
[SIMPLE] Cruise details: {
  name: "7 Night Caribbean Cruise",
  ship: "Symphony of the Seas",
  nights: 7,
  sailDate: "2027-12-18",
  lineId: 22
}
```

The cruise data is stored in webhook_events for later processing.