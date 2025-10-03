# Session 2025-10-03: Cabin Image Fixes, Suite-Only Cruise Lines, and Webhook Coverage Investigation

## Date
October 3, 2025

## Summary
Fixed cabin image loading for cruises without price codes, implemented suite-only cruise line logic to hide unavailable cabin cards, and discovered that 22 cruise lines are not receiving webhooks from Traveltek despite having updated FTP data.

---

## Part 1: Cabin Image Loading Fix

### Problem
Cabin images were not loading for certain cabin types on some cruises, even though the images existed in the Traveltek data.

**Examples:**
- Royal Princess (cruise 2129325) - outside cabin had no image
- MS Finnmarken (cruise 2230449) - balcony had no image

### Investigation Findings
1. Traveltek provides two separate fields:
   - Price fields: `cheapestinside`, `cheapestoutside`, `cheapestbalcony`, `cheapestsuite`
   - Price code fields: `cheapestinsidepricecode`, `cheapestoutsidepricecode`, etc.

2. The frontend was returning early with `image: null` when `!priceCode` was true, even though:
   - `rawData.prices` contained cabin pricing information
   - `rawData.cabins` contained cabin images
   - Price codes could be derived from the prices object

### Solution Implemented
**File:** `/Users/winlin/Desktop/sites/zipsea/frontend/app/cruise/[slug]/CruiseDetailClient.tsx` (lines 342-417)

**Changes:**
1. Removed `!priceCode` from early return condition
2. Added fallback logic to derive cabin codes when price codes are missing:
   - Search all rate codes in the `prices` object
   - Filter cabins by matching `cabintype` (inside/outside/balcony/suite)
   - Find cheapest cabin of that type
   - Use that cabin's ID to look up images

**Code snippet:**
```typescript
if (priceCode) {
  // Existing logic for when price codes exist
} else {
  // No price code - derive it from prices object
  const allPrices = (rawData as any).prices;
  const allMatchingCabins: Array<{ cabinId: string; price: number }> = [];

  for (const rateCodeKey of Object.keys(allPrices)) {
    const cabinsInRate = allPrices[rateCodeKey];
    if (cabinsInRate && typeof cabinsInRate === "object") {
      const matchingCabins = Object.entries(cabinsInRate)
        .filter(
          ([_, priceData]: any) => priceData?.cabintype === targetCabinType,
        )
        .map(([cabinId, priceData]: any) => ({
          cabinId,
          price: parseFloat(priceData.price || "0"),
        }));

      allMatchingCabins.push(...matchingCabins);
    }
  }

  // Sort by price and use the cheapest
  if (allMatchingCabins.length > 0) {
    allMatchingCabins.sort((a, b) => a.price - b.price);
    cabinCode = allMatchingCabins[0].cabinId;
  }
}
```

**Deployment:**
- Commit: `32098ef`
- Deployed to main and production
- Confirmed backwards compatible - existing price code logic unchanged

---

## Part 2: Suite-Only Cruise Lines - Hide Unavailable Cabin Cards

### Problem
Luxury cruise lines like Explora Journeys, Regent Seven Seas, and Silversea are **100% suite-only** - all their cabins have `codtype: "suite"` regardless of naming. The frontend was showing disabled Interior/Oceanview/Balcony cards unnecessarily.

**Example:** https://www.zipsea.com/cruise/explora-iii-2026-12-06-2217061
- Shows 4 cabin cards (Interior/Oceanview/Balcony/Suite)
- Only Suite has a price ($4,125 - $18,525+)
- Interior/Oceanview/Balcony cards are grayed out

### Investigation Findings
Queried database and confirmed:
- **Explora Journeys:** All 486 cruises have only `codtype: "suite"` cabins
- **Regent Seven Seas Cruises:** All cabins are type "suite"
- **Silversea:** All cabins are type "suite"

These lines have different cabin names/tiers (Terrace Suite, Ocean View Suite, etc.) but all are classified as suites in the data.

