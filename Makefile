# Zipsea Development Makefile
# Common commands for development workflow

.PHONY: help install dev build test lint format clean docker-up docker-down reset setup

# Default target
help: ## Show this help message
	@echo "Zipsea Development Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# Setup and installation
setup: ## Set up the complete development environment
	@echo "🚀 Setting up Zipsea development environment..."
	cd backend && chmod +x scripts/setup.sh && ./scripts/setup.sh

install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	cd backend && npm install

# Development
dev: docker-up ## Start development servers
	@echo "🔧 Starting development server..."
	cd backend && npm run dev

build: ## Build for production
	@echo "🏗️ Building for production..."
	cd backend && npm run build

# Testing
test: ## Run all tests
	@echo "🧪 Running tests..."
	cd backend && npm test

test-watch: ## Run tests in watch mode
	@echo "👀 Running tests in watch mode..."
	cd backend && npm run test:watch

test-coverage: ## Run tests with coverage
	@echo "📊 Running tests with coverage..."
	cd backend && npm run test:coverage

# Code quality
lint: ## Run ESLint
	@echo "🔍 Running ESLint..."
	cd backend && npm run lint

lint-fix: ## Fix ESLint issues
	@echo "🔧 Fixing ESLint issues..."
	cd backend && npm run lint:fix

format: ## Format code with Prettier
	@echo "💅 Formatting code..."
	cd backend && npm run format

typecheck: ## Run TypeScript type checking
	@echo "🔍 Running TypeScript type checking..."
	cd backend && npm run typecheck

# Database
db-generate: ## Generate database migrations
	@echo "📋 Generating database migrations..."
	cd backend && npm run db:generate

db-migrate: ## Run database migrations
	@echo "🚀 Running database migrations..."
	cd backend && npm run db:migrate

db-studio: ## Open Drizzle Studio
	@echo "🎨 Opening Drizzle Studio..."
	cd backend && npm run db:studio

db-seed: ## Seed database with sample data
	@echo "🌱 Seeding database..."
	cd backend && npm run db:seed

db-reset: ## Reset database to clean state
	@echo "🔥 Resetting database..."
	cd backend && chmod +x scripts/reset-db.sh && ./scripts/reset-db.sh

# Docker
docker-up: ## Start Docker services
	@echo "🐳 Starting Docker services..."
	docker compose up -d postgres redis
	@echo "⏳ Waiting for services to be ready..."
	@until docker exec $$(docker compose ps -q postgres) pg_isready -U zipsea_user -d zipsea_dev >/dev/null 2>&1; do sleep 1; done
	@until docker exec $$(docker compose ps -q redis) redis-cli -a redis_password ping >/dev/null 2>&1; do sleep 1; done
	@echo "✅ Docker services are ready"

docker-down: ## Stop Docker services
	@echo "🛑 Stopping Docker services..."
	docker compose down

docker-logs: ## View Docker logs
	@echo "📄 Viewing Docker logs..."
	docker compose logs -f

docker-clean: ## Clean Docker volumes and containers
	@echo "🧹 Cleaning Docker volumes..."
	docker compose down -v
	docker system prune -f

# Development workflow
reset: docker-down docker-clean docker-up db-reset ## Complete reset of development environment

clean: ## Clean build artifacts and dependencies
	@echo "🧹 Cleaning build artifacts..."
	cd backend && rm -rf dist node_modules coverage logs
	docker compose down -v

# Quality checks
check: lint typecheck test ## Run all quality checks

# Production deployment preparation
prod-check: clean install build test ## Full production readiness check

# Development status
status: ## Show development environment status
	@echo "📊 Development Environment Status:"
	@echo ""
	@echo "Docker Services:"
	@docker compose ps || echo "  No services running"
	@echo ""
	@echo "Backend Dependencies:"
	@cd backend && npm list --depth=0 2>/dev/null | head -5 || echo "  Dependencies not installed"
	@echo ""
	@echo "Database Status:"
	@docker exec $$(docker compose ps -q postgres) pg_isready -U zipsea_user -d zipsea_dev 2>/dev/null && echo "  ✅ PostgreSQL: Connected" || echo "  ❌ PostgreSQL: Not available"
	@docker exec $$(docker compose ps -q redis) redis-cli -a redis_password ping 2>/dev/null && echo "  ✅ Redis: Connected" || echo "  ❌ Redis: Not available"

# Help for new developers
welcome: ## Show welcome message for new developers
	@echo "🎉 Welcome to Zipsea Development!"
	@echo ""
	@echo "Quick start:"
	@echo "  1. make setup     # Set up everything"
	@echo "  2. make dev       # Start development"
	@echo ""
	@echo "Common workflows:"
	@echo "  make test         # Run tests"
	@echo "  make lint         # Check code quality"
	@echo "  make db-studio    # Open database GUI"
	@echo "  make reset        # Fresh start"
	@echo ""
	@echo "For more commands: make help"