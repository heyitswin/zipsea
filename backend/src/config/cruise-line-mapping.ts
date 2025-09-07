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

  // CRITICAL FIX: Removed incorrect 3->22 mapping
  // Based on FTP server verification:
  // - Line ID 3 = Celebrity Cruises (webhook 3 = database 3, no mapping needed)
  // - Line ID 22 = Royal Caribbean (webhook 22 = database 22, no mapping needed)

  // Confirmed mappings:
  15: 15, // Holland America Line: webhook and database both use 15

  // These might be correct but need verification:
  1: 1, // P&O Cruises: appears to match
  21: 21, // Virgin Voyages: needs verification

  // Add more mappings as we discover them
};

/**
 * Get the database cruise line ID from a webhook line ID
 */
export function getDatabaseLineId(webhookLineId: number): number {
  return CRUISE_LINE_ID_MAPPING[webhookLineId] || webhookLineId;
}

/**
 * Get the webhook line ID from a database line ID (reverse mapping)
 * This is used for FTP path construction since FTP uses webhook line IDs
 */
export function getWebhookLineId(databaseLineId: number): number {
  // Find the webhook ID that maps to this database ID
  for (const [webhookId, dbId] of Object.entries(CRUISE_LINE_ID_MAPPING)) {
    if (dbId === databaseLineId) {
      const result = parseInt(webhookId);
      // Removed console.log - it was causing performance issues and log spam
      return result;
    }
  }
  // If no mapping found, assume they're the same
  return databaseLineId;
}

/**
 * Known cruise line names for reference
 */
export const CRUISE_LINE_NAMES: Record<number, string> = {
  1: 'P&O Cruises',
  3: 'Celebrity Cruises', // In our database
  5: 'Cunard',
  8: 'Carnival Cruise Line',
  9: 'Costa Cruises',
  10: 'Crystal Cruises',
  15: 'Holland America Line', // Line 15 - confirmed
  22: 'Royal Caribbean', // In our database
  // Add more as needed
};
