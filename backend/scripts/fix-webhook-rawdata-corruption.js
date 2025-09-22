/**
 * Fix for webhook processor to prevent raw_data corruption
 * This patch ensures raw_data is always stored as a proper JSON object,
 * not as a character array
 */

const fs = require('fs');
const path = require('path');

const WEBHOOK_V2_PATH = path.join(__dirname, '../src/services/webhook-processor-optimized-v2.service.ts');

// Read the current file
const currentContent = fs.readFileSync(WEBHOOK_V2_PATH, 'utf8');

// Find the line where rawData is set in the cruise insert (around line 1253)
const insertPattern = /rawData: data,/g;
const updatePattern = /rawData: updatedRawJson,/g;

// Create the validation function to add
const validationFunction = `
  /**
   * Ensure raw_data is a proper object, not a string or character array
   * This prevents the corruption where JSON strings get stored as character arrays
   */
  private ensureValidRawData(data: any): any {
    // If data is a string, parse it
    if (typeof data === 'string') {
      try {
        console.warn('[OPTIMIZED-V2] WARNING: rawData was a string, parsing to object');
        return JSON.parse(data);
      } catch (e) {
        console.error('[OPTIMIZED-V2] ERROR: Could not parse rawData string:', e);
        return {};
      }
    }

    // If data looks like a character array (has numeric string keys)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Check for character array pattern
      if (data['0'] !== undefined && data['1'] !== undefined &&
          typeof data['0'] === 'string' && data['0'].length === 1) {
        console.warn('[OPTIMIZED-V2] WARNING: Detected character array in rawData, reconstructing');

        // Reconstruct the JSON string
        let jsonString = '';
        let i = 0;
        const maxChars = 10000000; // Safety limit

        while (data[i.toString()] !== undefined && i < maxChars) {
          jsonString += data[i.toString()];
          i++;
        }

        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error('[OPTIMIZED-V2] ERROR: Could not parse reconstructed JSON:', e);
          return {};
        }
      }
    }

    // Data is already a proper object
    return data;
  }
`;

// Check if the function already exists
if (!currentContent.includes('ensureValidRawData')) {
  console.log('Adding ensureValidRawData function to webhook processor...');

  // Find a good place to insert the function (before processFile method)
  const insertPosition = currentContent.indexOf('private async processFile(');
  if (insertPosition === -1) {
    console.error('Could not find processFile method to insert before');
    process.exit(1);
  }

  // Insert the validation function
  const newContent =
    currentContent.slice(0, insertPosition) +
    validationFunction + '\n\n  ' +
    currentContent.slice(insertPosition);

  // Replace rawData assignments to use the validation
  let finalContent = newContent.replace(
    /rawData: data,/g,
    'rawData: this.ensureValidRawData(data),'
  );

  finalContent = finalContent.replace(
    /rawData: updatedRawJson,/g,
    'rawData: this.ensureValidRawData(updatedRawJson),'
  );

  // Write the updated file
  fs.writeFileSync(WEBHOOK_V2_PATH, finalContent, 'utf8');

  console.log('✅ Successfully patched webhook-processor-optimized-v2.service.ts');
  console.log('Changes made:');
  console.log('1. Added ensureValidRawData() method to validate raw_data before storage');
  console.log('2. Updated rawData assignments to use validation');
  console.log('');
  console.log('This will prevent new syncs from creating corrupted character array data.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Commit and push these changes to main branch');
  console.log('2. Deploy to staging (auto-deploy)');
  console.log('3. Test with a webhook to verify no corruption');
  console.log('4. Merge to production branch and deploy');
} else {
  console.log('✅ ensureValidRawData function already exists in webhook processor');

  // Check if it's being used
  if (!currentContent.includes('this.ensureValidRawData(data)')) {
    console.log('⚠️  WARNING: Function exists but not being used. Updating usage...');

    let finalContent = currentContent.replace(
      /rawData: data,/g,
      'rawData: this.ensureValidRawData(data),'
    );

    finalContent = finalContent.replace(
      /rawData: updatedRawJson,/g,
      'rawData: this.ensureValidRawData(updatedRawJson),'
    );

    fs.writeFileSync(WEBHOOK_V2_PATH, finalContent, 'utf8');
    console.log('✅ Updated rawData assignments to use validation');
  } else {
    console.log('✅ Validation is already being used');
  }
}

// Also check other webhook processors
const otherProcessors = [
  'webhook-queue.service.ts',
  'webhook-batch-processor.service.ts',
  'webhook-processor-production.service.ts',
  'webhook-processor-fast.service.ts'
];

console.log('\n📋 Other webhook processors that may need the same fix:');
for (const processor of otherProcessors) {
  const processorPath = path.join(__dirname, '../src/services/', processor);
  if (fs.existsSync(processorPath)) {
    const content = fs.readFileSync(processorPath, 'utf8');
    if (content.includes('rawData: data,') && !content.includes('ensureValidRawData')) {
      console.log(`  ⚠️  ${processor} - needs fix`);
    } else if (content.includes('ensureValidRawData')) {
      console.log(`  ✅ ${processor} - already fixed`);
    } else {
      console.log(`  ℹ️  ${processor} - may not need fix`);
    }
  }
}

console.log('\n📌 Remember to:');
console.log('1. Run the fix-all-corrupted-rawdata.js script to fix existing corrupted data');
console.log('2. Monitor new syncs with test-current-sync-corruption.js after deployment');
