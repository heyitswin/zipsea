#!/usr/bin/env python3
"""
Slack Webhook Script for Zipsea Quote Requests
Sends raw pricing data to #updates-quote-requests channel
"""

import json
import requests
import sys
from datetime import datetime

# Configuration
WEBHOOK_URL = "https://hooks.slack.com/services/YOUR_WEBHOOK_URL_HERE"  # Replace with actual webhook URL

def send_to_slack(reference_number, customer_email, cruise_name, ship_name, departure_date, cabin_type, raw_pricing_data):
    """
    Send quote pricing data to Slack channel
    
    Args:
        reference_number: Quote reference number
        customer_email: Customer's email address
        cruise_name: Name of the cruise
        ship_name: Name of the ship
        departure_date: Departure date
        cabin_type: Requested cabin type
        raw_pricing_data: Raw pricing data extracted from the booking system
    """
    
    # Format the message
    header_text = f"*New Quote Pricing Data*\nReference: #{reference_number}\nCustomer: {customer_email}"
    
    # Create the full data block
    full_data = f"""Reference #: {reference_number}
Customer: {customer_email}
Cruise: {cruise_name}
Ship: {ship_name}
Departure: {departure_date}
Cabin Type: {cabin_type}
Timestamp: {datetime.now().isoformat()}

--- PRICING DATA ---
{raw_pricing_data}
"""
    
    # Create the Slack message payload
    payload = {
        "text": f"New Quote Pricing Data - Ref #{reference_number}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📋 Quote Pricing - #{reference_number}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": header_text
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"```{full_data}```"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Sent at {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    }
                ]
            }
        ]
    }
    
    try:
        # Send the request to Slack
        response = requests.post(WEBHOOK_URL, json=payload)
        
        if response.status_code == 200:
            print(f"✅ Successfully sent to Slack #updates-quote-requests channel")
            print(f"   Reference: #{reference_number}")
            print(f"   Customer: {customer_email}")
            return True
        else:
            print(f"❌ Failed to send to Slack")
            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error sending to Slack: {str(e)}")
        return False

def main():
    """
    Example usage - replace with actual data
    """
    
    # Example data - replace with actual extracted data
    reference_number = "ZQ-12345678"
    customer_email = "customer@example.com"
    cruise_name = "7 Night Western Caribbean"
    ship_name = "Wonder of the Seas"
    departure_date = "2025-03-15"
    cabin_type = "Balcony"
    
    # Replace this with the actual pricing data you extracted
    raw_pricing_data = """
Category: 2D - Ocean View Balcony GTY
Vacation Charges: $1,299.00 | $1,299.00 | $2,598.00
Taxes & Fees: $150.00 | $150.00 | $300.00
Vacation Subtotal: $1,449.00 | $1,449.00 | $2,898.00
OBC suggestion: | | | $463.68
Agency Commission: | | | $259.80
Total: $1,449.00 | $1,449.00 | $2,898.00

Category: 4D - Ocean View Balcony GTY
Vacation Charges: $1,399.00 | $1,399.00 | $2,798.00
Taxes & Fees: $150.00 | $150.00 | $300.00
Vacation Subtotal: $1,549.00 | $1,549.00 | $3,098.00
OBC suggestion: | | | $495.68
Agency Commission: | | | $279.80
Total: $1,549.00 | $1,549.00 | $3,098.00
"""
    
    # Send to Slack
    success = send_to_slack(
        reference_number,
        customer_email,
        cruise_name,
        ship_name,
        departure_date,
        cabin_type,
        raw_pricing_data
    )
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    # Check if webhook URL is configured
    if WEBHOOK_URL == "https://hooks.slack.com/services/YOUR_WEBHOOK_URL_HERE":
        print("⚠️  WARNING: Please update WEBHOOK_URL with your actual Slack webhook URL")
        print("   Contact the Zipsea team for the webhook URL for #updates-quote-requests channel")
        sys.exit(1)
    
    main()