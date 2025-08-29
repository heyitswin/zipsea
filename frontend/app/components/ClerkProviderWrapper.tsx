'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ReactNode } from 'react';

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

export default function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('Clerk Debug:', {
      hasKey: !!publishableKey,
      keyPrefix: publishableKey?.substring(0, 7),
      domain: window.location.hostname
    });
  }
  
  // Only wrap with ClerkProvider if we have a valid publishable key
  if (!publishableKey || publishableKey === 'your_clerk_publishable_key_here' || !publishableKey.startsWith('pk_')) {
    console.warn('Clerk not initialized: Invalid or missing publishable key');
    return <>{children}</>;
  }

  // Note: The domain is configured in Clerk dashboard and encoded in the publishable key
  // The key pk_live_Y2xlcmsuemlwc2VhLmNvbSQ is configured for zipsea.com
  // Clerk will automatically use the correct domain based on the key

  try {
    return (
      <ClerkProvider 
        publishableKey={publishableKey}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      >
        {children}
      </ClerkProvider>
    );
  } catch (error) {
    console.error('Clerk initialization error:', error);
    return <>{children}</>;
  }
}