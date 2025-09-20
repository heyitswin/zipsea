const fs = require('fs');
const path = require('path');

console.log('Fixing Redis environment variable issues in all services...\n');

// Fix webhook-processor-optimized-v2.service.ts
const fixOptimizedV2 = () => {
  const filePath = path.join(__dirname, 'src/services/webhook-processor-optimized-v2.service.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes("import { env } from '../config/environment'")) {
    content = content.replace(
      "import * as crypto from 'crypto';",
      "import * as crypto from 'crypto';\nimport { env } from '../config/environment';"
    );
  }

  // Fix Redis URL
  content = content.replace(
    "const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';",
    "const redisUrl = env.REDIS_URL || 'redis://localhost:6379';"
  );

  // Fix FTP configs - first occurrence
  content = content.replace(
    /host: process\.env\.TRAVELTEK_FTP_HOST \|\| 'ftpeu1prod\.traveltek\.net',\n\s+user: process\.env\.TRAVELTEK_FTP_USER \|\| process\.env\.FTP_USER,\n\s+password: process\.env\.TRAVELTEK_FTP_PASSWORD \|\| process\.env\.FTP_PASSWORD,/,
    "host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',\n      user: env.TRAVELTEK_FTP_USER,\n      password: env.TRAVELTEK_FTP_PASSWORD,"
  );

  // Fix FTP configs - second occurrence (in reconnect logic)
  content = content.replace(
    /host: process\.env\.TRAVELTEK_FTP_HOST \|\| 'ftpeu1prod\.traveltek\.net',\n\s+user: process\.env\.TRAVELTEK_FTP_USER \|\| process\.env\.FTP_USER,\n\s+password: process\.env\.TRAVELTEK_FTP_PASSWORD \|\| process\.env\.FTP_PASSWORD,/g,
    "host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',\n          user: env.TRAVELTEK_FTP_USER,\n          password: env.TRAVELTEK_FTP_PASSWORD,"
  );

  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed webhook-processor-optimized-v2.service.ts');
};

// Fix redis-maintenance.service.ts
const fixRedisMaintenance = () => {
  const filePath = path.join(__dirname, 'src/services/redis-maintenance.service.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import at the top
  if (!content.includes("import { env } from '../config/environment'")) {
    content = "import { env } from '../config/environment';\n" + content;
  }

  // Replace all process.env.REDIS_URL references
  content = content.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed redis-maintenance.service.ts');
};

// Fix webhook-processor-optimized.service.ts
const fixOptimized = () => {
  const filePath = path.join(__dirname, 'src/services/webhook-processor-optimized.service.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes("import { env } from '../config/environment'")) {
    // Find the imports section
    const importIndex = content.indexOf('import ');
    const firstNewline = content.indexOf('\n', importIndex);
    content = content.slice(0, firstNewline + 1) +
              "import { env } from '../config/environment';\n" +
              content.slice(firstNewline + 1);
  }

  // Replace process.env.REDIS_URL
  content = content.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed webhook-processor-optimized.service.ts');
};

// Fix webhook-processor-fixed.service.ts
const fixFixed = () => {
  const filePath = path.join(__dirname, 'src/services/webhook-processor-fixed.service.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes("import { env } from '../config/environment'")) {
    const importIndex = content.indexOf('import ');
    const firstNewline = content.indexOf('\n', importIndex);
    content = content.slice(0, firstNewline + 1) +
              "import { env } from '../config/environment';\n" +
              content.slice(firstNewline + 1);
  }

  // Replace process.env.REDIS_URL
  content = content.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed webhook-processor-fixed.service.ts');
};

// Fix webhook-processor-robust.service.ts
const fixRobust = () => {
  const filePath = path.join(__dirname, 'src/services/webhook-processor-robust.service.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes("import { env } from '../config/environment'")) {
    const importIndex = content.indexOf('import ');
    const firstNewline = content.indexOf('\n', importIndex);
    content = content.slice(0, firstNewline + 1) +
              "import { env } from '../config/environment';\n" +
              content.slice(firstNewline + 1);
  }

  // Replace process.env.REDIS_URL
  content = content.replace(/process\.env\.REDIS_URL/g, 'env.REDIS_URL');

  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed webhook-processor-robust.service.ts');
};

// Run all fixes
try {
  fixOptimizedV2();
  fixRedisMaintenance();
  fixOptimized();
  fixFixed();
  fixRobust();

  console.log('\n✅ All files fixed successfully!');
  console.log('\nNext steps:');
  console.log('1. Build the backend: npm run build');
  console.log('2. Commit changes: git add -A && git commit -m "Fix Redis connection - use env module instead of process.env"');
  console.log('3. Push to production: git push origin production');
} catch (error) {
  console.error('Error fixing files:', error);
}
