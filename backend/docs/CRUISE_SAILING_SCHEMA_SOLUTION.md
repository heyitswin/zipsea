# Cruise/Sailing Schema Solution

## Problem Statement

The current database schema uses Traveltek's `cruiseid` as the PRIMARY KEY, but multiple sailings can share the same `cruiseid` with different `codetocruiseid` values. This causes:

1. **Duplicate key violations** when inserting multiple sailings of the same cruise
2. **Inability to store all sailing dates** for a cruise with the same ship/itinerary
3. **Poor user experience** as customers can't see alternative sailing dates
4. **Data integrity issues** with foreign key relationships

## Recommended Solution

### **Schema Design: Two-Table Separation**

**1. `cruise_definitions` Table**
- Stores unique cruise products (ship + itinerary combination)
- Uses UUID primary key for stability
- Contains cruise metadata that's shared across all sailings
- One record per unique cruise product

**2. `cruise_sailings` Table**  
- Stores individual sailing instances with specific dates
- References `cruise_definitions` via foreign key
- Uses `code_to_cruise_id` as unique identifier (from Traveltek)
- One record per sailing date

### **Key Benefits**

✅ **Eliminates duplicate key violations**  
✅ **Enables multiple sailings per cruise**  
✅ **Improves search for alternative dates**  
✅ **Maintains referential integrity**  
✅ **Backward compatibility via views**  
✅ **Better performance with targeted indexes**

## Implementation Details

### **1. Database Migration**

```sql
-- Create new tables
CREATE TABLE cruise_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traveltek_cruise_id integer NOT NULL,
  cruise_line_id integer NOT NULL,
  ship_id integer NOT NULL,
  name varchar(255) NOT NULL,
  -- ... other cruise metadata
);

CREATE TABLE cruise_sailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_definition_id uuid REFERENCES cruise_definitions(id),
  code_to_cruise_id integer UNIQUE NOT NULL,
  sailing_date date NOT NULL,
  -- ... sailing-specific data
);
```

**Migration Script:** `/scripts/migrate-cruise-sailing-separation.js`
**SQL File:** `/src/db/migrations/0004_cruise_sailing_separation.sql`

### **2. Performance Optimizations**

**Strategic Indexes:**
```sql
-- Cruise definitions
CREATE INDEX idx_cruise_definitions_traveltek_cruise_id ON cruise_definitions(traveltek_cruise_id);
CREATE INDEX idx_cruise_definitions_cruise_line_ship ON cruise_definitions(cruise_line_id, ship_id);

-- Cruise sailings  
CREATE INDEX idx_cruise_sailings_cruise_definition_id ON cruise_sailings(cruise_definition_id);
CREATE INDEX idx_cruise_sailings_sailing_date ON cruise_sailings(sailing_date);
CREATE INDEX idx_cruise_sailings_sailing_date_range ON cruise_sailings(sailing_date) WHERE sailing_date >= CURRENT_DATE;
```

### **3. Backward Compatibility**

**Legacy View:**
```sql
CREATE VIEW cruise_sailings_legacy AS
SELECT 
  c.id,
  cs.code_to_cruise_id,
  cd.cruise_line_id,
  cd.ship_id,
  cd.name,
  cs.sailing_date,
  -- ... all original fields
FROM cruises c
JOIN cruise_sailings cs ON c.code_to_cruise_id = CAST(cs.code_to_cruise_id AS VARCHAR)
JOIN cruise_definitions cd ON cd.id = cs.cruise_definition_id;
```

## Common Use Cases

### **1. Find Alternative Sailing Dates**

```sql
SELECT 
  cd.name,
  cs.sailing_date,
  cp.cheapest_price
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cd.traveltek_cruise_id = 12345
  AND cs.sailing_date >= CURRENT_DATE
ORDER BY cs.sailing_date;
```

### **2. Search with Flexible Dates**

```sql
SELECT 
  cd.name,
  cl.name as cruise_line,
  array_agg(cs.sailing_date ORDER BY cs.sailing_date) as available_dates,
  MIN(cp.cheapest_price) as best_price
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
JOIN cruise_lines cl ON cl.id = cd.cruise_line_id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cs.sailing_date BETWEEN '2024-06-01' AND '2024-09-30'
  AND cd.nights = 7
GROUP BY cd.id, cd.name, cl.name
ORDER BY best_price;
```

