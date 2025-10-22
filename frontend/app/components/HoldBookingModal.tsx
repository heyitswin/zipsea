"use client";

import Image from "next/image";

interface HoldBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHoldBooking: () => void; // Simplified - just route to booking flow
  cruiseName?: string;
  cabinType?: string;
  price?: number;
}

export default function HoldBookingModal({
  isOpen,
  onClose,
  onHoldBooking,
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
        <div className="relative w-full h-full md:h-auto md:max-w-2xl bg-white md:rounded-lg shadow-xl flex flex-col">
          {/* Header - Fixed on mobile and desktop */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
            <h2 className="font-geograph font-bold text-[24px] text-dark-blue">
              Hold This Cabin
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
              Reserve this cabin now and complete payment later. We'll collect
              your passenger details and travel preferences, then give you 7
              days to finalize payment.
            </p>

            {/* Benefits List */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="font-geograph text-[15px] text-gray-700">
                  7-day free hold period
                </p>
              </div>
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="font-geograph text-[15px] text-gray-700">
                  No credit card required now
                </p>
              </div>
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="font-geograph text-[15px] text-gray-700">
                  Price locked in during hold period
                </p>
              </div>
            </div>

            {/* Info Box */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-geograph text-[14px] text-blue-900">
                <strong>What happens next?</strong>
                <br />
                We'll collect your passenger information and travel preferences.
                You'll receive an email with a link to complete payment within 7
                days.
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={onHoldBooking}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-geograph font-bold text-[16px] py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Continue to Hold Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
