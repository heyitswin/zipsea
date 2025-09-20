const fs = require('fs');
const path = require('path');

// List of files that need fixing
const filesToFix = [
  'src/services/webhook-processor-optimized-v2.service.ts',
  'src/services/redis-maintenance.service.ts',
  'src/services/webhook-stats-tracker.ts',
  'src/services/webhook-processor-robust.service.ts',
  'src/services/webhook-processor-fixed.service.ts',
  'src/services/webhook-processor-optimized.service.ts',
];

console.log('Fixing Redis URL configuration in backend services...');

filesToFix.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if env import is already present
  const hasEnvImport = content.includes("import { env } from '../config/environment'");

  // Add env import if not present
  if (!hasEnvImport && content.includes('process.env.')) {
    // Find the right place to add import (after other imports)
    const importRegex = /^import .* from ['"].*['"];?$/gm;
    const imports = content.match(importRegex) || [];

    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;

      content =
        content.slice(0, insertPosition) +
        "\nimport { env } from '../config/environment';" +
        content.slice(insertPosition);
      modified = true;
      console.log(`Added env import to ${file}`);
    }
  }

  // Replace process.env.REDIS_URL with env.REDIS_URL
  if (content.includes('process.env.REDIS_URL')) {
    content = content.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');
    modified = true;
    console.log(`Fixed REDIS_URL in ${file}`);
  }

  // Replace process.env.TRAVELTEK_FTP_HOST with env.TRAVELTEK_FTP_HOST
  if (content.includes('process.env.TRAVELTEK_FTP_HOST')) {
    content = content.replace(/process\.env\.TRAVELTEK_FTP_HOST/g, 'env.TRAVELTEK_FTP_HOST');
    modified = true;
    console.log(`Fixed TRAVELTEK_FTP_HOST in ${file}`);
  }

  // Replace process.env.TRAVELTEK_FTP_USER with env.TRAVELTEK_FTP_USER
  if (content.includes('process.env.TRAVELTEK_FTP_USER')) {
    content = content.replace(/process\.env\.TRAVELTEK_FTP_USER \|\| process\.env\.FTP_USER/g, 'env.TRAVELTEK_FTP_USER');
    content = content.replace(/process\.env\.TRAVELTEK_FTP_USER/g, 'env.TRAVELTEK_FTP_USER');
    modified = true;
    console.log(`Fixed TRAVELTEK_FTP_USER in ${file}`);
  }

  // Replace process.env.TRAVELTEK_FTP_PASSWORD with env.TRAVELTEK_FTP_PASSWORD
  if (content.includes('process.env.TRAVELTEK_FTP_PASSWORD')) {
    content = content.replace(/process\.env\.TRAVELTEK_FTP_PASSWORD \|\| process\.env\.FTP_PASSWORD/g, 'env.TRAVELTEK_FTP_PASSWORD');
    content = content.replace(/process\.env\.TRAVELTEK_FTP_PASSWORD/g, 'env.TRAVELTEK_FTP_PASSWORD');
    modified = true;
    console.log(`Fixed TRAVELTEK_FTP_PASSWORD in ${file}`);
  }

  // Write back if modified
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${file}`);
  } else {
    console.log(`ℹ️ No changes needed for ${file}`);
  }
});

console.log('\n✅ All files have been fixed!');
console.log('\nNext steps:');
console.log('1. cd backend && npm run build');
console.log('2. Test locally if possible');
console.log('3. Commit and push to production');
