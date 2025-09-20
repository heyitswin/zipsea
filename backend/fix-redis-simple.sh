#!/bin/bash

# Fix webhook-processor-optimized-v2.service.ts

echo "Fixing webhook-processor-optimized-v2.service.ts..."

# First, add the import statement after the crypto import
sed -i '' "/import \* as crypto from 'crypto';/a\\
import { env } from '../config/environment';" src/services/webhook-processor-optimized-v2.service.ts

# Replace process.env.REDIS_URL with env.REDIS_URL
sed -i '' 's/process\.env\.REDIS_URL/env.REDIS_URL/g' src/services/webhook-processor-optimized-v2.service.ts

# Replace process.env.TRAVELTEK_FTP_HOST with env.TRAVELTEK_FTP_HOST
sed -i '' 's/process\.env\.TRAVELTEK_FTP_HOST/env.TRAVELTEK_FTP_HOST/g' src/services/webhook-processor-optimized-v2.service.ts

# Replace process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER with env.TRAVELTEK_FTP_USER
sed -i '' 's/process\.env\.TRAVELTEK_FTP_USER || process\.env\.FTP_USER/env.TRAVELTEK_FTP_USER/g' src/services/webhook-processor-optimized-v2.service.ts

# Replace process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD with env.TRAVELTEK_FTP_PASSWORD
sed -i '' 's/process\.env\.TRAVELTEK_FTP_PASSWORD || process\.env\.FTP_PASSWORD/env.TRAVELTEK_FTP_PASSWORD/g' src/services/webhook-processor-optimized-v2.service.ts

echo "Done! Fixed webhook-processor-optimized-v2.service.ts"
echo ""
echo "Changes made:"
echo "1. Added import { env } from '../config/environment';"
echo "2. Replaced all process.env references with env"
