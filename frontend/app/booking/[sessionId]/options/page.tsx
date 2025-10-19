"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "../../../context/BookingContext";

export default function BookingOptionsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { passengerCount } = useBooking();

  const [diningPreference, setDiningPreference] = useState<string>("anytime");
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    setIsSubmitting(true);

    try {
      // Save options to session/localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "bookingOptions",
          JSON.stringify({
            diningPreference,
            specialRequests,
          })
        );
      }

      // Navigate to passengers page
      router.push(`/booking/${sessionId}/passengers`);
    } catch (error) {
      console.error("Error saving options:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand">
      {/* Header */}
      <div className="bg-purple-obc py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-whitney text-[32px] md:text-[42px] text-dark-blue uppercase mb-2">
            Booking Options
          </h1>
          <p className="font-geograph text-[16px] text-dark-blue">
            Step 1 of 3 • Customize your cruise experience
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              <div className="w-8 h-8 rounded-full bg-dark-blue text-white flex items-center justify-center font-geograph font-bold text-sm">
                1
              </div>
              <div className="flex-1 h-1 bg-dark-blue mx-2"></div>
            </div>
            <div className="flex items-center flex-1">
              <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-geograph font-bold text-sm">
                2
              </div>
              <div className="flex-1 h-1 bg-gray-300 mx-2"></div>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-geograph font-bold text-sm">
                3
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-geograph text-xs text-dark-blue font-medium">
              Options
            </span>
            <span className="font-geograph text-xs text-gray-500">
              Passengers
            </span>
            <span className="font-geograph text-xs text-gray-500">Payment</span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 mb-6">
          {/* Dining Preference */}
          <div className="mb-8">
            <label className="block font-geograph font-bold text-[18px] text-dark-blue mb-3">
              Dining Preference
            </label>
            <p className="font-geograph text-[14px] text-gray-600 mb-4">
              Choose your preferred dining time
            </p>
            <div className="space-y-3">
              <label className="flex items-center p-4 rounded-lg border border-gray-300 hover:border-dark-blue cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="dining"
                  value="anytime"
                  checked={diningPreference === "anytime"}
                  onChange={(e) => setDiningPreference(e.target.value)}
                  className="mr-3 w-4 h-4"
                />
                <div>
                  <div className="font-geograph font-medium text-[16px] text-dark-blue">
                    Anytime Dining
                  </div>
                  <div className="font-geograph text-[14px] text-gray-600">
                    Flexible dining times between 5:30 PM - 9:30 PM
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 rounded-lg border border-gray-300 hover:border-dark-blue cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="dining"
                  value="early"
                  checked={diningPreference === "early"}
                  onChange={(e) => setDiningPreference(e.target.value)}
                  className="mr-3 w-4 h-4"
                />
                <div>
                  <div className="font-geograph font-medium text-[16px] text-dark-blue">
                    Early Seating
                  </div>
                  <div className="font-geograph text-[14px] text-gray-600">
                    Fixed time around 6:00 PM
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 rounded-lg border border-gray-300 hover:border-dark-blue cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="dining"
                  value="late"
                  checked={diningPreference === "late"}
                  onChange={(e) => setDiningPreference(e.target.value)}
                  className="mr-3 w-4 h-4"
                />
                <div>
                  <div className="font-geograph font-medium text-[16px] text-dark-blue">
                    Late Seating
                  </div>
                  <div className="font-geograph text-[14px] text-gray-600">
                    Fixed time around 8:30 PM
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block font-geograph font-bold text-[18px] text-dark-blue mb-3">
              Special Requests{" "}
              <span className="text-gray-500 font-normal text-[14px]">
                (Optional)
              </span>
            </label>
            <p className="font-geograph text-[14px] text-gray-600 mb-4">
              Let us know if you have any dietary restrictions, accessibility
              needs, or special occasions
            </p>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="E.g., Celebrating our anniversary, need wheelchair accessible cabin, vegetarian diet..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue resize-none"
              maxLength={500}
            />
            <div className="font-geograph text-[12px] text-gray-500 mt-1 text-right">
              {specialRequests.length}/500 characters
            </div>
          </div>
        </div>

        {/* Passenger Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="font-geograph font-bold text-[16px] text-dark-blue mb-3">
            Booking Summary
          </h3>
          <div className="font-geograph text-[14px] text-gray-700">
            <p>
              {passengerCount.adults}{" "}
              {passengerCount.adults === 1 ? "Adult" : "Adults"}
              {passengerCount.children > 0 &&
                `, ${passengerCount.children} ${passengerCount.children === 1 ? "Child" : "Children"}`}
            </p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="font-geograph font-medium text-[16px] px-6 py-3 rounded-full bg-white text-dark-blue border border-gray-300 hover:border-dark-blue transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={isSubmitting}
            className={`font-geograph font-medium text-[16px] px-8 py-3 rounded-full transition-colors ${
              isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90"
            }`}
          >
            {isSubmitting ? "Saving..." : "Continue to Passengers"}
          </button>
        </div>
      </div>
    </div>
  );
}
