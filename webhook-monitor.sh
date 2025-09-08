#!/bin/bash

# Simple, elegant webhook monitoring
# Shows: what's happening, what happened, and what was actually updated

API_URL="https://zipsea-production.onrender.com"
LINE_ID=$1

clear
echo "🔄 WEBHOOK MONITOR"
echo "=================="
echo ""

# Function to format JSON nicely
show_status() {
    local url="$API_URL/api/webhook-monitor/status"
    if [ -n "$LINE_ID" ]; then
        url="$url?lineId=$LINE_ID"
    fi

    echo "📊 Current Status:"
    curl -s "$url" | jq -r '
        "Active Processing: \(.activeProcessing.count) webhook(s)\n" +
        if .activeProcessing.count > 0 then
            (.activeProcessing.details[] | "  • Line \(.lineId): processing for \(.duration)")
        else "" end
    ' 2>/dev/null || echo "  No active processing"

    echo ""
    echo "📈 Recent Webhooks (what actually happened):"
    curl -s "$url" | jq -r '
        .recentWebhooks[] |
        "  • \(.lineName // "Line \(.lineId)"): \(.cruisesProcessed) cruises, \(.pricingUpdated) pricing updated (\(.successRate))"
    ' 2>/dev/null || echo "  No recent webhooks"

    echo ""
    echo "✅ Last 24 Hours:"
    curl -s "$url" | jq -r '
        .stats.last24Hours |
        "  Total Webhooks: \(.totalWebhooks)\n" +
        "  Cruises Updated: \(.totalCruisesUpdated)\n" +
        "  Pricing Updated: \(.totalPricingUpdated)\n" +
        "  Success Rate: \(.successRate)"
    ' 2>/dev/null || echo "  No data available"

    echo ""
    echo "🔧 System Health:"
    curl -s "$url" | jq -r '
        .health |
        "  FTP: \(.ftp)\n" +
        "  Redis: \(.redis)\n" +
        "  Database: \(.database)"
    ' 2>/dev/null || echo "  Unable to check"
}

# Function to show report for specific line
show_report() {
    local line_id=$1
    echo ""
    echo "📋 Detailed Report for Line $line_id:"
    curl -s "$API_URL/api/webhook-monitor/report/$line_id?hours=1" | jq -r '
        "Line: \(.lineName)\n" +
        "Period: \(.period)\n" +
        "\nSummary:\n" +
        "  Cruises Updated: \(.summary.cruisesUpdated)\n" +
        "  Pricing Updated: \(.summary.pricingUpdated)\n" +
        "  Valid Pricing: \(.summary.withValidPricing)\n" +
        "  Price Range: \(.summary.priceRange.min) - \(.summary.priceRange.max) (avg: \(.summary.priceRange.avg))\n" +
        "\nRecent Updates:\n" +
        (.samples[:3][] | "  • \(.name // .cruiseId): \(.pricing.cheapest) (updated: \(.updatedAt | split("T")[1] | split(".")[0]))")
    ' 2>/dev/null || echo "  No report available"
}

# Main monitoring loop
if [ "$1" = "live" ]; then
    # Live monitoring mode
    echo "Starting live monitoring (updates every 5 seconds)..."
    echo "Press Ctrl+C to stop"
    echo ""

    while true; do
        clear
        echo "🔄 WEBHOOK MONITOR - $(date '+%H:%M:%S')"
        echo "=================="
        echo ""
        show_status
        sleep 5
    done

elif [ -n "$LINE_ID" ]; then
    # Show status and report for specific line
    show_status
    show_report "$LINE_ID"

else
    # Show general status
    show_status
    echo ""
    echo "💡 Usage:"
    echo "  ./webhook-monitor.sh          # Show current status"
    echo "  ./webhook-monitor.sh live     # Live monitoring mode"
    echo "  ./webhook-monitor.sh 16       # Show status + report for MSC Cruises"
    echo ""
    echo "📝 Common Line IDs:"
    echo "  16 - MSC Cruises"
    echo "  22 - Royal Caribbean"
    echo "  21 - Crystal Cruises"
    echo "  14 - Holland America"
fi
