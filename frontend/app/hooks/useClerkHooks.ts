'use client';

import { useUser as useClerkUser, useSignIn as useClerkSignIn, useSignUp as useClerkSignUp } from '@clerk/nextjs';

// Check if Clerk is properly configured
const isClerkConfigured = () => {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return publishableKey && publishableKey !== 'your_clerk_publishable_key_here';
};

// Wrapper for useUser hook
export const useUser = () => {
  if (!isClerkConfigured()) {
    return {
      isSignedIn: false,
      user: null,
      isLoaded: true,
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
  if (!isClerkConfigured()) {
    return {
      signIn: null,
      isLoaded: true,
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
  if (!isClerkConfigured()) {
    return {
      signUp: null,
      isLoaded: true,
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