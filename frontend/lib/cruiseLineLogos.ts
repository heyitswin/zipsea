/**
 * Maps cruise line names to their logo filenames
 * All logos are stored in /public/images/cruise-logos/
 * Updated: Oct 23, 2025
 */
export function getCruiseLineLogo(cruiseLineName: string): string {
  // Normalize the cruise line name to lowercase for matching
  const normalized = cruiseLineName.toLowerCase().trim();

  // Map cruise line names to logo filenames
  const logoMap: Record<string, string> = {
    ama: "amawaterways.png",
    amawaterways: "amawaterways.png",
    "ama waterways": "amawaterways.png",
    azamara: "azamara.png",
    carnival: "carnival.png",
    "carnival cruise line": "carnival.png",
    "carnival cruises": "carnival.png",
    celebrity: "celebrity.png",
    "celebrity cruises": "celebrity.png",
    crystal: "crystal.png",
    "crystal cruises": "crystal.png",
    cunard: "cunard.png",
    "cunard line": "cunard.png",
    disney: "disney.png",
    "disney cruise line": "disney.png",
    explora: "explora.png",
    "explora journeys": "explora.png",
    holland: "holland.png",
    "holland america": "holland.png",
    "holland america line": "holland.png",
    msc: "msc.png",
    "msc cruises": "msc.png",
    "msc cruises sa": "msc.png",
    "national geographic": "nationalgeographic.png",
    lindblad: "nationalgeographic.png",
    norwegian: "norwegian.png",
    "norwegian cruise line": "norwegian.png",
    ncl: "norwegian.png",
    oceania: "oceania.png",
    "oceania cruises": "oceania.png",
    princess: "princess.png",
    "princess cruises": "princess.png",
    regent: "regent.png",
    "regent seven seas": "regent.png",
    "regent seven seas cruises": "regent.png",
    royal: "royal.png",
    "royal caribbean": "royal.png",
    "royal caribbean international": "royal.png",
    rccl: "royal.png",
    seabourn: "seabourn.png",
    "seabourn cruise line": "seabourn.png",
    silversea: "silversea.png",
    "silversea cruises": "silversea.png",
    uniworld: "uniworld.png",
    "uniworld river cruises": "uniworld.png",
    viking: "viking.png",
    "viking cruises": "viking.png",
    "viking ocean": "viking.png",
    "viking ocean cruises": "viking.png",
    virgin: "virgin.png",
    "virgin voyages": "virgin.png",
    windstar: "windstar.png",
    "windstar cruises": "windstar.png",
  };

  // Check for exact match first
  if (logoMap[normalized]) {
    return `/images/cruise-logos/${logoMap[normalized]}`;
  }

  // Check for partial matches (cruise line name contains key)
  for (const [key, filename] of Object.entries(logoMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return `/images/cruise-logos/${filename}`;
    }
  }

  // Default fallback - return empty string if no match
  // The component should handle this by not rendering an image
  return "";
}
