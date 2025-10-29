"use client";

import Image from "next/image";

interface HoldBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHoldBooking: () => void; // Route to booking flow with hold flag
  onPayNow: () => void; // Route to booking flow without hold flag
  cruiseName?: string;
  cabinType?: string;
  price?: number;
}

export default function HoldBookingModal({
  isOpen,
  onClose,
  onHoldBooking,
  onPayNow,
  cruiseName,
  cabinType,
  price,
}: HoldBookingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Full screen on mobile, centered on desktop */}
      <div className="flex min-h-full items-center justify-center md:p-4">
        <div className="relative w-full h-full min-h-screen md:min-h-0 md:h-auto md:max-w-2xl bg-white md:rounded-lg shadow-xl flex flex-col">
          {/* Header - Fixed on mobile and desktop */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
            <h2 className="font-geograph font-bold text-[24px] text-dark-blue">
              Reserve Your Cabin
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Cruise Info */}
            {cruiseName && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="font-geograph text-[14px] text-gray-600 mb-1">
                  Cruise
                </p>
                <p className="font-geograph font-bold text-[16px] text-dark-blue">
                  {cruiseName}
                </p>
                {cabinType && (
                  <p className="font-geograph text-[14px] text-gray-700 mt-1">
                    {cabinType}
                  </p>
                )}
                {price && (
                  <p className="font-geograph font-bold text-[18px] text-dark-blue mt-2">
                    ${price.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <p className="font-geograph text-[16px] text-gray-700 mb-6">
              Choose how you'd like to proceed with your booking:
            </p>

            {/* Option Cards */}
            <div className="space-y-4">
              {/* Hold Option - Temporarily Disabled */}
              <button
                onClick={() => {
                  alert(
                    'Hold booking coming soon! Please use "Book & Pay Now" for now.',
                  );
                }}
                className="w-full text-left p-6 border-2 border-gray-200 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-geograph font-bold text-[18px] text-gray-600">
                        Hold This Cabin (Free)
                      </h3>
                      <span className="font-geograph text-[12px] text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    </div>
                    <p className="font-geograph text-[14px] text-gray-500 mb-3">
                      Reserve your cabin now and complete payment later. No
                      credit card required.
                    </p>
                    <ul className="space-y-1">
                      <li className="font-geograph text-[14px] text-gray-700 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        7-day free hold period
                      </li>
                      <li className="font-geograph text-[14px] text-gray-700 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Complete booking flow without payment
                      </li>
                      <li className="font-geograph text-[14px] text-gray-700 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Price locked during hold period
                      </li>
                    </ul>
                  </div>
                </div>
              </button>

              {/* Pay Now Option */}
              <button
                onClick={onPayNow}
                className="w-full text-left p-6 border-2 border-gray-300 hover:border-blue-600 rounded-lg transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <svg
                      className="w-6 h-6 text-green-600 group-hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-2">
                      Book & Pay Now
                    </h3>
                    <p className="font-geograph text-[14px] text-gray-600 mb-3">
                      Complete your booking immediately with full passenger
                      details and payment.
                    </p>
                    <ul className="space-y-1">
                      <li className="font-geograph text-[14px] text-gray-700 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Instant confirmation
                      </li>
                      <li className="font-geograph text-[14px] text-gray-700 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Cabin guaranteed immediately
                      </li>
                      <li className="font-geograph text-[14px] text-gray-700 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Booking complete in one session
                      </li>
                    </ul>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
