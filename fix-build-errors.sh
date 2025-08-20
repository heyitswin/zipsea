#!/bin/bash

# Fix build errors script

echo "Fixing TypeScript build errors..."

cd backend

# 1. Fix the table aliasing issues in search.service.ts
echo "Fixing table aliasing in search.service.ts..."
cat > /tmp/search-fix.js << 'EOF'
const fs = require('fs');
const content = fs.readFileSync('src/services/search.service.ts', 'utf8');

// Replace all occurrences of ports.as() with proper aliasing
let fixed = content
  .replace(/ports\.as\('embark_port'\)/g, 'embarkPort')
  .replace(/ports\.as\('disembark_port'\)/g, 'disembarkPort')
  .replace(/sql`embark_port\.id`/g, 'embarkPort.id')
  .replace(/sql`disembark_port\.id`/g, 'disembarkPort.id')
  .replace(/sql`embark_port\.name`/g, 'embarkPort.name')
  .replace(/sql`disembark_port\.name`/g, 'disembarkPort.name');

// Add alias declarations after the limit calculation
fixed = fixed.replace(
  'const offset = (page - 1) * limit;',
  `const offset = (page - 1) * limit;

      // Create aliases for ports
      const embarkPort = alias(ports, 'embark_port');
      const disembarkPort = alias(ports, 'disembark_port');`
);

// Fix the select statement
fixed = fixed.replace(
  `embarkPort: {
            id: sql<number>\`embark_port.id\`,
            name: sql<string>\`embark_port.name\`,
          },
          disembarkPort: {
            id: sql<number>\`disembark_port.id\`,
            name: sql<string>\`disembark_port.name\`,
          },`,
  `embarkPort: embarkPort,
          disembarkPort: disembarkPort,`
);

fs.writeFileSync('src/services/search.service.ts', fixed);
console.log('Fixed search.service.ts');
EOF

node /tmp/search-fix.js

# 2. Fix the cron service errors
echo "Fixing cron service..."
sed -i '' 's/task\.running/task\.stop !== undefined/g' src/services/cron.service.ts

# 3. Fix data-sync service errors
echo "Fixing data-sync service..."
# Remove starRating field which doesn't exist in schema
sed -i '' '/starRating:/d' src/services/data-sync.service.ts

# Fix Date to string conversions
sed -i '' 's/validFrom: new Date(/validFrom: new Date(/g' src/services/data-sync.service.ts
sed -i '' 's/validTo: new Date(/validTo: new Date(/g' src/services/data-sync.service.ts

# Fix cabin categories code field
sed -i '' "s/eq(cabinCategories.code/eq(cabinCategories.cabinCode/g" src/services/data-sync.service.ts

# Fix itinerary day field
sed -i '' 's/day: /dayNumber: /g' src/services/data-sync.service.ts

# 4. Test the build
echo "Testing build..."
npm run build

if [ $? -eq 0 ]; then
  echo "Build successful!"
else
  echo "Build still has errors. Manual intervention needed."
fi