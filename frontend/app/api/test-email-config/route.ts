import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  const config = {
    hasResendKey: !!resendApiKey,
    keyLength: resendApiKey?.length || 0,
    isPlaceholder: resendApiKey === 'your_resend_api_key_here',
    isEmpty: resendApiKey?.trim() === '',
    keyPreview: resendApiKey ? `${resendApiKey.slice(0, 8)}...` : 'Not set',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
  
  console.log('Email configuration check:', config);
  
  return NextResponse.json({
    message: 'Email configuration status',
    config,
    ready: !!(resendApiKey && resendApiKey !== 'your_resend_api_key_here' && resendApiKey.trim() !== '')
  });
}