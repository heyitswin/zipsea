import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendSlackQuoteNotification } from '../../../lib/slack';

const resendApiKey = process.env.RESEND_API_KEY;

// Enhanced debugging for API key
console.log('Resend API Key Debug:', {
  exists: !!resendApiKey,
  length: resendApiKey?.length || 0,
  startsWithRe: resendApiKey?.startsWith('re_') || false,
  isPlaceholder: resendApiKey === 'your_resend_api_key_here',
  isEmpty: !resendApiKey || resendApiKey.trim() === '',
  firstChars: resendApiKey ? resendApiKey.substring(0, 3) + '...' : 'none'
});

const resend = resendApiKey && resendApiKey !== 'your_resend_api_key_here' && resendApiKey.trim() !== ''
  ? new Resend(resendApiKey) 
  : null;

// Log email configuration status
if (resend) {
  console.log('✅ Email service initialized successfully with Resend');
} else {
  console.log('❌ Email service disabled - check RESEND_API_KEY environment variable');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, cruiseData, passengers, discounts, cabinType, cabinPrice, travelInsurance } = body;

    console.log('Quote submission received:', { 
      userEmail, 
      cruiseId: cruiseData?.id,
      cabinType,
      passengers,
      timestamp: new Date().toISOString(),
      hasSlackUrl: !!process.env.SLACK_WEBHOOK_URL && process.env.SLACK_WEBHOOK_URL !== 'your_slack_webhook_url_here',
      hasResendKey: !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here'
    });

    if (!userEmail) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    let backendSaved = false;
    let slackSent = false;
    let emailSent = false;

    // Save quote request to backend database (optional - don't fail if backend is down)
    try {
      const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://zipsea-production.onrender.com';
      console.log('Attempting to save to backend:', backendUrl);
      
      const quoteResponse = await fetch(`${backendUrl}/api/v1/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          cruiseId: cruiseData?.id,
          cabinType: cabinType?.toLowerCase(),
          adults: passengers?.adults || 2,
          children: passengers?.children || 0,
          travelInsurance: travelInsurance || false,
          discountQualifiers: {
            payInFull: discounts?.payInFull || false,
            seniorCitizen: discounts?.age55Plus || false,
            military: discounts?.military || false,
            stateOfResidence: discounts?.stateOfResidence || '',
            loyaltyNumber: discounts?.loyaltyNumber || '',
          },
        }),
      });

      if (quoteResponse.ok) {
        backendSaved = true;
        console.log('Quote saved to backend successfully');
      } else {
        console.error('Backend response not OK:', quoteResponse.status, quoteResponse.statusText);
      }
    } catch (error) {
      console.error('Error saving quote to backend database:', error);
      // Continue - backend save is optional
    }

    // Send Slack notification (optional - don't fail if Slack is down)
    try {
      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhookUrl && slackWebhookUrl !== 'your_slack_webhook_url_here') {
        console.log('Attempting to send Slack notification...');
        const slackResult = await sendSlackQuoteNotification({
          userEmail,
          cruiseData,
          passengers,
          discounts: {
            ...discounts,
            travelInsurance: travelInsurance || false
          },
          cabinType,
          cabinPrice
        });
        
        if (slackResult?.success) {
          slackSent = true;
          console.log('Slack notification sent successfully');
        } else {
          console.error('Slack notification failed:', slackResult);
        }
      } else {
        console.log('Slack webhook not configured, skipping notification');
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      // Continue - Slack is optional
    }

    // Format data for email
    const passengerInfo = `${passengers?.adults || 2} adult${(passengers?.adults || 2) !== 1 ? 's' : ''}${
      (passengers?.children || 0) > 0 ? `, ${passengers.children} child${passengers.children !== 1 ? 'ren' : ''}` : ''
    }`;

    const activeDiscounts = [];
    if (discounts?.payInFull) activeDiscounts.push('Pay in full/non-refundable');
    if (discounts?.age55Plus) activeDiscounts.push('55 or older');
    if (discounts?.military) activeDiscounts.push('Military/Veteran');
    if (discounts?.stateOfResidence) activeDiscounts.push(`Resident of ${discounts.stateOfResidence}`);
    if (discounts?.loyaltyNumber) activeDiscounts.push(`Loyalty number: ${discounts.loyaltyNumber}`);

    const formatPrice = (price: string | number | undefined) => {
      if (!price) return 'N/A';
      const numPrice = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(numPrice)) return 'N/A';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numPrice);
    };

    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC'
        });
      } catch {
        return dateString;
      }
    };

    // Send email if Resend is configured
    if (resend) {
      try {
        console.log('Attempting to send confirmation email to:', userEmail);
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Cruise Quote Request</title>
            <!--[if mso]>
            <noscript>
              <xml>
                <o:OfficeDocumentSettings>
                  <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
              </xml>
            </noscript>
            <![endif]-->
          </head>
          <body style="margin: 0; padding: 0; background-color: #F6F3ED; font-family: Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
            <!-- Wrapper table for Outlook -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F6F3ED; min-height: 100vh;">
              <tr>
                <td align="center" valign="top" style="padding: 20px 0;">
                  
                  <!-- Main container -->
                  <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #F6F3ED;">
                    
                    <!-- Hero Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0E1B4D; border-radius: 10px 10px 0 0;">
                          <tr>
                            <td style="padding: 36px;">
                              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                  <!-- Logo -->
                                  <td valign="top" style="width: 130px; padding-bottom: 20px;">
                                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAxMTAgMzEiPjxwYXRoIGZpbGw9IiNFOUI0RUIiIGQ9Ik0yNC42NSAyOS41YS41NS41NSAwIDAgMS0uNDg4LS41MzVsLS4yNi0xOC4wNDdhLjU0Ny41NDcgMCAwIDEgLjU4Mi0uNTUzbDUuNzMyLjM4MWEuNTQ3LjU0NyAwIDAgMSAuNTEuNTM4bC4yNiAxOC4yNzhhLjU0Ny41NDcgMCAwIDEtLjYwNC41NTF6Ii8+PHBhdGggZmlsbD0iI0U5QjRFQiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJtMzQuNTk2IDMuODQ1IDQuOTE2LS43OTZjLjI0NC4wMDEuNDUuMTguNDg3LjQyMmwuMTI2LjgzNWMuMDYyLjQxLjU3NS41NzIuODgyLjI5MiAxLjM3OC0xLjI1OCAyLjc4Mi0xLjYyMyA0LjIxMy0xLjYxNSAxLjg5Ny4wMSAzLjI3NS43NyA0LjM5MyAyLjI3OCAxLjExOCAxLjQ5NyAxLjY2OSAzLjQ2NSAxLjY1MiA2LjQyMnEtLjAxNSAyLjU0LS42MyA0LjQ2OGMtLjQxIDEuMjczLS44NDQgMi4yODMtMS41NiAzLjAzLS43MDMuNzM2LTEuNDgzIDEuMTU2LTIuMzM4IDEuNTIxYTcuMSA3LjEgMCAwIDEtMi43Ni41MjFjLS44NzctLjAwNS0xLjgyNi0uMDA4LTIuODQ4LS4yNjlhLjUxLjUxIDAgMCAwLS42MzkuNDg1bC0uMDI5IDUuMTIxYS40OTYuNDk2IDAgMCAxLS40Mi40ODhsLTUuNTA4LjgzM2EuNDk1LjQ5NSAwIDAgMS0uNTY4LS40OTNsLjEzNC0yMy4wNWEuNDk1LjQ5NSAwIDAgMSAuNDk3LS40OTNtOC4yMjYgNC41MTJjLS42MjgtLjAwMy0xLjMzNi41MTYtMi4xMjcgMS4yOTlhLjQ4LjQ4IDAgMCAwLS4xNC4zNGwtLjAzMiA1LjYxNWEuNDcuNDcgMCAwIDAgLjMxNS40NTZjLjUyLjE3NiAxLjAwNS4zOTUgMS40Ni4zOTguNzgyLjAwNSAxLjQwNy0uNDU2IDEuODczLTEuMTIuNDc4LS42NzguODUtMS43NS44NTktMy4yMTYuMDEzLTIuNDItLjgxLTMuNzY0LTIuMjA4LTMuNzcyIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48cGF0aCBmaWxsPSIjRTlCNEVCIiBkPSJNMzAuODk2IDQuNjdhMy41MDIgMy41MDIgMCAxIDEtNy4wMDMgMCAzLjUwMiAzLjUwMiAwIDAgMSA3LjAwMyAwbTIxLjU1NyAxNy4yNzhhLjQxLjQxIDAgMCAxLS4yMDgtLjQ5MWwxLjI0My0zLjkwMWEuNDE1LjQxNSAwIDAgMSAuNjAzLS4yMzJjMS4wODIuNjI1IDIuMDY5IDEuMTMxIDMuMzM2IDEuNTE5cTIuMTc5LjY0IDMuODE4LjY0cTEuOTU5IDAgMS45NTktMS4wOHEwLS41Mi0uNTYtLjg2cS0uNTQtLjM0LTIuMzU5LS44MTlxLTIuMDc4LS41NC0zLjM3Ny0xLjA2YTkuOCA5LjggMCAwIDEtMi4yNzktMS4yNThxLS45Ni0uNzYtMS4zNzktMS43OHEtLjQtMS4wMTgtLjQtMi40NzhxMC0zLjAzNyAyLjA5OS00LjgxNnEyLjExOC0xLjc4IDUuOTU2LTEuNzhxNC4xMiAwIDcuNDg3IDEuNDM0Yy4xNy4wNzMuMjY4LjI1My4yNC40MzZsLS42ODMgNC4zOThhLjQyLjQyIDAgMCAxLS42MDIuMzEgMTguNiAxOC42IDAgMCAwLTMuMDg0LTEuMThxLTEuODQtLjUyLTMuMjc4LS41MnEtMS41OTkgMC0xLjU5OS44OTlxMCAuNS41Ni44MnEuNTguMzIgMi41MTguODU5cTQuMjU3IDEuMTYgNS43OTYgMi40OThxMS41NCAxLjM0IDEuNTQgNC4wNzhxMCAzLjMzOC0yLjE4IDUuMDc2cS0yLjE3OCAxLjcyLTYuMjk1IDEuNzJjLTMuMDM3IDAtNi4yMzgtMS4xMzctOC44NzMtMi40MzJtMTguMjQ1LTExLjI3NXEwLTQuOTE3IDIuNzE4LTcuNzk1UTc2LjE1NSAwIDgwLjQ5MSAwcTIuMzE5IDAgNC4wOTcuODJxMS43OC43OTggMi44NTggMi4yNThxMS4wOCAxLjQ2IDEuNjIgMy4zNTh0LjUzOSA0LjE5N3EwIDEuMDQ4LS4wNyAxLjY0NWEuMzg0LjM4NCAwIDAgMS0uMzg4LjMzNEg3OC40MzVjLS4yNTMgMC0uNDQ4LjIyNy0uMzg2LjQ3M3EuNzM1IDIuOTI1IDQuNDggMi45MjVxMi41MSAwIDUuODEtMS41NjNhLjQyLjQyIDAgMCAxIC42MDMuMzc4bC0uMDIyIDQuMDYyYS40MS40MSAwIDAgMS0uMjEuMzU1Yy0yLjM0NSAxLjMtNC4zMTIgMS44MjQtNy4xNiAxLjgyNHEtMi40MzggMC00LjQxNy0uNjJxLTEuOTc5LS42NC0zLjQxOC0xLjg5OHEtMS40NC0xLjI2LTIuMjM4LTMuMjU4cS0uNzgtMS45OTgtLjc4LTQuNjE3bTcuMTI2LTIuMjE1YS40MDMuNDAzIDAgMCAwIC40MDUuNDE2aDQuMTE4YS40MDMuNDAzIDAgMCAwIC40MDUtLjQyM3EtLjEwNy0xLjg2Ny0uNzAxLTIuODc1cS0uNjYtMS4xMTktMS43NzktMS4xMTlxLTEuMTQgMC0xLjc5OSAxLjE0cS0uNTc2IDEuMDA4LS42NSAyLjg2MW0xMi45MzIgMTAuODU2cTAtMy40NTcgMi42NTgtNS4yNzdxMi42MjItMS44MTMgOC4yNzUtMi4zMjRhLjE3Ni4xNzYgMCAwIDAgLjE2LS4xNzRxMC0xLjE0LS42Ni0xLjY3OXEtLjY0LS41NC0yLjA3OC0uNTRxLTIuNzQ1IDAtNS44NjcgMS4yMzlhLjQyLjQyIDAgMCAxLS41Ny0uMzIybC0uNjg5LTQuNDdhLjQwNi40MDYgMCAwIDEgLjI1Ni0uNDQzcTMuNjk0LTEuNCA4LjA4OS0xLjRxNC41MzcgMCA2LjY3NSAxLjYzOXEyLjEzOSAxLjYzOCAyLjEzOSA1LjU5NlYyNC4xYS40MS40MSAwIDAgMS0uNDEyLjQxMWgtNS43OTZhLjQxLjQxIDAgMCAxLS40MDYtLjM0MmwtLjIyNi0xLjMyNGMtLjA1Ny0uMzMtLjQ2Ny0uNDYtLjcxNi0uMjM2cS0xLjEwNC45OTgtMi4yNTggMS41ODNxLTEuNDQuNzItMy4yMTguNzJxLTIuMzk4IDAtMy44NzctMS40NHEtMS40OC0xLjQ0LTEuNDgtNC4xNTdtNy4xNTUtMS4xcTAgLjgyLjQyIDEuMjhxLjQ0LjQ0IDEuMTQuNDRxMS4wMTMgMCAyLjI1Ny0uOTE4YS40LjQgMCAwIDAgLjE2MS0uMzI0di0zLjRhLjQuNCAwIDAgMC0uNS0uMzk0cS0xLjc1LjQ2LTIuNTU4IDEuMTk4cS0uOTIuODQtLjkyIDIuMTE5TTE2IDI5LjUgMjQuNjUgMjkuNWEuNTUuNTUgMCAwIDEtLjQ4OC0uNTM1bC0uMjYtMTguMDQ3YS41NDcuNTQ3IDAgMCAxIC41ODItLjU1M2w1LjczMi4zODFhLjU0Ny41NDcgMCAwIDEgLjUxLjUzOGwuMjYgMTguMjc4YS41NDcuNTQ3IDAgMCAxLS42MDQuNTUxeiIvPjxwYXRoIGZpbGw9IiNFOUI0RUIiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0ibTM0LjU5NiAzLjg0NSA0LjkxNi0uNzk2Yy4yNDQuMDAxLjQ1LjE4LjQ4Ny40MjJsLjEyNi44MzVjLjA2Mi40MS41NzUuNTcyLjg4Mi4yOTIgMS4zNzgtMS4yNTggMi43ODItMS42MjMgNC4yMTMtMS42MTUgMS44OTcuMDEgMy4yNzUuNzcgNC4zOTMgMi4yNzggMS4xMTggMS40OTcgMS42NjkgMy40NjUgMS42NTIgNi40MjJxLS4wMTUgMi41NC0uNjMgNC40NjhjLS40MSAxLjI3My0uODQ0IDIuMjgzLTEuNTYgMy4wMy0uNzAzLjczNi0xLjQ4MyAxLjE1Ni0yLjMzOCAxLjUyMWE3LjEgNy4xIDAgMCAxLTIuNzYuNTIxYy0uODc3LS4wMDUtMS44MjYtLjAwOC0yLjg0OC0uMjY5YS41MS41MSAwIDAgMC0uNjM5LjQ4NWwtLjAyOSA1LjEyMWEuNDk2LjQ5NiAwIDAgMS0uNDIuNDg4bC01LjUwOC44MzNhLjQ5NS40OTUgMCAwIDEtLjU2OC0uNDkzbC4xMzQtMjMuMDVhLjQ5NS40OTUgMCAwIDEgLjQ5Ny0uNDkzbTguMjI2IDQuNTEyYy0uNjI4LS4wMDMtMS4zMzYuNTE2LTIuMTI3IDEuMjk5YS40OC40OCAwIDAgMC0uMTQuMzRsLS4wMzIgNS42MTVhLjQ3LjQ3IDAgMCAwIC4zMTUuNDU2Yy41Mi4xNzYgMS4wMDUuMzk1IDEuNDYuMzk4Ljc4Mi4wMDUgMS40MDctLjQ1NiAxLjg3My0xLjEyLjQ3OC0uNjc4Ljg1LTEuNzUuODU5LTMuMjE2LjAxMy0yLjQyLS44MS0zLjc2NC0yLjIwOC0zLjc3MiIgY2xpcC1ydWxlPSJldmVub2RkIi8+PHBhdGggZmlsbD0iI0U5QjRFQiIgZD0iTTMwLjg5NiA0LjY3YTMuNTAyIDMuNTAyIDAgMSAxLTcuMDAzIDAgMy41MDIgMy41MDIgMCAwIDEgNy4wMDMgMG0yMS41NTcgMTcuMjc4YS40MS40MSAwIDAgMS0uMjA4LS40OTFsMS4yNDMtMy45MDFhLjQxNS40MTUgMCAwIDEgLjYwMy0uMjMyYzEuMDgyLjYyNSAyLjA2OSAxLjEzMSAzLjMzNiAxLjUxOXEyLjE3OS42NCAzLjgxOC42NHExLjk1OSAwIDEuOTU5LTEuMDhxMC0uNTItLjU2LS44NnEtLjU0LS4zNC0yLjM1OS0uODE5cS0yLjA3OC0uNTQtMy4zNzctMS4wNmE5LjggOS44IDAgMCAxLTIuMjc5LTEuMjU4cS0uOTYtLjc2LTEuMzc5LTEuNzhxLS40LTEuMDE4LS40LTIuNDc4cTAtMy4wMzcgMi4wOTktNC44MTZxMi4xMTgtMS43OCA1Ljk1Ni0xLjc4cTQuMTIgMCA3LjQ4NyAxLjQzNGMuMTcuMDczLjI2OC4yNTMuMjQuNDM2bC0uNjgzIDQuMzk4YS40Mi40MiAwIDAgMS0uNjAyLjMxIDE4LjYgMTguNiAwIDAgMC0zLjA4NC0xLjE4cS0xLjg0LS41Mi0zLjI3OC0uNTJxLTEuNTk5IDAtMS41OTkuODk5cTAgLjUuNTYuODJxLjU4LjMyIDIuNTE4Ljg1OXE0LjI1NyAxLjE2IDUuNzk2IDIuNDk4cTEuNTQgMS4zNCAxLjU0IDQuMDc4cTAgMy4zMzgtMi4xOCA1LjA3NnEtMi4xNzggMS43Mi02LjI9NSAxLjcyYy0zLjAzNyAwLTYuMjM4LTEuMTM3LTguODczLTIuNDMybTE4LjI0NS0xMS4yNzVxMC00LjkxNyAyLjcxOC03Ljc5NVE3Ni4xNTUgMCA4MC40OTEgMHEyLjMxOSAwIDQuMDk3LjgycTEuNzguNzk4IDIuODU4IDIuMjU4cTEuMDggMS40NiAxLjYyIDMuMzU4dC41MzkgNC4xOTdxMCAxLjA0OC0uMDcgMS42NDVhLjM4NC4zODQgMCAwIDEtLjM4OC4zMzRINzguNDM1Yy0uMjUzIDAtLjQ0OC4yMjctLjM4Ni40NzNxLjczNSAyLjkyNSA0LjQ4IDIuOTI1cTIuNTEgMCA1LjgxLTEuNTYzYS40Mi40MiAwIDAgMSAuNjAzLjM3OGwtLjAyMiA0LjA2MmEuNDEuNDEgMCAwIDEtLjIxLjM1NWMtMi4zNDUgMS4zLTQuMzEyIDEuODI0LTcuMTYgMS44MjRxLTIuNDM4IDAtNC40MTctLjYycS0xLjk3OS0uNjQtMy40MTgtMS44OThxLTEuNDQtMS4yNi0yLjIzOC0zLjI1OHEtLjc4LTEuOTk4LS43OC00LjYxN203LjEyNi0yLjIxNWEuNDAzLjQwMyAwIDAgMCAuNDA1LjQxNmg0LjExOGEuNDAzLjQwMyAwIDAgMCAuNDA1LS40MjNxLS4xMDctMS44NjctLjcwMS0yLjg3NXEtLjY2LTEuMTE5LTEuNzc5LTEuMTE5cS0xLjE0IDAtMS43OTkgMS4xNHEtLjU3NiAxLjAwOC0uNjUgMi44NjFtMTIuOTMyIDEwLjg1NnEwLTMuNDU3IDIuNjU4LTUuMjc3cTIuNjIyLTEuODEzIDguMjc1LTIuMzI0YS4xNzYuMTc2IDAgMCAwIC4xNi0uMTc0cTAtMS4xNC0uNjYtMS42NzlxLS42NC0uNTQtMi4wNzgtLjU0cS0yLjc0NSAwLTUuODY3IDEuMjM5YS40Mi40MiAwIDAgMS0uNTctLjMyMmwtLjY4OS00LjQ3YS40MDYuNDA2IDAgMCAxIC4yNTYtLjQ0M3EzLjY5NC0xLjQgOC4wODktMS40cTQuNTM3IDAgNi42NzUgMS42MzlxMi4xMzkgMS42MzggMi4xMzkgNS41OTZWMjQuMWEuNDEuNDEgMCAwIDEtLjQxMi40MTFoLTUuNzk2YS40MS40MSAwIDAgMS0uNDA2LS4zNDJsLS4yMjYtMS4zMjRjLS4wNTctLjMzLS40NjctLjQ2LS43MTYtLjIzNnEtMS4xMDQuOTk4LTIuMjU4IDEuNTgzcS0xLjQ0LjcyLTMuMjE4LjcycS0yLjM5OCAwLTMuODc3LTEuNDRxLTEuNDgtMS40NC0xLjQ4LTQuMTU3bTcuMTU1LTEuMXEwIC44Mi40MiAxLjI4cS40NC40NCAxLjE0LjQ0cTEuMDEzIDAgMi4yNTctLjkxOGEuNC40IDAgMCAwIC4xNjEtLjMyNHYtMy40YS40LjQgMCAwIDAtLjUtLjM5NHEtMS43NS40Ni0yLjU1OCAxLjE5OHEtLjkyLjg0LS45MiAyLjExOXoiLz48L3N2Zz4=" 
                                         alt="ZipSea" 
                                         width="130" 
                                         height="37" 
                                         style="display: block; width: 130px; height: 37px;" />
                                  </td>
                                  <!-- Spacing -->
                                  <td style="width: 140px;">&nbsp;</td>
                                  <!-- Content -->
                                  <td valign="top">
                                    <h1 style="margin: 0 0 10px 0; color: #FFFFFF; font-family: Arial, sans-serif; font-size: 54px; font-weight: bold; letter-spacing: -0.02em; line-height: 1.1;">Quote request received</h1>
                                    <p style="margin: 0; color: #E9B4EB; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.3;">We're working on getting you the best possible price + perks</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Cruise Details Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FFFFFF; border-radius: 10px; margin: 10px 0;">
                          <tr>
                            <td style="padding: 36px;">
                              <h2 style="margin: 0 0 20px 0; color: #2F2F2F; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Cruise details</h2>
                              
                              <!-- Two column layout -->
                              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                  <td valign="top" style="width: 50%; padding-right: 20px;">
                                    
                                    ${cruiseData?.name ? `
                                    <!-- Cruise -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">CRUISE</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${cruiseData.name}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cruiseData?.shipName ? `
                                    <!-- Ship -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">SHIP</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${cruiseData.shipName}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cruiseData?.nights ? `
                                    <!-- Nights -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">NIGHTS</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${cruiseData.nights} nights</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    <!-- Passengers -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">PASSENGERS</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${passengerInfo}</td>
                                      </tr>
                                    </table>
                                    
                                  </td>
                                  <td valign="top" style="width: 50%; padding-left: 20px;">
                                    
                                    ${cruiseData?.cruiseLineName ? `
                                    <!-- Cruise Line -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">CRUISE LINE</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${cruiseData.cruiseLineName}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cruiseData?.sailingDate ? `
                                    <!-- Departure -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">DEPARTURE</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${formatDate(cruiseData.sailingDate)}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cabinType ? `
                                    <!-- Cabin Type -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">CABIN TYPE</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${cabinType}</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                    ${cabinPrice ? `
                                    <!-- Starting Price -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                                      <tr>
                                        <td style="color: #999999; font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px;">STARTING PRICE</td>
                                      </tr>
                                      <tr>
                                        <td style="color: #2F2F2F; font-family: Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.4;">${formatPrice(cabinPrice)} (excl. taxes/fees)</td>
                                      </tr>
                                    </table>
                                    ` : ''}
                                    
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- What Happens Next Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #E9B4EB; border-radius: 10px; margin: 10px 0;">
                          <tr>
                            <td style="padding: 36px;">
                              <h2 style="margin: 0 0 20px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">What happens next?</h2>
                              <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; padding-bottom: 10px;">Our team will review your request and search for best available rates</td>
                                </tr>
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; padding-bottom: 10px;">We'll give you the MOST onboard credit we can (without getting in trouble)</td>
                                </tr>
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5; padding-bottom: 10px;">You'll receive a personalized quote via email within 24 hours (usually much shorter)</td>
                                </tr>
                                <tr>
                                  <td valign="top" style="padding-right: 10px; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5;">•</td>
                                  <td style="color: #0E1B4D; font-family: Arial, sans-serif; font-size: 18px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.5;">Our cruise specialists are standing by to help you book at the best price</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Questions Section -->
                    <tr>
                      <td style="padding: 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F7F170; border-radius: 10px; margin: 10px 0;">
                          <tr>
                            <td style="padding: 36px; text-align: left;">
                              <h2 style="margin: 0 0 15px 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: -0.02em;">Questions?</h2>
                              <p style="margin: 0; color: #0E1B4D; font-family: Arial, sans-serif; font-size: 24px; font-weight: normal; letter-spacing: -0.02em; line-height: 1.3;">Reply to this email or text us anytime at +1(866) 420-3817</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 20px 0; text-align: center;">
                        <p style="margin: 0; color: #999999; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.5px;">THIS EMAIL WAS SENT BECAUSE YOU REQUESTED A CRUISE QUOTE ON OUR WEBSITE ZIPSEA.COM</p>
                      </td>
                    </tr>
                    
                  </table>
                  
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        // Try with custom domain first, fallback to onboarding@resend.dev if it fails
        const fromEmail = 'ZipSea <zippy@zipsea.com>';
        const fallbackEmail = 'ZipSea <onboarding@resend.dev>';
        
        console.log('📧 Sending email with parameters:', {
          from: fromEmail,
          to: userEmail,
          subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`
        });

        let { data, error } = await resend.emails.send({
          from: fromEmail,
          to: [userEmail],
          subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`,
          html: emailHtml,
        });
        
        // If domain not verified, try with Resend's domain
        if (error && error.message && error.message.includes('domain')) {
          console.log('🔄 Domain not verified, trying with Resend default domain...');
          const fallbackResult = await resend.emails.send({
            from: fallbackEmail,
            to: [userEmail],
            subject: `Your Cruise Quote Request - ${cruiseData?.name || 'Cruise'} | ZipSea`,
            html: emailHtml,
          });
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) {
          console.error('❌ Resend API error:', error);
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            fullError: JSON.stringify(error, null, 2)
          });
        } else {
          emailSent = true;
          console.log('✅ Email sent successfully!', {
            resendId: data?.id,
            to: userEmail,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error sending email via Resend:', error);
        // Continue - email is optional
      }
    } else {
      console.log('Email service not configured - emails disabled. Configure RESEND_API_KEY to enable email confirmations.');
    }

    // Return success if at least we logged the request
    console.log('Quote submission completed:', {
      backendSaved,
      slackSent,
      emailSent,
      userEmail,
      cruiseId: cruiseData?.id
    });

    return NextResponse.json({ 
      success: true, 
      details: {
        backendSaved,
        slackSent,
        emailSent
      }
    });

  } catch (error: any) {
    console.error('API error:', error);
    const errorMessage = error?.message || 'Internal server error';
    const errorDetails = {
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    };
    return NextResponse.json(errorDetails, { status: 500 });
  }
}