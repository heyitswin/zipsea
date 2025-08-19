#!/bin/bash

# Zipsea Backend Setup Script
# This script sets up the development environment for the Zipsea backend

set -e  # Exit on any error

echo "🚀 Setting up Zipsea Backend Development Environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi
print_status "Node.js version check passed: $(node -v)"

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi
print_status "Docker check passed"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi
print_status "Docker Compose check passed"

# Create logs directory
mkdir -p logs
print_status "Created logs directory"

# Check if .env file exists, if not copy from .env.example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_warning "Created .env file from .env.example. Please update with your actual values."
    else
        print_error ".env.example file not found. Please create environment configuration."
        exit 1
    fi
else
    print_status ".env file already exists"
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install
print_status "Backend dependencies installed"

# Start Docker services
echo "🐳 Starting Docker services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres redis
else
    docker compose up -d postgres redis
fi
print_status "Docker services started"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec $(docker ps -q -f name=postgres) pg_isready -U zipsea_user -d zipsea_dev &> /dev/null; do
    sleep 1
done
print_status "PostgreSQL is ready"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until docker exec $(docker ps -q -f name=redis) redis-cli -a redis_password ping &> /dev/null; do
    sleep 1
done
print_status "Redis is ready"

# Generate and run database migrations
echo "🗄️ Setting up database..."
npm run db:generate
print_status "Database migrations generated"

npm run db:migrate
print_status "Database migrations applied"

# Create seed data (optional)
if [ -f "scripts/seed.ts" ]; then
    echo "🌱 Creating seed data..."
    npm run db:seed
    print_status "Seed data created"
fi

# Run TypeScript type checking
echo "🔍 Running TypeScript type checking..."
npm run typecheck
print_status "TypeScript type checking passed"

# Run linting
echo "🔧 Running ESLint..."
npm run lint
print_status "Linting passed"

# Run tests
echo "🧪 Running tests..."
npm test
print_status "Tests passed"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm test             - Run tests"
echo "  npm run lint         - Run linting"
echo "  npm run db:studio    - Open database studio"
echo ""
echo "Docker services:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo "  Adminer: http://localhost:8080"
echo "  Redis Commander: http://localhost:8081"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""

print_status "Ready to develop! 🚀"