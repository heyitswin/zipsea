# Slack Webhook Script for Quote Pricing Data

This script sends raw pricing data from cruise quote requests to the Zipsea Slack team's `#updates-quote-requests` channel.

## Setup

1. **Get the Webhook URL**
   - Contact the Zipsea team for the actual webhook URL for the `#updates-quote-requests` channel
   - Replace `YOUR_WEBHOOK_URL_HERE` in the script with the actual URL

2. **Install Dependencies**
   ```bash
   pip install requests
   ```

## Usage

### From Manus Bot Email Instructions

When the Manus bot extracts pricing data, it will be instructed to:
1. Create this Python script
2. Paste the extracted pricing data into the script
3. Run the script to send data to Slack

### Manual Usage

```python
python send_quote_to_slack.py
```

### Customizing the Data

Edit the script and update these variables with actual data:
- `reference_number`: Quote reference number (e.g., "ZQ-12345678")
- `customer_email`: Customer's email address
- `cruise_name`: Name of the cruise
- `ship_name`: Name of the ship
- `departure_date`: Departure date
- `cabin_type`: Requested cabin type
- `raw_pricing_data`: The actual pricing data extracted from the booking system

## Example Pricing Data Format

```
Category: 2D - Ocean View Balcony GTY
Vacation Charges: $1,299.00 | $1,299.00 | $2,598.00
Taxes & Fees: $150.00 | $150.00 | $300.00
Vacation Subtotal: $1,449.00 | $1,449.00 | $2,898.00
OBC suggestion: | | | $463.68
Agency Commission: | | | $259.80
Total: $1,449.00 | $1,449.00 | $2,898.00
```

## What Gets Sent to Slack

The script sends:
- Quote reference number
- Customer email
- Cruise details (name, ship, departure date)
- Cabin type requested
- Full raw pricing data
- Timestamp of when the data was sent

## Troubleshooting

- **Webhook URL not configured**: Update the `WEBHOOK_URL` variable in the script
- **Failed to send (403 error)**: The webhook URL might be incorrect or expired
- **Connection error**: Check your internet connection
- **No data appearing in Slack**: Verify you're using the correct channel webhook

## Security Note

Keep the webhook URL secure and don't commit it to public repositories. Consider using environment variables for production use:

```python
import os
WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/YOUR_WEBHOOK_URL_HERE')
```