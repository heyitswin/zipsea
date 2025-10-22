"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function HoldConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/booking/${bookingId}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch booking details");
        }

        const data = await response.json();
        setBooking(data);
      } catch (err) {
        console.error("Error fetching booking:", err);
        setError("Unable to load booking details");
      } finally {
        setIsLoading(false);
      }
    };

    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center px-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="font-geograph font-bold text-[24px] text-dark-blue mb-4">
            Unable to Load Booking
          </h1>
          <p className="font-geograph text-[16px] text-gray-600 mb-6">
            {error || "Booking not found"}
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-geograph font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const holdExpiresAt = booking.holdExpiresAt
    ? new Date(booking.holdExpiresAt)
    : null;
  const daysRemaining = holdExpiresAt
    ? Math.ceil(
        (holdExpiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      )
    : 7;

  return (
    <div className="min-h-screen bg-sand py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="font-geograph font-bold text-[32px] text-dark-blue mb-4">
            Your Cabin is on Hold!
          </h1>

          <p className="font-geograph text-[18px] text-gray-700 mb-6">
            We've reserved your cabin for{" "}
            <span className="font-bold text-blue-600">
              {daysRemaining} days
            </span>
            . You'll receive a confirmation email shortly with all the details.
          </p>

          {booking.bookingDetails?.confirmationnumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 inline-block">
              <p className="font-geograph text-[14px] text-gray-600 mb-1">
                Confirmation Number
              </p>
              <p className="font-geograph font-bold text-[20px] text-dark-blue">
                {booking.bookingDetails.confirmationnumber}
              </p>
            </div>
          )}
        </div>

        {/* Booking Details */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="font-geograph font-bold text-[24px] text-dark-blue mb-6">
            Booking Details
          </h2>

          <div className="space-y-4">
            {booking.bookingDetails?.cruiseid && (
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="font-geograph text-[16px] text-gray-600">
                  Cruise
                </span>
                <span className="font-geograph font-medium text-[16px] text-dark-blue">
                  {booking.bookingDetails.cruiseid}
                </span>
              </div>
            )}

            {booking.totalAmount && (
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="font-geograph text-[16px] text-gray-600">
                  Total Price
                </span>
                <span className="font-geograph font-bold text-[18px] text-dark-blue">
                  ${parseFloat(booking.totalAmount).toLocaleString()}
                </span>
              </div>
            )}

            {holdExpiresAt && (
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="font-geograph text-[16px] text-gray-600">
                  Hold Expires
                </span>
                <span className="font-geograph font-medium text-[16px] text-dark-blue">
                  {holdExpiresAt.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}

            <div className="flex justify-between py-3">
              <span className="font-geograph text-[16px] text-gray-600">
                Amount Paid
              </span>
              <span className="font-geograph font-bold text-[18px] text-green-600">
                $0.00 (Hold Only)
              </span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="font-geograph font-bold text-[24px] text-dark-blue mb-6">
            What Happens Next?
          </h2>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="font-geograph font-bold text-[16px] text-blue-600">
                  1
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-2">
                  Check Your Email
                </h3>
                <p className="font-geograph text-[14px] text-gray-600">
                  We've sent a confirmation email to{" "}
                  {booking.passengers?.[0]?.email || "your email"} with a link
                  to complete your booking.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="font-geograph font-bold text-[16px] text-blue-600">
                  2
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-2">
                  Complete Your Booking
                </h3>
                <p className="font-geograph text-[14px] text-gray-600">
                  Within {daysRemaining} days, provide passenger details and
                  payment to finalize your cruise.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="font-geograph font-bold text-[16px] text-blue-600">
                  3
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-2">
                  Get Ready to Sail!
                </h3>
                <p className="font-geograph text-[14px] text-gray-600">
                  Once payment is complete, you'll receive your cruise documents
                  and can start planning your adventure.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex gap-3">
            <svg
              className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-geograph font-bold text-[16px] text-yellow-900 mb-2">
                Important: Your Hold Will Expire
              </h3>
              <p className="font-geograph text-[14px] text-yellow-800">
                If you don't complete your booking within {daysRemaining} days,
                your hold will be automatically released and the cabin may no
                longer be available at this price.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() =>
              router.push(`/booking/${bookingId}/complete-payment`)
            }
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-geograph font-bold text-[16px] py-4 rounded-lg transition-colors"
          >
            Complete Booking Now
          </button>

          <Link
            href="/"
            className="flex-1 bg-white hover:bg-gray-50 text-dark-blue border border-gray-300 font-geograph font-semibold text-[16px] py-4 rounded-lg transition-colors text-center"
          >
            Browse More Cruises
          </Link>
        </div>
      </div>
    </div>
  );
}
