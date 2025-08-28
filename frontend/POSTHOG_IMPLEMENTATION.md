# PostHog Analytics Implementation

## Overview
PostHog has been fully integrated into the ZipSea platform to track user behavior, conversion funnels, and engagement metrics.

## Key Features Implemented

### 1. **Automatic Page View Tracking**
- Every page navigation is tracked with URL and path information
- Page leave events are captured automatically
- Time on page is calculated and tracked on unmount

### 2. **Cruise Discovery Tracking**
- **Cruise Views**: Tracks when users view cruise details including:
  - Cruise ID, name, and cruise line
  - Number of nights and departure date
  - Starting price and destination
  - First cruise viewed timestamp

### 3. **Quote Funnel Tracking**
- **Quote Start**: Captured when user clicks "Get Quote" button
- **Passenger Selection**: Tracks changes to adult/child counts
- **Discount Qualifiers**: Records selection of discounts and qualifiers
- **Quote Submission**: Complete tracking including:
  - Passenger counts
  - Selected discounts
  - Travel insurance selection
  - Estimated price for conversion value

### 4. **Authentication Events**
- Signup started (with method: email/google/facebook)
- Signup completed
- Login events
- Logout with session reset

### 5. **Search & Discovery**
- Search performed with parameters:
  - Destination/ship selection
  - Departure port
  - Cruise line
  - Date range
  - Results count

### 6. **Session Recording**
- Full session recordings enabled
- Password inputs masked for security
- Email inputs visible for debugging

## Events Reference

### Core Events
```javascript
// Page navigation
$pageview - Automatic page view tracking

// Cruise events
cruise_viewed - User views cruise detail page
time_on_page - Time spent on specific pages

// Quote funnel
quote_started - Quote process initiated
quote_form_progress - Steps within quote form
quote_submitted - Quote successfully submitted
conversion_quote_requested - Conversion event with value

// Authentication
signup_started - User begins signup
signup_completed - Successful signup
login - User logs in
logout - User logs out

// Search
search_performed - Search executed
filter_applied - Filter used

// Engagement
user_engagement - General engagement actions
```

## User Properties
```javascript
{
  identified_at: "2025-08-28T...",
  first_cruise_viewed_at: "2025-08-28T...",
  total_cruises_viewed: 5,
  quotes_requested: 2
}
```

## Configuration

### Environment Setup
```javascript
// PostHog initialization
POSTHOG_KEY = 'phc_9MXhzdvabRIsC3XyL25fQFYM72Mv2YK4HEcaVuX45dd'
POSTHOG_HOST = 'https://us.i.posthog.com'
```

### Key Settings
- **Person Profiles**: `identified_only` - Only creates profiles for logged-in users
- **Autocapture**: Enabled for automatic UI interaction tracking
- **Session Recording**: Enabled with smart input masking
- **Cross-subdomain**: Cookie sharing enabled for consistent tracking

## Usage Examples

### Track Custom Events
```javascript
import { trackEngagement } from '@/lib/analytics';

// Track custom engagement
trackEngagement('feature_used', {
  feature_name: 'advanced_search',
  filters_applied: 3
});
```

### Identify Users
```javascript
import { identifyUser } from '@/lib/analytics';

// After successful authentication
identifyUser(userId, {
  email: user.email,
  name: user.name,
  plan: 'premium'
});
```

### Track Errors
```javascript
import { trackError } from '@/lib/analytics';

try {
  // Your code
} catch (error) {
  trackError(error, {
    context: 'payment_processing',
    user_id: currentUser.id
  });
}
```

## Dashboard Views to Create

1. **Conversion Funnel**
   - Homepage → Cruise View → Quote Start → Quote Submit

2. **User Journey Map**
   - Track typical paths through the site
   - Identify drop-off points

3. **Search Analytics**
   - Most searched destinations
   - Search-to-booking conversion rate

4. **Engagement Metrics**
   - Average cruises viewed per session
   - Time to first quote request
   - Return visitor rate

## Privacy & Compliance

- Password fields are always masked
- No PII in event properties without user consent
- Session recordings can be disabled per user preference
- GDPR-compliant data retention policies

## Testing PostHog

1. **Development Mode**: Console logs enabled for debugging
2. **Session Replay**: View at `https://us.posthog.com/project/YOUR_PROJECT_ID/replay/sessions`
3. **Live Events**: Monitor at `https://us.posthog.com/project/YOUR_PROJECT_ID/activity/explore`

## Next Steps

1. Set up feature flags for A/B testing
2. Create custom dashboards for business metrics
3. Implement cohort analysis for user segments
4. Add revenue tracking for completed bookings
5. Set up alerts for conversion drops

## Support

- PostHog Docs: https://posthog.com/docs
- Session Replay URL: Available via `getSessionReplayUrl()`
- Debug Mode: Set `NODE_ENV=development` for console logging