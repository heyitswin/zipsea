#!/bin/bash

# Production Webhook Testing Script
# This script provides easy ways to test the webhook system from production

set -e

API_BASE="https://zipsea-production.onrender.com/api"
WEBHOOK_BASE="${API_BASE}/webhooks"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default cruise line ID for testing
DEFAULT_LINE_ID=5

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}🔧 WEBHOOK SYSTEM PRODUCTION TESTING SCRIPT${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_separator() {
    echo -e "${BLUE}------------------------------------------------${NC}"
}

# Function to test webhook simulation endpoint
test_simulation() {
    local line_id=${1:-$DEFAULT_LINE_ID}
    echo -e "${YELLOW}🧨 Testing internal simulation endpoint for line ${line_id}...${NC}"
    
    curl -s -X POST "${WEBHOOK_BASE}/test-simulate" \
        -H "Content-Type: application/json" \
        -d "{\"lineId\": ${line_id}}" | jq '.'
    
    echo -e "${GREEN}✅ Simulation test completed${NC}"
}

# Function to test real webhook endpoint
test_webhook() {
    local line_id=${1:-$DEFAULT_LINE_ID}
    echo -e "${YELLOW}🚀 Testing real webhook endpoint for line ${line_id}...${NC}"
    
    local payload=$(cat <<EOF
{
    "event": "cruiseline_pricing_updated",
    "lineid": ${line_id},
    "marketid": 0,
    "currency": "USD",
    "description": "BASH TEST: Cruise line pricing update for line ${line_id}",
    "source": "bash_test_script",
    "timestamp": $(date +%s)
}
EOF
)
    
    curl -s -X POST "${WEBHOOK_BASE}/traveltek/cruiseline-pricing-updated" \
        -H "Content-Type: application/json" \
        -H "User-Agent: BashTestScript/1.0" \
        -d "${payload}" | jq '.'
    
    echo -e "${GREEN}✅ Webhook test completed${NC}"
}

# Function to check system status
check_status() {
    echo -e "${YELLOW}📊 Checking webhook system status...${NC}"
    
    echo -e "${BLUE}Health Check:${NC}"
    curl -s "${WEBHOOK_BASE}/traveltek/health" | jq '.'
    
    echo ""
    echo -e "${BLUE}System Status:${NC}"
    curl -s "${WEBHOOK_BASE}/traveltek/status" | jq '.'
    
    echo -e "${GREEN}✅ Status check completed${NC}"
}

# Function to test line mapping
test_mapping() {
    local line_id=${1:-$DEFAULT_LINE_ID}
    echo -e "${YELLOW}🔍 Testing line ID mapping for ${line_id}...${NC}"
    
    echo -e "${BLUE}Mapping Test:${NC}"
    curl -s "${WEBHOOK_BASE}/traveltek/mapping-test?lineId=${line_id}" | jq '.'
    
    echo ""
    echo -e "${BLUE}Debug Info:${NC}"
    curl -s "${WEBHOOK_BASE}/traveltek/debug?lineId=${line_id}" | jq '.'
    
    echo -e "${GREEN}✅ Mapping test completed${NC}"
}

# Function to run performance test
test_performance() {
    local line_id=${1:-$DEFAULT_LINE_ID}
    local count=${2:-3}
    echo -e "${YELLOW}⚡ Running performance test with ${count} concurrent requests for line ${line_id}...${NC}"
    
    # Create array to store background process IDs
    pids=()
    
    # Start multiple requests in parallel
    for i in $(seq 1 $count); do
        (
            echo "Request $i starting..."
            response=$(curl -s -w "\n%{time_total}" -X POST "${WEBHOOK_BASE}/test-simulate" \
                -H "Content-Type: application/json" \
                -d "{\"lineId\": ${line_id}}")
            
            # Extract time from response
            time=$(echo "$response" | tail -n1)
            result=$(echo "$response" | head -n -1)
            
            echo "Request $i completed in ${time}s"
            echo "$result" | jq -r '.message // "No message"'
        ) &
        pids+=($!)
    done
    
    # Wait for all background processes to complete
    echo "Waiting for all requests to complete..."
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    echo -e "${GREEN}✅ Performance test completed${NC}"
}

# Function to show real-time monitoring
show_monitoring_info() {
    echo -e "${YELLOW}🔍 Real-time monitoring information:${NC}"
    echo ""
    echo -e "${BLUE}To monitor the system in real-time, use these commands:${NC}"
    echo ""
    echo "# Continuous monitoring (press Ctrl+C to stop)"
    echo "tsx scripts/webhook-monitor.ts monitor"
    echo ""
    echo "# Single health check"
    echo "tsx scripts/webhook-monitor.ts check"
    echo ""
    echo "# Load testing"
    echo "tsx scripts/webhook-load-test.ts light progressive"
    echo ""
    echo -e "${BLUE}What to look for in Slack:${NC}"
    echo "1. 🔄 'Real-time Webhook Processing Started' messages"
    echo "2. ✅ 'Real-time Webhook Processing Completed' with actual FTP results"
    echo "3. Numbers showing actual cruises updated vs. FTP failures"
    echo "4. Processing times (should be much faster than old batch system)"
    echo ""
    echo -e "${GREEN}Key differences from old system:${NC}"
    echo "- ❌ OLD: 'X cruises marked for update' (just flag setting)"
    echo "- ✅ NEW: 'X cruises actually updated' (real FTP results)"
    echo "- ⚡ Real-time parallel processing (10 workers)"
    echo "- 📊 Accurate FTP success/failure rates"
}

# Function to run comprehensive test
run_comprehensive_test() {
    local line_id=${1:-$DEFAULT_LINE_ID}
    
    echo -e "${YELLOW}🔄 Running comprehensive test suite for line ${line_id}...${NC}"
    echo ""
    
    print_separator
    echo "1. System Status Check"
    check_status
    echo ""
    
    print_separator
    echo "2. Line Mapping Test"
    test_mapping $line_id
    echo ""
    
    print_separator
    echo "3. Internal Simulation Test"
    test_simulation $line_id
    echo ""
    
    print_separator
    echo "4. Real Webhook Test"
    test_webhook $line_id
    echo ""
    
    print_separator
    echo "5. Performance Test (3 concurrent)"
    test_performance $line_id 3
    echo ""
    
    print_separator
    echo -e "${GREEN}🎉 Comprehensive test completed!${NC}"
    echo ""
    show_monitoring_info
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [command] [line_id] [options]"
    echo ""
    echo "Commands:"
    echo "  simulate [line_id]           - Test simulation endpoint (default line: $DEFAULT_LINE_ID)"
    echo "  webhook [line_id]            - Test real webhook endpoint"
    echo "  status                       - Check system status"
    echo "  mapping [line_id]            - Test line ID mapping"
    echo "  performance [line_id] [count] - Run performance test (default: 3 requests)"
    echo "  comprehensive [line_id]      - Run all tests"
    echo "  monitor                      - Show monitoring commands"
    echo "  help                         - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 simulate 5                # Test simulation for line 5"
    echo "  $0 webhook 21                # Test webhook for line 21"
    echo "  $0 performance 22 5          # Test line 22 with 5 concurrent requests"
    echo "  $0 comprehensive 46          # Run all tests for line 46"
    echo ""
    echo "Common cruise line IDs to test:"
    echo "  5  - Royal Caribbean"
    echo "  21 - Norwegian Cruise Line"
    echo "  22 - Celebrity Cruises"
    echo "  46 - Carnival Cruise Line"
    echo "  118 - MSC Cruises"
    echo "  123 - Costa Cruises"
    echo "  643 - Virgin Voyages"
}

# Main script logic
main() {
    print_header
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ Error: jq is required but not installed${NC}"
        echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
        exit 1
    fi
    
    local command=${1:-help}
    
    case $command in
        simulate)
            test_simulation $2
            ;;
        webhook)
            test_webhook $2
            ;;
        status)
            check_status
            ;;
        mapping)
            test_mapping $2
            ;;
        performance)
            test_performance $2 $3
            ;;
        comprehensive)
            run_comprehensive_test $2
            ;;
        monitor)
            show_monitoring_info
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $command${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"