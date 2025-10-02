"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useUser } from "../../hooks/useClerkHooks";

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    async function handleAuthCallback() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        router.push("/sign-in");
        return;
      }

      // Wait for user data to be available
      if (!user?.emailAddresses?.[0]?.emailAddress) {
        console.log("Waiting for user data to load...");
        return;
      }

      // Check for pending quote
      const hasPendingQuote =
        searchParams.get("pendingQuote") === "true" ||
        sessionStorage.getItem("hasPendingQuote") === "true";

      const pendingQuoteData = sessionStorage.getItem("pendingQuote");

      if (hasPendingQuote && pendingQuoteData) {
        try {
          // Parse and submit the pending quote
          const quoteData = JSON.parse(pendingQuoteData);
          quoteData.userEmail = user.emailAddresses[0].emailAddress;

          const response = await fetch("/api/send-quote-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quoteData),
          });

          if (response.ok) {
            // Clear pending quote data
            sessionStorage.removeItem("pendingQuote");
            sessionStorage.removeItem("hasPendingQuote");

            // Redirect to success page (returnUrl is preserved in sessionStorage)
            router.push("/quote-success");
          } else {
            const errorText = await response.text();
            console.error(
              "Failed to submit quote:",
              response.status,
              errorText,
            );
            // Clear data and go to success anyway - quote might have been created
            sessionStorage.removeItem("pendingQuote");
            sessionStorage.removeItem("hasPendingQuote");
            router.push("/quote-success");
          }
        } catch (error) {
          console.error("Error submitting pending quote:", error);
          // Clear data and go to success anyway
          sessionStorage.removeItem("pendingQuote");
          sessionStorage.removeItem("hasPendingQuote");
          router.push("/quote-success");
        }
      } else {
        handleNormalRedirect();
      }
    }

    function handleNormalRedirect() {
      const returnUrl = sessionStorage.getItem("returnUrl") || "/";
      sessionStorage.removeItem("returnUrl");
      router.push(returnUrl);
    }

    handleAuthCallback();
  }, [isLoaded, isSignedIn, router, searchParams, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-700">
          Completing sign in...
        </h2>
        <p className="text-gray-500 mt-2">
          Please wait while we process your request.
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-700">Loading...</h2>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
