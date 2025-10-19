"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function BookingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmationId = searchParams.get("confirmationId");
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Countdown to redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              className="text-green-600"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Success Message */}
          <h1 className="font-whitney text-[36px] md:text-[48px] text-dark-blue uppercase mb-4">
            Booking Confirmed!
          </h1>
          <p className="font-geograph text-[18px] md:text-[20px] text-dark-blue mb-8">
            Your cruise vacation is all set. Get ready for an amazing adventure!
          </p>

          {/* Confirmation Number */}
          {confirmationId && (
            <div className="bg-purple-obc rounded-lg p-6 mb-8">
              <p className="font-geograph text-[14px] text-dark-blue mb-2">
                Confirmation Number
              </p>
              <p className="font-whitney text-[28px] text-dark-blue uppercase tracking-wider">
                {confirmationId}
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-sand rounded-lg p-6 mb-8 text-left">
            <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
              What's Next?
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-green-600 mr-3 mt-1">✓</span>
                <span className="font-geograph text-[16px] text-dark-blue">
                  Check your email for booking confirmation and cruise details
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-3 mt-1">✓</span>
                <span className="font-geograph text-[16px] text-dark-blue">
                  You'll receive your e-tickets 2-3 days before departure
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-3 mt-1">✓</span>
                <span className="font-geograph text-[16px] text-dark-blue">
                  A cruise specialist will contact you within 24 hours
                </span>
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push("/")}
              className="font-geograph font-medium text-[16px] px-8 py-3 rounded-full bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90 transition-colors"
            >
              Browse More Cruises
            </button>
            <button
              onClick={() => window.print()}
              className="font-geograph font-medium text-[16px] px-8 py-3 rounded-full bg-white text-dark-blue border border-gray-300 hover:border-dark-blue transition-colors"
            >
              Print Confirmation
            </button>
          </div>

          {/* Auto Redirect Notice */}
          <p className="font-geograph text-[14px] text-gray-600 mt-8">
            Redirecting to homepage in {countdown} seconds...
          </p>
        </div>

        {/* Support Info */}
        <div className="text-center mt-8">
          <p className="font-geograph text-[14px] text-dark-blue">
            Need help? Contact us at{" "}
            <a
              href="mailto:support@zipsea.com"
              className="text-blue-600 underline"
            >
              support@zipsea.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
