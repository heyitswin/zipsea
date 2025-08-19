#!/bin/bash
set -e

echo "Starting Zipsea backend build process..."

# Check Node.js version
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies
echo "Installing dependencies..."
npm ci --production=false

# Run type checking
echo "Running TypeScript type checking..."
npm run typecheck

# Clean previous build
echo "Cleaning previous build..."
npm run clean

# Build TypeScript to JavaScript
echo "Building TypeScript..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Error: Build directory 'dist' not found!"
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    echo "Error: Main entry file 'dist/index.js' not found!"
    exit 1
fi

echo "Build completed successfully!"

# Display build info
echo "Build artifacts:"
find dist -type f -name "*.js" | head -10

echo "Build process completed successfully."