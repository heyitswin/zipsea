'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// PostHog configuration
const POSTHOG_KEY = 'phc_9MXhzdvabRIsC3XyL25fQFYM72Mv2YK4HEcaVuX45dd';
const POSTHOG_HOST = 'https://us.i.posthog.com';

if (typeof window !== 'undefined') {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll handle this manually for better control
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      enabled: true,
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
        email: false, // We want to see email inputs for debugging
      },
    },
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('PostHog loaded');
      }
    },
  });
}

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + '?' + searchParams.toString();
      }
      
      // Track page view with additional context
      posthog.capture('$pageview', {
        $current_url: url,
        path: pathname,
        search: searchParams?.toString() || '',
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}