### **3. Price Comparison Across Dates**

```sql
WITH price_comparison AS (
  SELECT 
    cd.name,
    cs.sailing_date,
    cp.cheapest_price,
    ROW_NUMBER() OVER (PARTITION BY cd.id ORDER BY cp.cheapest_price) as price_rank
  FROM cruise_definitions cd
  JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
  LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
  WHERE cs.sailing_date >= CURRENT_DATE
)
SELECT * FROM price_comparison WHERE price_rank <= 3;
```

## Service Layer Updates

### **New Service: `CruiseSailingService`**

```typescript
// Find all sailings for a cruise
async findSailingsByCruiseDefinition(cruiseDefinitionId: string): Promise<CruiseDefinitionWithSailings>

// Find alternative sailing dates
async findAlternativeSailings(traveltekCruiseId: number): Promise<CruiseDefinitionWithSailings[]>

// Search with advanced criteria
async searchSailings(criteria: SailingSearchCriteria): Promise<SearchResult>

// Get specific sailing details
async getSailingByCodeToCruiseId(codeToCruiseId: number): Promise<CruiseDefinitionWithSailings>
```

## Migration Strategy

### **Phase 1: Schema Migration**
1. Run migration script to create new tables
2. Migrate existing data
3. Update foreign key references
4. Create compatibility views

### **Phase 2: Application Updates**
1. Update sync services to use new schema
2. Modify search APIs to leverage new structure
3. Update booking flows for sailing selection
4. Test all existing functionality

### **Phase 3: Optimization**
1. Monitor query performance
2. Add additional indexes as needed
3. Deprecate legacy cruises table
4. Optimize for most common search patterns

## Impact Analysis

### **Database Impact**
- **Storage:** ~30% increase due to normalization
- **Query Performance:** Significant improvement for date-based searches
- **Maintenance:** Easier to manage cruise definitions vs sailings

### **API Impact**
- **Search API:** Enhanced with alternative sailing support
- **Booking API:** Requires sailing-specific IDs
- **Backward Compatibility:** Maintained via views

### **User Experience Impact**
- **Enhanced Search:** Users can see all available sailing dates
- **Better Pricing:** Compare prices across different dates
- **Improved UX:** No more "sold out" when alternative dates exist

## Testing Strategy

### **Data Integrity Tests**
```sql
-- Verify no orphaned sailings
SELECT COUNT(*) FROM cruise_sailings cs
LEFT JOIN cruise_definitions cd ON cd.id = cs.cruise_definition_id
WHERE cd.id IS NULL;

-- Verify pricing references
SELECT COUNT(*) FROM pricing p
LEFT JOIN cruise_sailings cs ON cs.id = p.cruise_sailing_id
WHERE p.cruise_sailing_id IS NOT NULL AND cs.id IS NULL;
```

### **Performance Tests**
- Alternative sailing queries (<50ms)
- Search with date ranges (<100ms)
- Price comparison queries (<75ms)

### **Functional Tests**
- Sync process with new schema
- Search API with multiple sailings
- Booking flow with sailing selection

## Rollback Plan

If issues arise:

1. **Immediate:** Use legacy `cruises` table and disable new features
2. **Short-term:** Restore from backup before migration
3. **Long-term:** Fix issues and re-run migration

## Files Created

1. **Schema Updates:** `/src/db/schema/cruises.ts`
2. **Migration SQL:** `/src/db/migrations/0004_cruise_sailing_separation.sql`
3. **Migration Script:** `/scripts/migrate-cruise-sailing-separation.js`
4. **New Service:** `/src/services/cruise-sailing.service.ts`
5. **Example Queries:** `/examples/cruise-sailing-queries.sql`

## Next Steps

1. **Review and approve** this schema design
2. **Test migration** on staging environment
3. **Update application code** to use new service
4. **Run migration** on production
5. **Monitor performance** and optimize as needed

This solution provides a robust, scalable foundation for handling cruise data while solving the immediate duplicate key problem and enabling powerful new search capabilities.