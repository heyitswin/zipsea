/**
 * Cruise Line ID Mapping Configuration
 * 
 * CRITICAL ISSUE DISCOVERED:
 * The sync script used root-level `lineid` from FTP paths to populate cruise_lines.id
 * But Traveltek webhooks send `linecontent.id` which can be DIFFERENT!
 * 
 * Example:
 * - Royal Caribbean in FTP: /2025/09/22/... (lineid = "22")
 * - Royal Caribbean webhook: sends lineid = 3 (linecontent.id)
 * - Database stored: cruise_lines.id = 22
 * - Result: Webhooks can't find cruises to update!
 * 
 * This mapping translates webhook line IDs to database line IDs
 */

export const CRUISE_LINE_ID_MAPPING: Record<number, number> = {
  // Webhook ID -> Database ID
  // Format: [what Traveltek sends]: [what's in our database]
  
  // Verified mismatches:
  3: 22,    // Royal Caribbean: webhook sends 3, database has 22
  
  // These might be correct but need verification:
  1: 1,     // P&O Cruises: appears to match
  21: 21,   // Virgin Voyages: needs verification
  
  // Add more mappings as we discover them
};

/**
 * Get the database cruise line ID from a webhook line ID
 */
export function getDatabaseLineId(webhookLineId: number): number {
  return CRUISE_LINE_ID_MAPPING[webhookLineId] || webhookLineId;
}

/**
 * Known cruise line names for reference
 */
export const CRUISE_LINE_NAMES: Record<number, string> = {
  1: 'P&O Cruises',
  3: 'Celebrity Cruises',  // In our database
  5: 'Cunard',
  8: 'Carnival Cruise Line',
  9: 'Costa Cruises',
  10: 'Crystal Cruises',
  22: 'Royal Caribbean',   // In our database
  // Add more as needed
};