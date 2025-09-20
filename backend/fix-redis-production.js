const fs = require('fs');
const path = require('path');

console.log('===== FIXING REDIS CONNECTION ISSUE IN PRODUCTION =====');
console.log('The error shows backend is trying to connect to localhost:6379');
console.log('This means process.env.REDIS_URL is undefined in production');
console.log('We need to use env module which properly validates environment variables\n');

// Fix webhook-processor-optimized-v2.service.ts
const file1Path = path.join(__dirname, 'src/services/webhook-processor-optimized-v2.service.ts');
console.log('Fixing:', file1Path);

let content1 = fs.readFileSync(file1Path, 'utf8');

// Add import statement if not present
if (!content1.includes("import { env }")) {
  content1 = content1.replace(
    "import * as crypto from 'crypto';",
    "import * as crypto from 'crypto';\nimport { env } from '../config/environment';"
  );
}

// Replace process.env references
content1 = content1.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');
content1 = content1.replace(/process\.env\.TRAVELTEK_FTP_HOST/g, 'env.TRAVELTEK_FTP_HOST');
content1 = content1.replace(/process\.env\.TRAVELTEK_FTP_USER \|\| process\.env\.FTP_USER/g, 'env.TRAVELTEK_FTP_USER');
content1 = content1.replace(/process\.env\.TRAVELTEK_FTP_PASSWORD \|\| process\.env\.FTP_PASSWORD/g, 'env.TRAVELTEK_FTP_PASSWORD');

fs.writeFileSync(file1Path, content1);
console.log('✅ Fixed webhook-processor-optimized-v2.service.ts\n');

// Fix redis-maintenance.service.ts
const file2Path = path.join(__dirname, 'src/services/redis-maintenance.service.ts');
console.log('Fixing:', file2Path);

let content2 = fs.readFileSync(file2Path, 'utf8');

// Add import at the beginning
if (!content2.includes("import { env }")) {
  content2 = "import { env } from '../config/environment';\n" + content2;
}

// Replace process.env references
content2 = content2.replace(/process\.env\.REDIS_URL!/g, 'env.REDIS_URL!');
content2 = content2.replace(/process\.env\.REDIS_URL \?/g, 'env.REDIS_URL ?');

fs.writeFileSync(file2Path, content2);
console.log('✅ Fixed redis-maintenance.service.ts\n');

// Fix webhook-stats-tracker.ts
const file3Path = path.join(__dirname, 'src/services/webhook-stats-tracker.ts');
if (fs.existsSync(file3Path)) {
  console.log('Fixing:', file3Path);

  let content3 = fs.readFileSync(file3Path, 'utf8');

  // Check if it uses process.env.REDIS_URL
  if (content3.includes('process.env.REDIS_URL')) {
    // Add import if not present
    if (!content3.includes("import { env }")) {
      // Find a good place to add the import
      const importIndex = content3.indexOf('import ');
      if (importIndex !== -1) {
        const lineEnd = content3.indexOf('\n', importIndex);
        content3 = content3.slice(0, lineEnd + 1) +
                  "import { env } from '../config/environment';\n" +
                  content3.slice(lineEnd + 1);
      }
    }

    // Replace process.env references
    content3 = content3.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

    fs.writeFileSync(file3Path, content3);
    console.log('✅ Fixed webhook-stats-tracker.ts\n');
  } else {
    console.log('ℹ️ No process.env.REDIS_URL found in webhook-stats-tracker.ts\n');
  }
}

// Fix webhook-processor-fixed.service.ts
const file4Path = path.join(__dirname, 'src/services/webhook-processor-fixed.service.ts');
if (fs.existsSync(file4Path)) {
  console.log('Fixing:', file4Path);

  let content4 = fs.readFileSync(file4Path, 'utf8');

  if (content4.includes('process.env.REDIS_URL')) {
    // Add import if not present
    if (!content4.includes("import { env }")) {
      const importIndex = content4.indexOf('import ');
      if (importIndex !== -1) {
        const lineEnd = content4.indexOf('\n', importIndex);
        content4 = content4.slice(0, lineEnd + 1) +
                  "import { env } from '../config/environment';\n" +
                  content4.slice(lineEnd + 1);
      }
    }

    content4 = content4.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

    fs.writeFileSync(file4Path, content4);
    console.log('✅ Fixed webhook-processor-fixed.service.ts\n');
  }
}

// Fix webhook-processor-optimized.service.ts
const file5Path = path.join(__dirname, 'src/services/webhook-processor-optimized.service.ts');
if (fs.existsSync(file5Path)) {
  console.log('Fixing:', file5Path);

  let content5 = fs.readFileSync(file5Path, 'utf8');

  if (content5.includes('process.env.REDIS_URL')) {
    // Add import if not present
    if (!content5.includes("import { env }")) {
      const importIndex = content5.indexOf('import ');
      if (importIndex !== -1) {
        const lineEnd = content5.indexOf('\n', importIndex);
        content5 = content5.slice(0, lineEnd + 1) +
                  "import { env } from '../config/environment';\n" +
                  content5.slice(lineEnd + 1);
      }
    }

    content5 = content5.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

    fs.writeFileSync(file5Path, content5);
    console.log('✅ Fixed webhook-processor-optimized.service.ts\n');
  }
}

// Fix webhook-processor-robust.service.ts
const file6Path = path.join(__dirname, 'src/services/webhook-processor-robust.service.ts');
if (fs.existsSync(file6Path)) {
  console.log('Fixing:', file6Path);

  let content6 = fs.readFileSync(file6Path, 'utf8');

  if (content6.includes('process.env.REDIS_URL')) {
    // Add import if not present
    if (!content6.includes("import { env }")) {
      const importIndex = content6.indexOf('import ');
      if (importIndex !== -1) {
        const lineEnd = content6.indexOf('\n', importIndex);
        content6 = content6.slice(0, lineEnd + 1) +
                  "import { env } from '../config/environment';\n" +
                  content6.slice(lineEnd + 1);
      }
    }

    content6 = content6.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

    fs.writeFileSync(file6Path, content6);
    console.log('✅ Fixed webhook-processor-robust.service.ts\n');
  }
}

console.log('\n===== ALL FILES FIXED! =====\n');
console.log('The issue was that services were using process.env.REDIS_URL directly');
console.log('instead of using the env module which validates the environment variables.\n');
console.log('When REDIS_URL is not set, process.env.REDIS_URL is undefined,');
console.log('causing the fallback to localhost:6379.\n');
console.log('Next steps:');
console.log('1. Build the backend: npm run build');
console.log('2. Test locally if possible');
console.log('3. Commit and push to production');
console.log('4. The production deployment will use the REDIS_URL from Render environment');