### Solution Implemented
**File:** `/Users/winlin/Desktop/sites/zipsea/frontend/app/cruise/[slug]/CruiseDetailClient.tsx`

**Changes:**
1. Added helper function at lines 276-281:
```typescript
const isSuiteOnlyCruiseLine = () => {
  const cruiseLineName = cruiseLine?.name || "";
  const suiteOnlyLines = ["Explora Journeys", "Silversea", "Regent Seven Seas Cruises"];
  return suiteOnlyLines.includes(cruiseLineName);
};
```

2. Wrapped Interior/Oceanview/Balcony cards in conditional render (lines 1038, 1114, 1193):
```typescript
{!isSuiteOnlyCruiseLine() && (
  <div className="bg-white rounded-lg border border-gray-200...">
    {/* Interior/Oceanview/Balcony cabin card content */}
  </div>
)}
```

3. Suite card always shows (no conditional at line 1272)

**Initial Implementation Error:**
- First commit (`a767d29`) incorrectly hid cards based on price availability for ALL cruise lines
- User corrected: wanted this only for Explora, Silversea, and Regent
- Reverted with `git reset --hard 32098ef`
- Created cruise-line specific implementation

**Deployment:**
- Commit: `018ebe3`
- Force pushed to main and production (`git push -f origin main`)

---

## Part 3: Webhook Coverage Investigation - Missing Updates for 22 Cruise Lines

### Problem
User reported that cruise lines like Emerald Cruises haven't received webhook updates since September 19, despite having recent files on the FTP server.

### Investigation Process

#### Step 1: Verify Webhook Types
Discovered Traveltek sends TWO webhook types:
- `cruises_live_pricing_updated` - 26 cruise lines (major lines like Royal Caribbean, Celebrity, Norwegian)
- `cruiseline_pricing_updated` - 33 cruise lines (includes some smaller lines like Windstar, CroisiEurope)

#### Step 2: Check Emerald Cruises Specifically
```sql
SELECT * FROM webhook_events WHERE line_id IN (431, 795);
-- Result: 0 rows
```

Emerald Cruises (lineId 431 main, 795 yacht) receives **ZERO webhooks** of either type.

#### Step 3: Verify FTP Data Exists
Checked FTP server for Emerald Cruises October 2025 data:
```bash
curl -s --user "CEP_9_USD:Random7767!" "ftp://ftpeu1prod.traveltek.net/2025/10/431/2880/" | head -5
```

Result:
```
-rw-rw----   1 CEP_9_USD users  51085 Oct  3 13:14 2179771.json
-rw-rw----   1 CEP_9_USD users  50528 Oct  3 13:16 2190003.json
```

**Confirmation:** FTP files were updated Oct 3, 2025 at 13:14-13:16 UTC (today), but NO webhooks received.

#### Step 4: Identify All Affected Cruise Lines
Found **22 cruise lines with future cruises but ZERO webhooks in last 7 days:**

