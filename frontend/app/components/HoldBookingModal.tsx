"use client";

import { useState } from "react";
import Image from "next/image";

interface HoldBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHold: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }) => Promise<void>;
  onPayNow: () => void;
  cruiseName?: string;
  cabinType?: string;
  price?: number;
}

export default function HoldBookingModal({
  isOpen,
  onClose,
  onHold,
  onPayNow,
  cruiseName,
  cabinType,
  price,
}: HoldBookingModalProps) {
  const [selectedOption, setSelectedOption] = useState<"hold" | "pay" | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleHoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      setError("All fields are required");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Phone validation (basic - at least 10 digits)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setIsSubmitting(true);

    try {
      await onHold({
        firstName,
        lastName,
        email,
        phone,
      });
      // Success handling is done in parent component
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create hold booking",
      );
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedOption(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setError("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-geograph font-bold text-[24px] text-dark-blue">
            Reserve Your Cabin
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
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

          {!selectedOption && (
            <>
              <p className="font-geograph text-[16px] text-gray-700 mb-6">
                Choose how you'd like to proceed with your booking:
              </p>

              {/* Option Cards */}
              <div className="space-y-4">
                {/* Hold Option */}
                <button
                  onClick={() => setSelectedOption("hold")}
                  className="w-full text-left p-6 border-2 border-gray-300 hover:border-blue-600 rounded-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                      <svg
                        className="w-6 h-6 text-blue-600 group-hover:text-white"
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
                      <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-2">
                        Hold This Cabin (Free)
                      </h3>
                      <p className="font-geograph text-[14px] text-gray-600 mb-3">
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
                          Only basic info needed
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
                          Complete booking details later
                        </li>
                      </ul>
                    </div>
                  </div>
                </button>

                {/* Pay Now Option */}
                <button
                  onClick={() => {
                    setSelectedOption("pay");
                    onPayNow();
                  }}
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
                          Cabin guaranteed
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
                          Booking complete in minutes
                        </li>
                      </ul>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Hold Form */}
          {selectedOption === "hold" && (
            <div>
              <button
                onClick={() => setSelectedOption(null)}
                disabled={isSubmitting}
                className="mb-4 font-geograph text-[14px] text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to options
              </button>

              <h3 className="font-geograph font-bold text-[20px] text-dark-blue mb-2">
                Hold Your Cabin
              </h3>
              <p className="font-geograph text-[14px] text-gray-600 mb-6">
                We'll hold this cabin for 7 days. You'll receive an email with
                a link to complete your booking.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-geograph text-[14px] text-red-700">
                    {error}
                  </p>
                </div>
              )}

              <form onSubmit={handleHoldSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-geograph text-[14px] text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block font-geograph text-[14px] text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-geograph text-[14px] text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
                    placeholder="john.smith@example.com"
                  />
                </div>

                <div>
                  <label className="block font-geograph text-[14px] text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-geograph text-[14px] text-blue-900">
                    <strong>What happens next?</strong>
                    <br />
                    We'll send you an email with a link to complete your booking
                    within 7 days. Your cabin will be held at this price during
                    that time.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-geograph font-bold text-[16px] py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {isSubmitting ? "Creating Hold..." : "Hold My Cabin"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
