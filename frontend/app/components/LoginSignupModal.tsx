"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "../hooks/useClerkHooks";
import { useRouter } from "next/navigation";
import { trackAuthEvent } from "../../lib/analytics";

interface LoginSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hasPendingQuote?: boolean;
}

export default function LoginSignupModal({
  isOpen,
  onClose,
  onSuccess,
  hasPendingQuote = false,
}: LoginSignupModalProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationMode, setVerificationMode] = useState<
    "signup" | "signin" | null
  >(null);
  const router = useRouter();

  // Import Clerk hooks directly to get setActive
  const {
    signIn,
    setActive: setActiveSignIn,
    isLoaded: signInLoaded,
  } = useSignIn() as any;
  const {
    signUp,
    setActive: setActiveSignUp,
    isLoaded: signUpLoaded,
  } = useSignUp() as any;

  if (!isOpen) return null;

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setMessage("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setMessage("");

    // Track auth start
    trackAuthEvent("signup_started", "email");

    try {
      // Check if signIn and signUp are available
      if (!signIn || !signUp) {
        setMessage(
          "Authentication service is not available. Please try refreshing the page.",
        );
        setIsLoading(false);
        return;
      }

      // Try to sign up first
      try {
        await signUp.create({ emailAddress: email });
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setMessage("Check your email for a verification code!");
        setShowCodeInput(true);
        setVerificationMode("signup");
        setIsLoading(false);
      } catch (signUpError: any) {
        // If email already exists, try sign in instead
        if (signUpError?.errors?.[0]?.code === "form_identifier_exists") {
          try {
            await signIn.create({ identifier: email });
            await signIn.prepareFirstFactor({
              strategy: "email_code",
            });
            setMessage("Check your email for a sign-in code!");
            setShowCodeInput(true);
            setVerificationMode("signin");
            setIsLoading(false);
          } catch (signInError: any) {
            console.error("Sign in error:", signInError);
            setMessage(
              "Error: " +
                (signInError.message || "Something went wrong with sign in"),
            );
            setIsLoading(false);
          }
        } else {
          throw signUpError;
        }
      }
    } catch (error: any) {
      console.error("Email auth error:", error);
      setMessage("Error: " + (error.message || "Something went wrong"));
      setIsLoading(false);
    }
  };

  const handleCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code) {
      setMessage("Please enter the verification code");
      return;
    }

    if (isLoading) {
      return; // Prevent double submission
    }

    setIsLoading(true);
    setMessage("Verifying code...");

    try {
      if (verificationMode === "signup") {
        const signUpAttempt = await signUp?.attemptEmailAddressVerification({
          code,
        });

        if (signUpAttempt?.status === "complete") {
          await setActiveSignUp?.({ session: signUpAttempt.createdSessionId });
          trackAuthEvent("signup_completed", "email");
          setMessage("✓ Sign up successful! Redirecting...");

          // Handle pending quote flow
          if (hasPendingQuote) {
            // Small delay to show success message
            setTimeout(() => {
              router.push("/auth/callback?pendingQuote=true");
            }, 800);
          } else {
            setTimeout(() => onSuccess(), 800);
          }
        } else {
          setMessage("Verification incomplete. Please try again.");
          setIsLoading(false);
        }
      } else if (verificationMode === "signin") {
        const signInAttempt = await signIn?.attemptFirstFactor({
          strategy: "email_code",
          code,
        });

        if (signInAttempt?.status === "complete") {
          await setActiveSignIn?.({ session: signInAttempt.createdSessionId });
          trackAuthEvent("login", "email");
          setMessage("✓ Sign in successful! Redirecting...");

          // Handle pending quote flow
          if (hasPendingQuote) {
            // Small delay to show success message
            setTimeout(() => {
              router.push("/auth/callback?pendingQuote=true");
            }, 800);
          } else {
            setTimeout(() => onSuccess(), 800);
          }
        } else {
          setMessage("Verification incomplete. Please try again.");
          setIsLoading(false);
        }
      }
    } catch (error: any) {
      console.error("Verification error:", error);

      // Handle specific error cases
      if (error.message?.includes("already been verified")) {
        setMessage("✓ Already verified! Redirecting...");
        // Still redirect even if already verified
        if (hasPendingQuote) {
          setTimeout(() => {
            router.push("/auth/callback?pendingQuote=true");
          }, 800);
        } else {
          setTimeout(() => onSuccess(), 800);
        }
      } else if (error.message?.includes("incorrect")) {
        setMessage("Incorrect code. Please check and try again.");
        setIsLoading(false);
      } else {
        setMessage("Invalid code. Please try again or request a new code.");
        setIsLoading(false);
      }
    }
  };

  const handleGoogleAuth = async () => {
    if (!signIn) {
      setMessage(
        "Authentication service is not available. Please try refreshing the page.",
      );
      return;
    }

    setIsLoading(true);
    trackAuthEvent("signup_started", "google");
    try {
      // Save the current URL to redirect back after auth
      if (typeof window !== "undefined") {
        sessionStorage.setItem("returnUrl", window.location.href);
      }

      // Save pending quote flag for OAuth callback
      if (hasPendingQuote) {
        sessionStorage.setItem("hasPendingQuote", "true");
      }

      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/auth/callback",
        redirectUrlComplete: "/auth/callback",
      });
    } catch (error: any) {
      console.error("Google auth error:", error);
      setMessage(
        "Error with Google sign in: " +
          (error.message || "Something went wrong"),
      );
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
      onClick={handleBackgroundClick}
    >
      <div
        className="bg-white w-full max-w-[530px] rounded-[10px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center">
          {/* Header */}
          <div className="mb-6">
            <h2
              className="font-whitney font-black text-[32px] text-dark-blue uppercase"
              style={{ letterSpacing: "-0.02em" }}
            >
              {showCodeInput ? "VERIFY EMAIL" : "SIGN UP / LOG IN"}
            </h2>
            <p
              className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5] mt-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              {showCodeInput
                ? "Enter the code we sent to your email"
                : "We'll email you as soon as your quote is ready"}
            </p>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`mb-6 p-3 rounded-lg text-sm ${
                message.includes("Error") ||
                message.includes("error") ||
                message.includes("Invalid")
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600"
              }`}
            >
              {message}
            </div>
          )}

          {!showCodeInput ? (
            /* Email Input Form */
            <form onSubmit={handleEmailSubmit}>
              <div className="mb-6">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full border border-[#d9d9d9] rounded-[10px] p-4 font-geograph text-[16px] text-center"
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors mb-6 disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Continue with Email"}
              </button>

              {/* Separator */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-geograph">
                    or
                  </span>
                </div>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-full py-4 px-6 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <img
                  src="/images/google-icon.svg"
                  alt="Google"
                  className="w-5 h-5"
                />
                <span className="font-geograph font-medium text-[16px] text-gray-700">
                  Continue with Google
                </span>
              </button>
            </form>
          ) : (
            /* Code Verification Form */
            <form onSubmit={handleCodeVerification}>
              <div className="mb-6">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full border border-[#d9d9d9] rounded-[10px] p-4 font-geograph text-[24px] text-center tracking-widest"
                  disabled={isLoading}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors mb-4 disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false);
                  setCode("");
                  setMessage("");
                  setVerificationMode(null);
                }}
                className="w-full border border-gray-300 text-gray-700 font-geograph font-medium text-[16px] px-6 py-3 rounded-full hover:bg-gray-50 transition-colors"
              >
                Back to Email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