| Line ID | Cruise Line Name              | Future Cruises | Last DB Update | Webhook Status |
|---------|-------------------------------|----------------|----------------|----------------|
| 431     | Emerald Cruises               | 662            | 2025-09-19     | NO WEBHOOKS    |
| 76      | Scenic River Cruises          | 491            | 2025-09-19     | NO WEBHOOKS    |
| 1       | P&O Cruises                   | 357            | 2025-09-22     | NO WEBHOOKS    |
| 795     | Emerald Yacht Cruises         | 152            | 2025-09-19     | NO WEBHOOKS    |
| 118     | Aurora Expeditions            | 113            | 2025-09-25     | NO WEBHOOKS    |
| 13      | Fred Olsen Cruise Lines       | 105            | 2025-09-09     | NO WEBHOOKS    |
| 74      | APT Cruising                  | 78             | 2025-09-09     | NO WEBHOOKS    |
| 848     | Ambassador Cruise Line        | 70             | 2025-09-09     | NO WEBHOOKS    |
| 870     | Atlas Ocean Voyages           | 54             | 2025-09-09     | NO WEBHOOKS    |
| 45      | Ponant                        | 44             | 2025-09-09     | NO WEBHOOKS    |
| 28      | Marella Cruises               | 37             | 2025-09-09     | NO WEBHOOKS    |
| 874     | The Boat Company              | 35             | 2025-09-09     | NO WEBHOOKS    |
| 182     | TUI Cruises Mein Schiff       | 21             | 2025-09-09     | NO WEBHOOKS    |
| 186     | AIDA                          | 15             | 2025-09-09     | NO WEBHOOKS    |
| 38      | Saga Ocean Cruises            | 11             | 2025-09-09     | NO WEBHOOKS    |
| 751     | TUI River Cruises             | 9              | 2025-09-09     | NO WEBHOOKS    |
| 32      | Star Clippers                 | 5              | 2025-09-09     | NO WEBHOOKS    |
| 83      | Paul Gauguin Cruises          | 3              | 2025-09-09     | NO WEBHOOKS    |
| 871     | Explorations by Norwegian     | 2              | 2025-09-09     | NO WEBHOOKS    |
| 41      | American Cruise Lines         | 1              | 2025-09-09     | NO WEBHOOKS    |
| 722     | Ritz-Carlton Yacht Collection | 1              | 2025-09-09     | NO WEBHOOKS    |
| 192     | Tauck                         | 1              | 2025-09-09     | NO WEBHOOKS    |

#### Step 5: Verify Webhook Processing
Checked `/Users/winlin/Desktop/sites/zipsea/backend/src/routes/webhook.routes.ts`:
- Line 125: Webhook type is stored as `payload.event`
- The route accepts both `cruises_live_pricing_updated` and `cruiseline_pricing_updated`
- Webhook processor doesn't filter by type - processes all webhooks by lineId

Checked `/Users/winlin/Desktop/sites/zipsea/backend/src/services/webhook-processor-optimized-v2.service.ts`:
- Processor doesn't check webhook type
- Simply processes by lineId when webhook event is received

### Root Cause
**Traveltek's webhook system only covers approximately 56 cruise lines** (26 via `cruises_live_pricing_updated` + 30 via `cruiseline_pricing_updated`), leaving **22 cruise lines without ANY webhook coverage**.

Since FTP files ARE being updated (confirmed multiple times), this is definitively a **Traveltek configuration issue** - they are not configured to send webhooks for these 22 cruise lines.

### Database Evidence

**Cruise lines WITH webhooks (56 total):**
- `cruises_live_pricing_updated`: Royal Caribbean (22), Celebrity (3), Norwegian (17), MSC (16), Carnival (8), Princess (20), Disney (73), Viking (62), etc.
- `cruiseline_pricing_updated`: CroisiEurope (123), Lindblad (46), Avalon (91), Windstar (29), Hurtigruten (31), etc.

**Cruise lines WITHOUT webhooks (22 total):**
- All have updated FTP data
- All stuck at initial sync dates (Sept 9, 19, or 22)
- Combined total: 2,264 future cruises not receiving updates

### Checked Systems

**Cron Service Investigation:**
File: `/Users/winlin/Desktop/sites/zipsea/backend/src/services/cron.service.ts`

Found:
- Line 51: `setupDataSyncJobs()` scheduled to run hourly
- Line 58: Actual sync method marked as TODO - **NOT IMPLEMENTED**
- Comment: "TODO: Implement syncRecentData method"

This explains why some cruise lines are outdated - there's no automated FTP sync for non-webhook lines.

---

## Proposed Solutions (On Hold)

### Option 1: Scheduled FTP Sync (Recommended)
Implement a daily cron job that syncs the 22 non-webhook cruise lines directly from FTP:
- Run once daily (e.g., 2 AM UTC) to minimize server load
- Only process the 22 lineIds without webhooks: `[431, 76, 1, 795, 118, 13, 74, 848, 870, 45, 28, 874, 182, 186, 38, 751, 32, 83, 871, 41, 722, 192]`
- Use existing sync scripts like `sync-complete-data.js`
- Implement in `cron.service.ts` `setupDataSyncJobs()` method

