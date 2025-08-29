import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey && resendApiKey !== 'your_resend_api_key_here' 
  ? new Resend(resendApiKey) 
  : null;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    // Check if Resend is configured
    if (!resend) {
      return NextResponse.json({ 
        error: 'Email service not configured. Check RESEND_API_KEY environment variable.',
        configured: false,
        apiKeyExists: !!resendApiKey,
        apiKeyValue: resendApiKey ? `${resendApiKey.substring(0, 7)}...` : 'Not set'
      }, { status: 500 });
    }

    // Send test email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZipSea Test Email</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            background-color: #2f7ddd;
            color: white;
            padding: 30px 40px;
            text-align: center;
          }
          .content {
            padding: 40px;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 30px 40px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ZipSea Test Email</h1>
          </div>
          
          <div class="content">
            <h2>Email System Test</h2>
            <p>This is a test email to verify that the ZipSea email system is working correctly.</p>
            
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Email Service: Resend</li>
              <li>From Address: quotes@zipsea.com</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
              <li>Environment: ${process.env.NODE_ENV || 'unknown'}</li>
            </ul>
            
            <p>If you received this email, the confirmation email system should be working properly.</p>
          </div>
          
          <div class="footer">
            <p><strong>ZipSea</strong><br>
            Email System Test</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'ZipSea Test <quotes@zipsea.com>',
      to: [email],
      subject: 'ZipSea Email System Test',
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error,
        configured: true
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      emailId: data?.id,
      configured: true,
      message: 'Test email sent successfully'
    });

  } catch (error: any) {
    console.error('Test email error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Internal server error',
      configured: !!resend
    }, { status: 500 });
  }
}