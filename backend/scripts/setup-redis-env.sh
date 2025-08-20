#!/bin/bash
# Redis Environment Setup Script for Render Deployment

set -e

echo "🔧 Setting up Redis environment configuration for Render..."

# Function to update .env file
update_env_file() {
    local key=$1
    local value=$2
    local env_file=${3:-".env"}
    
    if [ -f "$env_file" ]; then
        if grep -q "^${key}=" "$env_file"; then
            # Update existing key
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^${key}=.*|${key}=${value}|" "$env_file"
            else
                sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
            fi
            echo "   ✓ Updated ${key} in ${env_file}"
        else
            # Add new key
            echo "${key}=${value}" >> "$env_file"
            echo "   ✓ Added ${key} to ${env_file}"
        fi
    else
        # Create new file
        echo "${key}=${value}" > "$env_file"
        echo "   ✓ Created ${env_file} with ${key}"
    fi
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script should be run from the project root directory"
    exit 1
fi

echo "📋 Redis Configuration Checklist:"
echo ""

# 1. Environment Variables
echo "1. 🔑 Environment Variables Setup:"
echo ""
echo "   For Render deployment, you'll need to set these environment variables:"
echo "   in your Render service dashboard:"
echo ""
echo "   Required:"
echo "   • REDIS_URL - Your Render Redis instance URL"
echo "   • NODE_ENV - Set to 'production' for production service"
echo "   • DATABASE_URL - Your database connection string"
echo ""
echo "   Optional Cache Configuration:"
echo "   • CACHE_TTL_SEARCH=1800          # 30 minutes for search results"
echo "   • CACHE_TTL_CRUISE_DETAILS=21600 # 6 hours for cruise details"
echo "   • CACHE_TTL_PRICING=900          # 15 minutes for pricing"
echo ""

# Update local .env for development
if [ "$1" == "--local" ]; then
    echo "2. 📝 Updating local .env file for development:"
    update_env_file "REDIS_URL" "redis://localhost:6379"
    update_env_file "CACHE_TTL_SEARCH" "1800"
    update_env_file "CACHE_TTL_CRUISE_DETAILS" "21600"
    update_env_file "CACHE_TTL_PRICING" "900"
    echo ""
    echo "   ✅ Local environment configured for Redis development"
    echo "   💡 Make sure to run: docker run -d -p 6379:6379 redis:alpine"
    echo ""
fi

# 2. Render Redis Service
echo "2. ☁️  Render Redis Service Setup:"
echo ""
echo "   1. Go to your Render dashboard (https://dashboard.render.com)"
echo "   2. Click 'New +' and select 'Redis'"
echo "   3. Choose your plan (Free tier available with limitations)"
echo "   4. Name your Redis instance (e.g., 'zipsea-redis-staging')"
echo "   5. Select the same region as your backend service"
echo "   6. Click 'Create Redis'"
echo ""
echo "   Once created, copy the 'Internal Redis URL' from the dashboard"
echo "   and set it as REDIS_URL in your backend service environment variables."
echo ""

# 3. Backend Service Configuration  
echo "3. 🚀 Backend Service Configuration:"
echo ""
echo "   In your Render backend service:"
echo "   1. Go to Environment tab"
echo "   2. Add/Update these variables:"
echo "      • REDIS_URL=<your-redis-internal-url>"
echo "      • NODE_ENV=production (or staging)"
echo "      • CACHE_TTL_SEARCH=1800"
echo "      • CACHE_TTL_CRUISE_DETAILS=21600" 
echo "      • CACHE_TTL_PRICING=900"
echo ""

# 4. Health Check Endpoints
echo "4. 🏥 Health Check Endpoints:"
echo ""
echo "   After deployment, test these endpoints:"
echo "   • GET /health - Overall health including Redis status"
echo "   • GET /cache/metrics - Cache performance metrics"
echo "   • GET /cache/stats - Detailed cache statistics"
echo "   • GET /cache/warming/status - Cache warming status"
echo ""

# 5. Cache Management
echo "5. 🛠️  Cache Management:"
echo ""
echo "   Available management endpoints:"
echo "   • POST /cache/warming/trigger - Manually warm cache"
echo "   • POST /cache/clear - Clear all caches"
echo "   • POST /cache/metrics/reset - Reset metrics"
echo ""

# 6. Monitoring Recommendations
echo "6. 📊 Monitoring Recommendations:"
echo ""
echo "   Key metrics to monitor:"
echo "   • Cache hit rate (target: >70%)"
echo "   • Redis connection status"
echo "   • Memory usage"
echo "   • Request response times"
echo ""
echo "   Set up alerts for:"
echo "   • Redis connection failures"
echo "   • Low cache hit rates (<50%)"
echo "   • High memory usage (>80%)"
echo ""

# 7. Testing
echo "7. 🧪 Testing Your Setup:"
echo ""
echo "   1. Run the cache test script:"
echo "      ./scripts/test-cache-functionality.js https://your-app.onrender.com"
echo ""
echo "   2. Check logs for Redis connection messages"
echo "   3. Monitor cache metrics after deployment"
echo "   4. Test search performance (should improve after cache warming)"
echo ""

# Security notes
echo "8. 🔒 Security Notes:"
echo ""
echo "   • Redis URL contains sensitive credentials - keep secure"
echo "   • Use Render's internal network (Internal Redis URL) for best security"
echo "   • Monitor access logs for any unusual patterns"
echo "   • Consider Redis AUTH if available in your plan"
echo ""

echo "✅ Redis setup guide complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Create Redis instance on Render"
echo "   2. Update environment variables in your backend service"
echo "   3. Redeploy your backend service"
echo "   4. Run cache tests to verify functionality"
echo "   5. Monitor performance and cache metrics"
echo ""

if [ "$1" != "--local" ]; then
    echo "💡 Run with --local flag to set up local development environment"
fi