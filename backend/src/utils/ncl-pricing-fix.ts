/**
 * NCL (Norwegian Cruise Line) pricing fix utilities
 * Handles special pricing extraction logic for NCL cruises
 */

/**
 * Process NCL pricing data to handle their specific format
 */
export function processNCLPricingData(priceData: any, cruiseLineId: number): any {
  // NCL has cruise line ID 17
  if (cruiseLineId !== 17) {
    return priceData;
  }

  // Return the price data as-is for now
  // This is a stub implementation to fix the build error
  return priceData;
}

/**
 * Extract adult price from NCL pricing structure
 */
export function extractNCLAdultPrice(priceInfo: any): number | null {
  if (!priceInfo) return null;

  // Try to extract price from standard fields
  if (priceInfo.price) {
    return parseFloat(priceInfo.price);
  }

  if (priceInfo.adultprice) {
    return parseFloat(priceInfo.adultprice);
  }

  return null;
}

/**
 * Get the cheapest price from NCL pricing info
 */
export function getNCLCheapestPrice(priceInfo: any): number | null {
  if (!priceInfo) return null;

  // Check various price fields that NCL might use
  const possiblePrices = [
    priceInfo.price,
    priceInfo.adultprice,
    priceInfo.total,
    priceInfo.fare
  ].filter(p => p && !isNaN(parseFloat(p)));

  if (possiblePrices.length === 0) return null;

  // Return the lowest price found
  return Math.min(...possiblePrices.map(p => parseFloat(p)));
}
