#!/bin/bash
set -e

echo "Starting Zipsea backend in production mode..."

# Verify environment
echo "Environment: $NODE_ENV"
echo "Port: $PORT"

# Check if build exists
if [ ! -d "dist" ]; then
    echo "Error: Build directory 'dist' not found! Please run build first."
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    echo "Error: Main entry file 'dist/index.js' not found!"
    exit 1
fi

# Run database migrations on startup
echo "Running database migrations..."
if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "staging" ]; then
    npm run db:migrate || {
        echo "Warning: Database migration failed. Continuing startup..."
    }
fi

# Health check for required environment variables
echo "Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set!"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    echo "Warning: REDIS_URL is not set. Cache functionality may be disabled."
fi

echo "Environment check completed."

# Start the application
echo "Starting application on port $PORT..."
exec node dist/index.js