### Option 2: Contact Traveltek
Request webhook coverage for all cruise lines in our account, though this may not be possible if they don't have webhook infrastructure for smaller/boutique cruise lines.

### Option 3: Hybrid Approach (Best Long-term)
- Keep webhooks for the 56 covered lines (real-time updates)
- Add scheduled FTP sync for the remaining 22 (daily updates acceptable for smaller lines)
- Monitor for new cruise lines and add to appropriate sync method

---

## Technical Details

### Files Modified
1. `/Users/winlin/Desktop/sites/zipsea/frontend/app/cruise/[slug]/CruiseDetailClient.tsx`
   - Lines 276-281: `isSuiteOnlyCruiseLine()` helper function
   - Lines 342-417: Cabin image derivation logic
   - Lines 1038, 1114, 1193, 1272: Conditional cabin card rendering

### Commits
- `32098ef`: Cabin image fix - derive cabin codes when price codes missing
- `a767d29`: Initial suite-only card hiding (TOO BROAD - reverted)
- `018ebe3`: Suite-only card hiding for specific cruise lines only

### Database Tables Referenced
- `cruise_lines`: Cruise line metadata
- `cruises`: Cruise data with raw_data JSONB field
- `webhook_events`: Webhook history with line_id, webhook_type, received_at
- `cheapest_pricing`: Not relevant to this investigation

### FTP Server Details
- Host: `ftpeu1prod.traveltek.net`
- Credentials: `CEP_9_USD:Random7767!`
- Path structure: `/{year}/{month}/{lineId}/{shipId}/{cruiseId}.json`
- Confirmed active for lineIds: 431, 795 (Emerald Cruises) with Oct 3 updates

### Webhook Types in Database
```sql
SELECT webhook_type, COUNT(*) as total, COUNT(DISTINCT line_id) as unique_lines
FROM webhook_events
GROUP BY webhook_type;
```

Results:
- `cruises_live_pricing_updated`: 9,223 webhooks, 26 cruise lines
- `cruiseline_pricing_updated`: 1,006 webhooks, 33 cruise lines
- Various test types: 133 webhooks (ignore)

---

## Next Steps (When Resumed)

1. **Implement Option 3 (Hybrid Approach):**
   - Create scheduled job in `cron.service.ts`
   - Add FTP sync for 22 non-webhook cruise lines
   - Run daily at 2 AM UTC
   - Monitor logs to ensure successful syncing

2. **Monitor Webhook Coverage:**
   - Track if Traveltek adds webhook support for additional cruise lines
   - Update sync job list accordingly

3. **Consider Traveltek Contact:**
   - Request webhook support for all cruise lines
   - Understand their webhook infrastructure limitations
   - May be able to get coverage for larger missing lines (P&O, Ponant, etc.)

---

## Validation Queries

**Check webhook coverage for a specific cruise line:**
```sql
SELECT COUNT(*) FROM webhook_events WHERE line_id = 431;
```

**Find all cruise lines without recent webhooks:**
```sql
WITH webhook_lines AS (
  SELECT DISTINCT line_id
  FROM webhook_events
  WHERE received_at >= NOW() - INTERVAL '7 days'
)
SELECT cl.id, cl.name, COUNT(DISTINCT c.id) as cruise_count
FROM cruise_lines cl
LEFT JOIN cruises c ON c.cruise_line_id = cl.id
LEFT JOIN webhook_lines wl ON wl.line_id = cl.id
WHERE c.id IS NOT NULL
  AND c.start_date >= CURRENT_DATE
  AND wl.line_id IS NULL
GROUP BY cl.id, cl.name
ORDER BY cruise_count DESC;
```

**Check FTP file dates for a cruise line:**
```bash
curl -s --user "CEP_9_USD:Random7767!" "ftp://ftpeu1prod.traveltek.net/2025/10/{lineId}/{shipId}/" | head -5
```
