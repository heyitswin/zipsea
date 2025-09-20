#!/bin/bash

echo "URGENT: Fixing Redis connection issue in production"
echo "====================================================="
echo ""
echo "The issue: Services are using process.env.REDIS_URL which is undefined,"
echo "causing them to fall back to localhost (127.0.0.1:6379)"
echo ""
echo "The fix: Use env.REDIS_URL from the environment config module"
echo ""

# Fix webhook-processor-optimized-v2.service.ts
echo "1. Fixing webhook-processor-optimized-v2.service.ts..."

# First add the import after the crypto import
sed -i '' "/import \* as crypto from 'crypto';/a\\
import { env } from '../config/environment';" src/services/webhook-processor-optimized-v2.service.ts

# Replace process.env.REDIS_URL with env.REDIS_URL
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-optimized-v2.service.ts

# Fix FTP environment variables
sed -i '' "s/process\.env\.TRAVELTEK_FTP_HOST/env.TRAVELTEK_FTP_HOST/g" src/services/webhook-processor-optimized-v2.service.ts
sed -i '' "s/process\.env\.TRAVELTEK_FTP_USER || process\.env\.FTP_USER/env.TRAVELTEK_FTP_USER/g" src/services/webhook-processor-optimized-v2.service.ts
sed -i '' "s/process\.env\.TRAVELTEK_FTP_PASSWORD || process\.env\.FTP_PASSWORD/env.TRAVELTEK_FTP_PASSWORD/g" src/services/webhook-processor-optimized-v2.service.ts

echo "   ✅ Done"

# Fix redis-maintenance.service.ts
echo "2. Fixing redis-maintenance.service.ts..."

# Add import at the top
sed -i '' "1i\\
import { env } from '../config/environment';" src/services/redis-maintenance.service.ts

# Replace all process.env.REDIS_URL
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/redis-maintenance.service.ts

echo "   ✅ Done"

# Fix webhook-processor-optimized.service.ts
echo "3. Fixing webhook-processor-optimized.service.ts..."

# Add import after first import
sed -i '' "2i\\
import { env } from '../config/environment';" src/services/webhook-processor-optimized.service.ts

# Replace process.env.REDIS_URL
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-optimized.service.ts

echo "   ✅ Done"

# Fix webhook-processor-fixed.service.ts
echo "4. Fixing webhook-processor-fixed.service.ts..."

# Add import after first import
sed -i '' "2i\\
import { env } from '../config/environment';" src/services/webhook-processor-fixed.service.ts

# Replace process.env.REDIS_URL
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-fixed.service.ts

echo "   ✅ Done"

# Fix webhook-processor-robust.service.ts
echo "5. Fixing webhook-processor-robust.service.ts..."

# Add import after first import
sed -i '' "2i\\
import { env } from '../config/environment';" src/services/webhook-processor-robust.service.ts

# Replace process.env.REDIS_URL
sed -i '' "s/process\.env\.REDIS_URL/env.REDIS_URL/g" src/services/webhook-processor-robust.service.ts

echo "   ✅ Done"

echo ""
echo "====================================================="
echo "ALL FILES FIXED!"
echo "====================================================="
echo ""
echo "Next steps:"
echo "1. Build the backend to check for errors:"
echo "   npm run build"
echo ""
echo "2. If build succeeds, commit the changes:"
echo "   git add -A"
echo "   git commit -m 'Fix Redis connection - use env module instead of process.env'"
echo ""
echo "3. Push to main branch:"
echo "   git push origin main"
echo ""
echo "4. Merge to production and push:"
echo "   git checkout production"
echo "   git merge main"
echo "   git push origin production"
echo ""
echo "5. The fix will deploy automatically to Render"
