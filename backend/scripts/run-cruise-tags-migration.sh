#!/bin/bash

# Run cruise tags migration on staging or production
# Usage: ./run-cruise-tags-migration.sh [staging|production]

ENV=${1:-staging}

if [ "$ENV" = "production" ]; then
  echo "⚠️  Running migration on PRODUCTION database"
  echo "Press Ctrl+C to cancel, or Enter to continue..."
  read
  DB_URL=$DATABASE_URL_PRODUCTION
else
  echo "Running migration on STAGING database"
  DB_URL=$DATABASE_URL
fi

if [ -z "$DB_URL" ]; then
  echo "Error: Database URL not set"
  exit 1
fi

echo "Executing cruise tags migration..."
psql "$DB_URL" -f /Users/winlin/Desktop/sites/zipsea/backend/src/db/migrations/0006_add_cruise_tags.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi
