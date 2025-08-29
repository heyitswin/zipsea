import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables (don't expose sensitive values)
    const config = {
      hasResendKey: !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here',
      hasSlackWebhook: !!process.env.SLACK_WEBHOOK_URL && process.env.SLACK_WEBHOOK_URL !== 'your_slack_webhook_url_here',
      hasClerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'your_clerk_publishable_key_here',
      hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'your_clerk_secret_key_here',
      hasBackendUrl: !!process.env.BACKEND_URL || !!process.env.NEXT_PUBLIC_BACKEND_URL,
      nodeEnv: process.env.NODE_ENV,
      resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 7) || 'not set',
      clerkKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 7) || 'not set',
      backendUrl: process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'not set',
    };

    return NextResponse.json({
      success: true,
      config,
      timestamp: new Date().toISOString(),
      // Add a simple test to see if we can send a basic notification
      readyForQuotes: config.hasResendKey || config.hasSlackWebhook
    });

  } catch (error: any) {
    console.error('Config test error:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}