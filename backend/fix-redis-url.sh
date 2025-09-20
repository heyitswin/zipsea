#!/bin/bash

# Fix Redis URL configuration in all backend services

echo "Fixing Redis URL configuration in backend services..."

# Fix webhook-processor-optimized-v2.service.ts
echo "Fixing webhook-processor-optimized-v2.service.ts..."
sed -i '' "s/import \* as crypto from 'crypto';/import * as crypto from 'crypto';\nimport { env } from '..\/config\/environment';/" src/services/webhook-processor-optimized-v2.service.ts
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-optimized-v2.service.ts
sed -i '' "s/process\.env\.TRAVELTEK_FTP_HOST/env.TRAVELTEK_FTP_HOST/g" src/services/webhook-processor-optimized-v2.service.ts
sed -i '' "s/process\.env\.TRAVELTEK_FTP_USER || process\.env\.FTP_USER/env.TRAVELTEK_FTP_USER/g" src/services/webhook-processor-optimized-v2.service.ts
sed -i '' "s/process\.env\.TRAVELTEK_FTP_PASSWORD || process\.env\.FTP_PASSWORD/env.TRAVELTEK_FTP_PASSWORD/g" src/services/webhook-processor-optimized-v2.service.ts

# Fix redis-maintenance.service.ts
echo "Fixing redis-maintenance.service.ts..."
sed -i '' "1s/^/import { env } from '..\/config\/environment';\n/" src/services/redis-maintenance.service.ts
sed -i '' "s/process\.env\.REDIS_URL!/env.REDIS_URL!/g" src/services/redis-maintenance.service.ts
sed -i '' "s/process\.env\.REDIS_URL ?/env.REDIS_URL ?/g" src/services/redis-maintenance.service.ts

# Fix webhook-processor-robust.service.ts
echo "Fixing webhook-processor-robust.service.ts..."
if ! grep -q "import { env }" src/services/webhook-processor-robust.service.ts; then
  sed -i '' "1s/^/import { env } from '..\/config\/environment';\n/" src/services/webhook-processor-robust.service.ts
fi
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-robust.service.ts

# Fix webhook-processor-fixed.service.ts
echo "Fixing webhook-processor-fixed.service.ts..."
if ! grep -q "import { env }" src/services/webhook-processor-fixed.service.ts; then
  sed -i '' "1s/^/import { env } from '..\/config\/environment';\n/" src/services/webhook-processor-fixed.service.ts
fi
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-fixed.service.ts

# Fix webhook-processor-optimized.service.ts
echo "Fixing webhook-processor-optimized.service.ts..."
if ! grep -q "import { env }" src/services/webhook-processor-optimized.service.ts; then
  sed -i '' "1s/^/import { env } from '..\/config\/environment';\n/" src/services/webhook-processor-optimized.service.ts
fi
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-optimized.service.ts

# Fix webhook-stats-tracker.ts
echo "Fixing webhook-stats-tracker.ts..."
if ! grep -q "import { env }" src/services/webhook-stats-tracker.ts; then
  sed -i '' "1s/^/import { env } from '..\/config\/environment';\n/" src/services/webhook-stats-tracker.ts
fi
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-stats-tracker.ts

echo "All files have been fixed to use env.REDIS_URL instead of process.env.REDIS_URL"
echo ""
echo "Next steps:"
echo "1. Review the changes"
echo "2. Build and test locally: cd backend && npm run build"
echo "3. Commit and push to production"
