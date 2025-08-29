'use client';

import { useUser } from './useClerkHooks';

export function useAdmin() {
  const { user, isLoaded } = useUser();
  
  if (!isLoaded) {
    return { isAdmin: false, isLoading: true };
  }
  
  // Check if user has admin role in publicMetadata
  // This needs to be set in Clerk dashboard or via API
  const isAdmin = user?.publicMetadata?.role === 'admin';
  
  return { 
    isAdmin, 
    isLoading: false,
    user 
  };
}