#!/bin/bash

# Database Reset Script
# This script resets the database to a clean state

set -e

echo "🗄️ Resetting Zipsea database..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Confirm reset
read -p "This will delete all data in the database. Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Database reset cancelled."
    exit 0
fi

# Stop any running development server
print_warning "Stopping any running development processes..."

# Drop and recreate database
echo "🔥 Dropping existing database..."
npm run db:drop || print_warning "Drop command failed (database may not exist)"

# Generate new migrations
echo "📋 Generating new migrations..."
npm run db:generate

# Apply migrations
echo "🚀 Applying migrations..."
npm run db:migrate

# Run seed data if available
if [ -f "scripts/seed.ts" ]; then
    echo "🌱 Creating seed data..."
    npm run db:seed
    print_status "Seed data created"
fi

print_status "Database reset completed successfully!"
echo ""
echo "The database is now in a clean state with:"
echo "  - Fresh schema applied"
echo "  - All indexes created"
echo "  - Seed data populated (if available)"
echo ""
echo "You can now start the development server with:"
echo "  npm run dev"