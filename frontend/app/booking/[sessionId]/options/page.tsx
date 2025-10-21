"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "../../../context/BookingContext";
import BookingSummary from "../../../components/BookingSummary";

export default function BookingOptionsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { passengerCount } = useBooking();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lead contact fields
  const [leadContact, setLeadContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleContinue = async () => {
    // Validate lead contact fields
    const newErrors: Record<string, string> = {};

    if (!leadContact.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!leadContact.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!leadContact.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadContact.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!leadContact.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!leadContact.address.trim()) {
      newErrors.address = "Address is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Save lead contact to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("leadContact", JSON.stringify(leadContact));
      }

      // Navigate to passengers page
      router.push(`/booking/${sessionId}/passengers`);
    } catch (error) {
      console.error("Error saving options:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand pt-20">
      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Booking Summary */}
        <BookingSummary sessionId={sessionId} />

        {/* Lead Contact Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 mb-6">
          <h2 className="font-geograph font-bold text-[20px] text-dark-blue mb-4">
            Contact Information
          </h2>
          <p className="font-geograph text-[14px] text-gray-600 mb-6">
            We'll use this information for booking confirmation and updates
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={leadContact.firstName}
                onChange={(e) =>
                  setLeadContact({ ...leadContact, firstName: e.target.value })
                }
                className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                  errors.firstName ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="John"
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={leadContact.lastName}
                onChange={(e) =>
                  setLeadContact({ ...leadContact, lastName: e.target.value })
                }
                className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                  errors.lastName ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={leadContact.email}
              onChange={(e) =>
                setLeadContact({ ...leadContact, email: e.target.value })
              }
              className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="john.doe@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={leadContact.phone}
              onChange={(e) =>
                setLeadContact({ ...leadContact, phone: e.target.value })
              }
              className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                errors.phone ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="(555) 123-4567"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
              Billing Address *
            </label>
            <input
              type="text"
              value={leadContact.address}
              onChange={(e) =>
                setLeadContact({ ...leadContact, address: e.target.value })
              }
              className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                errors.address ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="123 Main St, City, State, ZIP"
            />
            {errors.address && (
              <p className="text-red-500 text-sm mt-1">{errors.address}</p>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="font-geograph font-medium text-[16px] px-6 py-3 rounded-[5px] bg-white text-dark-blue border border-gray-300 hover:border-dark-blue transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={isSubmitting}
            className={`font-geograph font-medium text-[16px] px-8 py-3 rounded-[5px] transition-colors ${
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
