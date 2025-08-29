# Admin Dashboard Setup Guide

## Overview
The ZipSea admin dashboard provides comprehensive business analytics and reporting for administrators. It includes real-time metrics for quotes, cruises, users, and revenue.

## Setting Up Admin Users in Clerk

### Step 1: Access Clerk Dashboard
1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your ZipSea application
3. Navigate to "Users" in the left sidebar

### Step 2: Assign Admin Role to a User
1. Find the user you want to make an admin
2. Click on the user to open their profile
3. Scroll down to "Public Metadata" section
4. Click "Edit" and add the following JSON:
```json
{
  "role": "admin"
}
```
5. Save the changes

### Step 3: Verify Admin Access
1. The user should now see "Admin Dashboard" in their dropdown menu when logged in
2. They can access the dashboard at `/admin`
3. Non-admin users will be redirected if they try to access admin routes

## Admin Dashboard Features

### 📊 Overview Tab
- **Key Metrics**: Total revenue, quotes, active users, conversion rate
- **Revenue Trend Chart**: Visual representation of revenue over time
- **Recent Quotes**: Real-time list of latest quote requests with status

### 📝 Quotes Tab
- **Quote Status Breakdown**: Pending, contacted, booked, cancelled
- **Quote Analytics**: Daily, weekly, monthly quote trends
- **Export Functionality**: Download quote data as CSV

### 🚢 Cruises Tab
- **Popular Cruises**: Most requested cruises with view counts and revenue
- **Cruise Lines Performance**: Revenue and booking metrics by cruise line
- **Destination Analytics**: Popular destinations and trends
- **Export Functionality**: Download cruise data as CSV

### 👥 Users Tab
- **User Acquisition Sources**: Organic, Google, social, direct, referral
- **Top Users**: Most active users by quote count and total value
- **User Growth Metrics**: New users daily, weekly, monthly
- **Export Functionality**: Download user data as CSV

### 💰 Revenue Tab
- **Revenue Metrics**: Average booking value, monthly revenue, projections
- **Monthly Revenue Breakdown**: Detailed revenue by month with booking counts
- **Revenue Trends**: Historical and projected revenue analysis
- **Export Functionality**: Download revenue data as CSV

## Date Range Filtering
All analytics can be filtered by:
- Last 7 days
- Last 30 days
- Last 90 days
- Last year
- All time

## Data Export
Each section includes export functionality to download data as CSV files for further analysis in Excel or other tools.

## API Endpoints
The dashboard expects the following backend API endpoints:
- `/api/v1/admin/analytics/quotes`
- `/api/v1/admin/analytics/cruises`
- `/api/v1/admin/analytics/users`
- `/api/v1/admin/analytics/revenue`
- `/api/v1/admin/quotes/recent`
- `/api/v1/admin/export/{type}`

Note: The dashboard currently displays mock data if API endpoints are not available.

## Security
- Admin routes are protected by middleware
- Only users with `role: "admin"` in their Clerk public metadata can access
- Non-admin users are redirected to the homepage
- All admin actions are logged for audit purposes

## Troubleshooting

### User doesn't see Admin Dashboard link
- Verify the user has `"role": "admin"` in their public metadata in Clerk
- Check that the user is properly signed in
- Clear browser cache and refresh

### 403 Unauthorized Error
- Ensure the user's public metadata is correctly set
- Check that Clerk is properly initialized
- Verify middleware is correctly configured

### Data not loading
- Check backend API endpoints are available
- Verify CORS settings allow frontend requests
- Check browser console for specific error messages