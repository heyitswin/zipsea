# Journal Entry - September 2, 2025

## Session Date: September 2, 2025

### Work Completed This Session:

#### 1. **Fixed Pricing Schema Type Mismatch**
- **Issue**: Database had cruise_id as VARCHAR but Drizzle ORM schemas had it as INTEGER
- **Impact**: This caused queries to fail and return null, leading to incorrect fallback prices
- **Resolution**: 
  - Updated all schema files (pricing.ts, price-history.ts) to use VARCHAR
  - Updated all service functions to handle cruiseId as string type
  - Ensured consistency between database and ORM schema definitions

#### 2. **Fixed Admin Dashboard Issues**
- **Cruise Lines Table**: Replaced 'Code' column with 'ID' to show database IDs for better reference
- **Quote Responder Modal**: Fixed 500 error where quoteId type was number but should be string/UUID
- **Last Sync Column**: Updated to accurately reflect FTP data sync dates instead of generic timestamps

#### 3. **Fixed Clerk Webhook 500 Error**
- **Issue**: Webhook endpoint was failing due to incorrect payload handling
- **Resolution**: 
  - Added express.raw() middleware for Clerk webhook endpoint
  - Updated handler to work with Buffer payloads for Svix signature verification
  - Ensured proper request body parsing for webhook security validation

#### 4. **Standardized Onboard Credit Calculations**
- **Issue**: Inconsistent OBC calculations between homepage and cruise detail page
- **Resolution**: 
  - Changed cruise detail page OBC calculation to match homepage
  - Now consistently uses 8% rounded DOWN to nearest $10 across all pages
  - Improved user experience with consistent pricing display

#### 5. **Investigated Pricing Discrepancies**
- **Finding**: Our prices ($1,398 interior) don't match Royal Caribbean's current prices ($1,602)
- **Root Cause**: Our data is from Traveltek FTP sync on August 23, 2025
- **Explanation**: Royal Caribbean has since increased prices but we don't have live pricing access
- **Limitation**: Prices can only be updated via new FTP sync from Traveltek

### Key Findings:

#### Database Schema Consistency
- The correct pricing structure IS in the database, just outdated from last FTP sync
- Schema type mismatches can cause silent failures and incorrect fallback behavior
- Always verify actual database column types before making ORM schema changes

#### Pricing Data Limitations
- Cannot manually update prices - must come from Traveltek FTP files
- Price differences are due to dynamic pricing changes since last sync
- We don't have access to live pricing APIs, only batch FTP updates

### Evergreen Notes (Important Reminders):

#### Git Workflow:
- **ALWAYS work on main branch**
- Push to main
- Merge main to production
- Push production
- **NEVER work directly on production branch**

#### Environment Access:
- Can run scripts on Render (production environment)
- Limited access on local development environment
- Database updates should be done carefully and preferably through proper sync processes

#### Pricing Data Management:
- We don't have access to live pricing
- All prices come from Traveltek FTP files
- Use cheapest_xxx price fields for display
- Pricing updates only happen through FTP syncs
- FTP sync schedule and timing affects price accuracy

#### Database Schema Best Practices:
- cruise_id is VARCHAR, not INTEGER across all tables
- Always check actual database types before making schema changes
- Don't manually update pricing data - it should come from FTP syncs
- Maintain consistency between ORM schemas and actual database structure

### Technical Issues Resolved:

#### Type Safety
- Fixed cruise_id type mismatches across pricing and price-history schemas
- Updated service layer to properly handle string-based cruise identifiers
- Ensured consistent typing throughout the application stack

#### Error Handling
- Resolved Clerk webhook 500 errors through proper middleware configuration
- Fixed quote responder modal errors by correcting UUID type handling
- Improved error visibility in admin dashboard

#### Data Consistency
- Standardized OBC calculations across all user-facing pages
- Aligned pricing display logic between different components
- Improved data accuracy in admin dashboard columns

### Next Steps/Recommendations:

#### Immediate Actions:
1. Monitor when next FTP sync runs to get updated pricing data
2. Consider adding a "Prices as of [date]" disclaimer on cruise pages
3. Set up monitoring for FTP sync failures or delays
4. Document the FTP sync schedule and process for team reference

#### Future Improvements:
1. Implement better cache invalidation strategies
2. Add frontend error boundaries for pricing display failures
3. Consider implementing price change notifications for significant updates
4. Explore options for more frequent pricing updates if business requirements change

### Technical Debt Identified:

#### Pricing System Limitations:
- No live pricing integration (limitation of current Traveltek setup)
- Dependency on batch FTP sync creates stale pricing risk
- Limited visibility into pricing update frequency and reliability

#### Frontend Improvements Needed:
- Error boundaries for pricing display could be enhanced
- User feedback mechanisms for price accuracy concerns
- Better loading states during pricing data retrieval

#### Monitoring and Observability:
- FTP sync monitoring could be more comprehensive
- Price change tracking and alerting system needed
- Admin dashboard could benefit from more detailed sync status information

### System Architecture Notes:

#### Data Flow:
- Traveltek FTP → Batch Sync → PostgreSQL → Redis Cache → API → Frontend
- Single point of failure at FTP sync level for pricing accuracy
- Cache warming helps performance but doesn't solve stale data issues

#### Dependencies:
- Critical dependency on Traveltek FTP sync timing and reliability
- Clerk webhook system for user management
- Redis for caching and performance optimization
- PostgreSQL as primary data store with specific VARCHAR requirements

---

**Session Duration**: ~4 hours
**Files Modified**: Multiple schema files, service files, admin dashboard components
**Environment**: Production (Render), Local development
**Database Changes**: Schema type corrections, no data loss
**Deployment Status**: All fixes deployed and verified in production