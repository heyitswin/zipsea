"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// PostHog configuration
const POSTHOG_KEY = "phc_9MXhzdvabRIsC3XyL25fQFYM72Mv2YK4HEcaVuX45dd";
const POSTHOG_HOST = "https://us.i.posthog.com";

// Check if PostHog should be enabled
const isPostHogEnabled = () => {
  if (typeof window === "undefined") return false;

  // Check environment variable first
  const envEnabled = process.env.NEXT_PUBLIC_ENABLE_POSTHOG === "true";
  if (!envEnabled) {
    return false;
  }

  const hostname = window.location.hostname;

  // Only enable PostHog on production domains
  const productionDomains = [
    "zipsea.com",
    "www.zipsea.com",
    "api.zipsea.com",
    "zipsea-frontend-production.onrender.com",
  ];

  return productionDomains.some((domain) => hostname.includes(domain));
};

// Only initialize PostHog when enabled and in production
if (typeof window !== "undefined" && isPostHogEnabled()) {
  console.log(
    "[PostHog] Initializing for production environment:",
    window.location.hostname,
  );

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // We'll handle this manually for better control
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
        email: false, // We want to see email inputs for debugging
      },
    },
    persistence: "localStorage+cookie",
    cross_subdomain_cookie: true,
    loaded: (posthog) => {
      console.log("[PostHog] Successfully loaded for production");
    },
  });
} else if (typeof window !== "undefined") {
  console.log(
    "[PostHog] Skipping initialization - not in production environment or disabled:",
    typeof window !== "undefined" ? window.location.hostname : "SSR",
    "Env enabled:",
    process.env.NEXT_PUBLIC_ENABLE_POSTHOG,
  );
}

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only track if PostHog is initialized (production only)
    if (
      pathname &&
      typeof window !== "undefined" &&
      isPostHogEnabled() &&
      posthog
    ) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + "?" + searchParams.toString();
      }

      // Track page view with additional context
      posthog.capture("$pageview", {
        $current_url: url,
        path: pathname,
        search: searchParams?.toString() || "",
        environment: "production",
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
  // Only provide PostHog context when enabled
  if (typeof window !== "undefined" && !isPostHogEnabled()) {
    // In non-production, just return children without PostHog wrapper
    return <>{children}</>;
  }

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
