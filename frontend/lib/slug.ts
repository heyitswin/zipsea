/**
 * Slug generation and parsing utilities for cruise URLs
 * Format: /cruise/[ship-name]-[departure-date]-[cruise-id]
 * Example: /cruise/symphony-of-the-seas-2025-10-05-2143102
 */

export interface CruiseSlugData {
  shipName: string;
  departureDate: string; // YYYY-MM-DD format
  cruiseId: number;
}

export interface ParsedSlug extends CruiseSlugData {
  originalSlug: string;
}

/**
 * Normalize text for URL slugs
 */
export function normalizeForSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate SEO-friendly slug for a cruise
 */
export function generateCruiseSlug(cruiseSlugData: CruiseSlugData): string {
  const { shipName, departureDate, cruiseId } = cruiseSlugData;

  const normalizedShipName = normalizeForSlug(shipName);
  const slug = `${normalizedShipName}-${departureDate}-${cruiseId}`;

  return slug;
}

/**
 * Parse a cruise slug back to its components
 */
export function parseCruiseSlug(slug: string): ParsedSlug | null {
  try {
    // Remove any leading/trailing slashes or spaces
    const cleanSlug = slug.trim().replace(/^\/|\/$/g, "");

    // Pattern: ship-name-parts-YYYY-MM-DD-cruiseId
    // We need to work backwards from the cruise ID and date
    const parts = cleanSlug.split("-");

    if (parts.length < 4) {
      return null; // Not enough parts
    }

    // Extract cruise ID (last part)
    const cruiseId = parseInt(parts[parts.length - 1], 10);
    if (isNaN(cruiseId)) {
      return null;
    }

    // Extract date parts (YYYY-MM-DD format, so last 4 parts including cruise ID)
    if (parts.length < 4) {
      return null;
    }

    const year = parts[parts.length - 4];
    const month = parts[parts.length - 3];
    const day = parts[parts.length - 2];

    // Validate date parts
    if (
      !/^\d{4}$/.test(year) ||
      !/^\d{2}$/.test(month) ||
      !/^\d{2}$/.test(day)
    ) {
      return null;
    }

    const departureDate = `${year}-${month}-${day}`;

    // Validate the date
    const dateObj = new Date(departureDate);
    if (dateObj.toISOString().split("T")[0] !== departureDate) {
      return null;
    }

    // Extract ship name (everything before the date parts)
    const shipNameParts = parts.slice(0, parts.length - 4);
    if (shipNameParts.length === 0) {
      return null;
    }

    const shipName = shipNameParts.join("-");

    return {
      originalSlug: cleanSlug,
      shipName,
      departureDate,
      cruiseId,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Validate if a cruise slug is properly formatted
 */
export function isValidCruiseSlug(slug: string): boolean {
  const parsed = parseCruiseSlug(slug);
  return parsed !== null;
}

/**
 * Create a slug from cruise data
 */
export function createSlugFromCruise(cruise: {
  id: string | number;
  shipName?: string;
  ship_name?: string;
  sailingDate?: string;
  sailing_date?: string;
  departureDate?: string;
  departure_date?: string;
}): string {
  const shipName = cruise.shipName || cruise.ship_name || "unknown-ship";
  const departureDate =
    cruise.sailingDate ||
    cruise.sailing_date ||
    cruise.departureDate ||
    cruise.departure_date;

  if (!departureDate) {
    throw new Error("No departure date found in cruise data");
  }

  return generateCruiseSlug({
    shipName,
    departureDate: departureDate.split("T")[0], // Extract YYYY-MM-DD from full datetime
    cruiseId:
      typeof cruise.id === "string" ? parseInt(cruise.id, 10) : cruise.id,
  });
}

/**
 * Generate alternative slug variations for better matching
 * Useful for handling slight variations in ship names
 */
export function generateSlugVariations(
  shipName: string,
  departureDate: string,
  cruiseId: number,
): string[] {
  const variations: string[] = [];

  // Original slug
  const originalSlug = generateCruiseSlug({
    shipName,
    departureDate,
    cruiseId,
  });
  variations.push(originalSlug);

  // Variations with common ship name transformations
  const nameVariations = [
    shipName.replace(/\s+of\s+the\s+/gi, "-of-the-"),
    shipName.replace(/\s+of\s+/gi, "-of-"),
    shipName.replace(/\s+the\s+/gi, "-the-"),
    shipName.replace(/\s+&\s+/gi, "-and-"),
    shipName.replace(/\s+\+\s+/gi, "-plus-"),
  ];

  nameVariations.forEach((variation) => {
    if (variation !== shipName) {
      const varSlug = generateCruiseSlug({
        shipName: variation,
        departureDate,
        cruiseId,
      });
      if (!variations.includes(varSlug)) {
        variations.push(varSlug);
      }
    }
  });

  return variations;
}
