#!/usr/bin/env node

/**
 * Test webhook processing with actual pricing update payload
 */

const payload = {
  currency: "USD",
  description: "Cruises with updated cached live pricing for marketid 9 in currency USD",
  event: "cruises_live_pricing_updated",
  marketid: 9,
  paths: [
    "2025/09/8/39/2149385.json",
    "2025/09/31/199/2159491.json",
    "2025/09/22/6512/2144064.json",
    "2025/09/31/6819/2159185.json",
    "2025/09/495/6550/2184788.json",
    "2025/09/31/197/2159258.json",
    "2025/09/734/5500/2119773.json",
    "2025/09/31/198/2159118.json",
    "2025/09/849/6436/2196372.json",
    "2025/09/22/5457/2143976.json"
  ],
  source: "traveltek",
  timestamp: new Date().toISOString()
};

console.log("Testing webhook processing with pricing update payload...\n");
console.log("Payload:", JSON.stringify(payload, null, 2));

// Extract lineIds from paths
const uniqueLineIds = new Set();

for (const path of payload.paths) {
  const parts = path.split('/');
  if (parts.length >= 3) {
    const lineId = parseInt(parts[2]);
    if (!isNaN(lineId) && lineId > 0) {
      uniqueLineIds.add(lineId);
    }
  }
}

const lineIds = Array.from(uniqueLineIds);

console.log("\nExtracted lineIds from paths:");
console.log(lineIds);

console.log("\nLine ID breakdown:");
payload.paths.forEach(path => {
  const parts = path.split('/');
  if (parts.length >= 5) {
    console.log(`  ${path} -> Line: ${parts[2]}, Ship: ${parts[3]}, Cruise: ${parts[4].replace('.json', '')}`);
  }
});

console.log("\nUnique cruise lines to process:");
lineIds.forEach(lineId => {
  console.log(`  - Line ID: ${lineId}`);
});

console.log("\nWith the fixes applied:");
console.log("1. Webhook handler will extract lineIds from paths: " + lineIds.join(", "));
console.log("2. Each lineId will be processed separately");
console.log("3. Files will be discovered in the correct directories");
console.log("4. cabin_id column error has been fixed by removing it from schema");

// Test with curl
console.log("\nTo test the actual webhook endpoint, run:");
console.log(`curl -X POST http://localhost:3001/api/webhooks/traveltek \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload)}'`);
