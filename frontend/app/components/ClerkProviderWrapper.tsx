'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ReactNode } from 'react';

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

export default function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Only wrap with ClerkProvider if we have a valid publishable key
  if (!publishableKey || publishableKey === 'your_clerk_publishable_key_here' || !publishableKey.startsWith('pk_')) {
    return <>{children}</>;
  }

  // For production keys (pk_live_), use the main domain as configured in Clerk
  // For test keys (pk_test_), use default or custom domain
  const domain = publishableKey.startsWith('pk_live_') 
    ? 'zipsea.com'  // Production keys are configured for main domain
    : process.env.NEXT_PUBLIC_CLERK_DOMAIN || undefined;

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      domain={domain}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}