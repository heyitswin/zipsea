'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

interface MissiveAuthData {
  name: string;
  email: string;
  hash: string;
}

declare global {
  interface Window {
    MissiveChatConfig?: {
      id: string;
      user?: {
        name: string;
        email: string;
        hash: string;
      };
    };
  }
}

export default function MissiveChat() {
  const [authData, setAuthData] = useState<MissiveAuthData | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch user auth data when component mounts on client
  useEffect(() => {
    if (isClient) {
      fetchUserAuth();
    }
  }, [isClient]);

  const fetchUserAuth = async () => {
    try {
      const response = await fetch('/api/missive-auth');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAuthData(result.data);
        }
      }
    } catch (error) {
      // User not authenticated or error occurred, continue without auth
      console.log('No user authentication available for Missive chat');
    }
  };

  // Set up Missive config
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      window.MissiveChatConfig = {
        id: "1fdede55-d083-4f5b-b821-0bfe25bdbf0c",
        ...(authData && {
          user: {
            name: authData.name,
            email: authData.email,
            hash: authData.hash
          }
        })
      };
    }
  }, [isClient, authData]);

  // Don't render anything on server-side
  if (!isClient) {
    return null;
  }

  return (
    <Script
      id="missive-chat"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(d, w) {
            // Ensure config exists
            if (!w.MissiveChatConfig) {
              w.MissiveChatConfig = { id: "1fdede55-d083-4f5b-b821-0bfe25bdbf0c" };
            }
            var s = d.createElement('script');
            s.async = true;
            s.src = 'https://webchat.missiveapp.com/' + w.MissiveChatConfig.id + '/missive.js';
            if (d.head) d.head.appendChild(s);
          })(document, window);
        `
      }}
    />
  );
}