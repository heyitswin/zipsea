#!/usr/bin/env node

/**
 * Find all files that failed with null cruise_line_id error
 */

const fs = require('fs');

// Read the sync progress file if it exists
const progressFiles = [
  '.sync-progress.json',
  '.sync-progress-2025-9.json',
  '.sync-progress-2025-10.json',
  '.sync-progress-2025-9-10-11.json'
];

let allFailedFiles = [];

for (const file of progressFiles) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.failedFiles) {
        allFailedFiles = allFailedFiles.concat(data.failedFiles);
      }
    }
  } catch (e) {
    // Ignore
  }
}

// Filter for the specific error
const nullCruiseLineFiles = allFailedFiles
  .filter(f => f.error && f.error.includes('null value in column "cruise_line_id"'))
  .map(f => f.path);

// Also look for files in /2025/09/62 path pattern
const cruise62Files = allFailedFiles
  .filter(f => f.path && f.path.includes('/62/'))
  .map(f => f.path);

// Combine and deduplicate
const allProblematicFiles = [...new Set([...nullCruiseLineFiles, ...cruise62Files])];

console.log('Found problematic files:');
console.log('========================\n');

if (allProblematicFiles.length === 0) {
  // If no progress files, use the known problematic paths
  const knownProblematic = [
    '/2025/09/62/2961/2073554.json',
    '/2025/09/62/2961/2167631.json',
    '/2025/09/62/2962/2073494.json',
    '/2025/09/62/2962/2073495.json',
    '/2025/09/62/2962/2073555.json',
    '/2025/09/62/2963/2166123.json',
    '/2025/09/62/2963/2166124.json'
  ];
  
  console.log('No progress files found. Using known problematic files:');
  knownProblematic.forEach(f => console.log(`  '${f}',`));
  
  // Also scan for more in the same pattern
  console.log('\nLikely additional files in the same directories:');
  console.log('  /2025/09/62/2961/*.json');
  console.log('  /2025/09/62/2962/*.json');
  console.log('  /2025/09/62/2963/*.json');
  console.log('\nTotal known: 7 files');
} else {
  console.log(`Total found: ${allProblematicFiles.length} files\n`);
  
  // Group by cruise line
  const byLine = {};
  allProblematicFiles.forEach(f => {
    const match = f.match(/\/(\d{4})\/(\d{2})\/(\d+)\/(\d+)\//);
    if (match) {
      const lineId = match[3];
      if (!byLine[lineId]) byLine[lineId] = [];
      byLine[lineId].push(f);
    }
  });
  
  // Show grouped
  Object.keys(byLine).forEach(lineId => {
    console.log(`\nCruise Line ${lineId}: ${byLine[lineId].length} files`);
    if (byLine[lineId].length <= 20) {
      byLine[lineId].forEach(f => console.log(`  '${f}',`));
    } else {
      console.log(`  (too many to list, showing first 5)`);
      byLine[lineId].slice(0, 5).forEach(f => console.log(`  '${f}',`));
    }
  });
  
  // Create array for script
  console.log('\n\nArray for fix script:');
  console.log('const problematicFiles = [');
  allProblematicFiles.forEach(f => console.log(`  '${f}',`));
  console.log('];');
}