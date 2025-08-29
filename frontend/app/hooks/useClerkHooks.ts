'use client';

import { useUser as useClerkUser, useSignIn as useClerkSignIn, useSignUp as useClerkSignUp } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

// Check if we're in the browser environment
const isBrowser = typeof window !== 'undefined';

// Check if Clerk is properly configured
const isClerkConfigured = () => {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return publishableKey && publishableKey !== 'your_clerk_publishable_key_here';
};

// Wrapper for useUser hook
export const useUser = () => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Return default state during SSR or if not mounted
  if (!isMounted || !isBrowser || !isClerkConfigured()) {
    return {
      isSignedIn: false,
      user: null,
      isLoaded: false, // Set to false during SSR to prevent premature rendering
    };
  }
  
  try {
    return useClerkUser();
  } catch {
    return {
      isSignedIn: false,
      user: null,
      isLoaded: true,
    };
  }
};

// Wrapper for useSignIn hook
export const useSignIn = () => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !isBrowser || !isClerkConfigured()) {
    return {
      signIn: null,
      isLoaded: false,
    };
  }
  
  try {
    return useClerkSignIn();
  } catch {
    return {
      signIn: null,
      isLoaded: true,
    };
  }
};

// Wrapper for useSignUp hook
export const useSignUp = () => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !isBrowser || !isClerkConfigured()) {
    return {
      signUp: null,
      isLoaded: false,
    };
  }
  
  try {
    return useClerkSignUp();
  } catch {
    return {
      signUp: null,
      isLoaded: true,
    };
  }
};