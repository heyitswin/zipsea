"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function QuoteSuccessPage() {
  const router = useRouter();
  const [returnUrl, setReturnUrl] = useState("/cruises");

  useEffect(() => {
    // Get the return URL from sessionStorage (includes search params)
    const savedReturnUrl = sessionStorage.getItem("quoteReturnUrl");
    if (savedReturnUrl) {
      setReturnUrl(savedReturnUrl);
      sessionStorage.removeItem("quoteReturnUrl");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-lg shadow-lg p-12">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h1
            className="font-whitney font-black text-[40px] text-dark-blue uppercase mb-4"
            style={{ letterSpacing: "-0.02em" }}
          >
            Your quote request has been sent!
          </h1>

          <p
            className="font-geograph text-[20px] text-[#2f2f2f] leading-[1.6] mb-8"
            style={{ letterSpacing: "-0.02em" }}
          >
            We're working on the best price for you, watch your email!
          </p>

          {/* CTA Button */}
          <button
            onClick={() => router.push(returnUrl)}
            className="bg-[#2f7ddd] text-white font-geograph font-medium text-[18px] px-8 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors"
          >
            Continue browsing cruises
          </button>
        </div>
      </div>
    </div>
  );
}
