# Instant Booking Filter Not Working - Investigation

**Date:** October 31, 2025  
**Status:** In Progress - Debugging  
**Issue:** Instant booking toggle and cruise line filters not affecting search results

---

## Problem Summary

User reports that the instant booking filter toggle and cruise line selection don't change the search results. The same 3 cruises appear regardless of filter settings.

### Console Evidence

```
Request #2: instantBooking=false
First 3 cruise IDs: ['2143767', '2106687', '2200562']

Request #3: instantBooking=true  
First 3 cruise IDs: ['2143767', '2106687', '2200562']

Request #5: cruiseLineId=186&instantBooking=false
First 3 cruise IDs: ['2143767', '2106687', '2200562']

Request #6: cruiseLineId=186&cruiseLineId=63&instantBooking=false
First 3 cruise IDs: ['2143767', '2106687', '2200562']
```

**Same cruise IDs returned every time** despite different filter parameters.

---

## Investigation Findings

### 1. Frontend is Correct
- ✅ URL parameters changing correctly (`instantBooking=true/false`, `cruiseLineId=186`, etc.)
- ✅ Requests being sent to backend with correct parameters
- ✅ Cache-busting timestamp `_t=` parameter included in URLs
- ✅ Response times: 25-30ms (suspiciously fast)

### 2. Backend Has Correct Logic
- ✅ Controller parses `instantBooking` and `cruiseLineId` parameters (lines 60-95)
- ✅ Service applies filters with empty array handling (commit `3713f2c`)
- ✅ Cache-busting headers set in response (commit `5ad17b2`)
- ✅ Debug logging present in controller (lines 212-235)

### 3. Backend NOT Receiving Requests
- ❌ **No logs in production** for search requests
- ❌ No "COMPREHENSIVE SEARCH DEBUG" logs
- ❌ No "Applying cruise line filter" logs
- ❌ No requests hitting the backend at all

### 4. Evidence of Caching Layer
- Response time: **25-30ms** (too fast for database query)
- Same results despite different parameters
- Cache-busting headers and `_t=` parameter not working
- Requests not reaching backend logs

---

## Root Cause Hypothesis

**A caching layer (Render CDN or browser) is returning cached responses before requests reach the backend.**

The cache is keying on the base URL path (`/api/v1/search/comprehensive`) and ignoring query parameters, despite:
- Cache-Control: no-store, no-cache
- Pragma: no-cache  
- Expires: 0
- Vary: *
- `_t=timestamp` in URL

---

## Files Involved

### Backend
- `backend/src/controllers/search-comprehensive.controller.ts`
  - Lines 60-95: Filter parsing with instant booking logic
  - Lines 212-235: Debug logging
  - Lines 246-258: Cache-busting headers

- `backend/src/services/search-comprehensive.service.ts`
  - Lines 162-175: Cruise line filter application
  - Includes empty array handling fix

### Frontend  
- `frontend/app/cruises/CruisesContent.tsx`
  - Adds `_t=timestamp` to prevent caching
  - Handles instant booking toggle
  - Manages cruise line selection

---

## Commits Related to This Issue

1. `3713f2c` - Fix: Handle empty array filters correctly in comprehensive search
2. `5ad17b2` - Fix: Add aggressive cache-busting headers to force fresh search results

Both commits are deployed to production (verified via `git log production`).

---

## Next Steps

1. **Make direct test request** to backend to bypass any frontend caching
2. **Check Render CDN settings** - may need to disable caching for `/api/*` routes
3. **Add unique identifier** to URL path (not just query params) if CDN ignores query strings
4. **Consider** moving to POST requests (less likely to be cached than GET)

---

## Temporary Workaround

None available - filtering is completely broken.

---

## Session Context

Working on staging frontend (main branch) → production backend + database.
Previously fixed OBC calculation to be per-cabin instead of per-cabin-type (commit `0ac7680`).

---

**Last Updated:** 2025-10-31 18:10 PST  
**Next Action:** Test direct backend request to verify it's a caching issue
