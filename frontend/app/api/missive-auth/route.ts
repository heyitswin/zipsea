import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { generateMissiveHmac } from '../../../lib/hmac';

export async function GET(request: NextRequest) {
  try {
    // Get the current authenticated user from Clerk
    const user = await currentUser();
    
    if (!user || !user.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json(
        { error: 'User not authenticated or no email found' },
        { status: 401 }
      );
    }

    const email = user.emailAddresses[0].emailAddress;
    const name = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.firstName || user.lastName || 'Anonymous';

    // Generate HMAC hash for Missive authentication
    const hash = generateMissiveHmac(email);

    return NextResponse.json({
      success: true,
      data: {
        name,
        email,
        hash
      }
    });

  } catch (error) {
    console.error('Error generating Missive auth:', error);
    return NextResponse.json(
      { error: 'Failed to generate Missive authentication' },
      { status: 500 }
    );
  }
}