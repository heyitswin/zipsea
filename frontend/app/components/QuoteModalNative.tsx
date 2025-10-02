"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useAlert } from "../../components/GlobalAlertProvider";
import LoginSignupModal from "./LoginSignupModal";
import { trackQuoteProgress, trackQuoteSubmit } from "../../lib/analytics";

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cruiseData?: {
    id?: string;
    name?: string;
    cruiseLineName?: string;
    shipName?: string;
    sailingDate?: string;
    nights?: number;
  };
  cabinType?: string;
  cabinPrice?: string | number;
}

interface PassengerData {
  adults: number;
  children: number;
  childAges: number[];
}

interface DiscountData {
  payInFull: boolean;
  age55Plus: boolean;
  military: boolean;
  stateOfResidence: string;
  loyaltyNumber: string;
  travelInsurance: boolean;
  additionalNotes: string;
}

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

export default function QuoteModalNative({
  isOpen,
  onClose,
  cruiseData,
  cabinType,
  cabinPrice,
}: QuoteModalProps) {
  const { isSignedIn, user, isLoaded } = useUser();
  const { showAlert } = useAlert();
  const [passengers, setPassengers] = useState<PassengerData>({
    adults: 2,
    children: 0,
    childAges: [],
  });

  const [discounts, setDiscounts] = useState<DiscountData>({
    payInFull: false,
    age55Plus: false,
    military: false,
    stateOfResidence: "",
    loyaltyNumber: "",
    travelInsurance: false,
    additionalNotes: "",
  });

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Old localStorage code removed - now handled by auth/callback with sessionStorage

  if (!isOpen) return null;

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePassengerChange = (
    type: "adults" | "children",
    increment: boolean,
  ) => {
    setPassengers((prev) => {
      const currentValue = prev[type];
      let newValue: number;

      if (increment) {
        newValue = currentValue + 1;
      } else {
        newValue = Math.max(type === "adults" ? 1 : 0, currentValue - 1);
      }

      // Adjust child ages array when children count changes
      let newChildAges = [...prev.childAges];
      if (type === "children") {
        if (newValue > prev.children) {
          // Adding a child - add default age
          newChildAges.push(10);
        } else if (newValue < prev.children) {
          // Removing a child - remove last age
          newChildAges.pop();
        }
      }

      // Track passenger selection
      trackQuoteProgress("passenger_selection", {
        passenger_type: type,
        count: newValue,
        action: increment ? "increase" : "decrease",
      });

      return {
        ...prev,
        [type]: newValue,
        childAges: newChildAges,
      };
    });
  };

  const handleChildAgeChange = (index: number, value: string) => {
    const age = parseInt(value) || 0;
    setPassengers((prev) => ({
      ...prev,
      childAges: prev.childAges.map((a, i) => (i === index ? age : a)),
    }));
  };

  const handleDiscountChange = (
    field: keyof DiscountData,
    value: boolean | string,
  ) => {
    setDiscounts((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Track discount selections
    trackQuoteProgress("discount_selection", {
      discount_type: field,
      value: value,
    });
  };

  const handleGetFinalQuotes = async () => {
    if (!isSignedIn) {
      // Save quote data to sessionStorage for post-login submission
      const quoteData = {
        userEmail: null, // Will be filled after login
        cruiseData,
        passengers,
        discounts,
        cabinType,
        cabinPrice,
        travelInsurance: discounts.travelInsurance,
        additionalNotes: discounts.additionalNotes,
      };
      sessionStorage.setItem("pendingQuote", JSON.stringify(quoteData));

      // Save current URL with search params to return to after success
      sessionStorage.setItem(
        "quoteReturnUrl",
        window.location.pathname + window.location.search,
      );

      // Show login modal
      setShowLoginPrompt(true);
      return;
    }

    // User is logged in, send confirmation email
    try {
      const response = await fetch("/api/send-quote-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: user?.emailAddresses[0]?.emailAddress,
          cruiseData,
          passengers,
          discounts,
          cabinType,
          cabinPrice,
          travelInsurance: discounts.travelInsurance,
          additionalNotes: discounts.additionalNotes,
        }),
      });

      if (response.ok) {
        // Track successful quote submission
        const activeDiscounts = Object.entries(discounts)
          .filter(
            ([key, value]) =>
              value && key !== "stateOfResidence" && key !== "loyaltyNumber",
          )
          .map(([key]) => key);

        if (discounts.stateOfResidence)
          activeDiscounts.push("stateOfResidence");
        if (discounts.loyaltyNumber) activeDiscounts.push("loyaltyNumber");

        trackQuoteSubmit({
          cruiseId: cruiseData?.id || "",
          cabinType: cabinType || "",
          adults: passengers.adults,
          children: passengers.children,
          hasDiscounts: activeDiscounts.length > 0,
          discountTypes: activeDiscounts,
          travelInsurance: discounts.travelInsurance,
          estimatedPrice:
            typeof cabinPrice === "string"
              ? parseFloat(cabinPrice)
              : cabinPrice,
        });

        // Alert removed - success page shows message instead
        onClose();
      } else {
        showAlert(
          "There was an error submitting your quote request. Please try again.",
        );
      }
    } catch (error) {
      console.error("Error submitting quote request:", error);
      showAlert(
        "There was an error submitting your quote request. Please try again.",
      );
    }
  };

  return (
    <>
      {/* Main Quote Modal */}
      {!showLoginPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center md:p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          onClick={handleBackgroundClick}
        >
          <div
            className="bg-white w-full max-w-[760px] md:rounded-[10px] h-full md:h-auto md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 md:p-8">
              {/* Header */}
              <div className="mb-8 flex items-center justify-between">
                <h2
                  className="font-whitney font-black text-[24px] md:text-[32px] text-dark-blue uppercase"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  PASSENGERS
                </h2>
                {/* Mobile Close Button */}
                <button onClick={onClose} className="md:hidden p-2">
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

              {/* Passenger Input Section */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Adults */}
                <div>
                  <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                    ADULTS
                  </label>
                  <div className="flex items-center border border-[#d9d9d9] rounded-[10px] p-3">
                    <button
                      onClick={() => handlePassengerChange("adults", false)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                    >
                      <img
                        src="/images/minus.svg"
                        alt="Decrease"
                        className="w-4 h-4"
                      />
                    </button>
                    <span className="flex-1 text-center font-geograph text-[32px]">
                      {passengers.adults}
                    </span>
                    <button
                      onClick={() => handlePassengerChange("adults", true)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                    >
                      <img
                        src="/images/plus.svg"
                        alt="Increase"
                        className="w-4 h-4"
                      />
                    </button>
                  </div>
                </div>

                {/* Children */}
                <div>
                  <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                    CHILDREN
                  </label>
                  <div className="flex items-center border border-[#d9d9d9] rounded-[10px] p-3">
                    <button
                      onClick={() => handlePassengerChange("children", false)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                    >
                      <img
                        src="/images/minus.svg"
                        alt="Decrease"
                        className="w-4 h-4"
                      />
                    </button>
                    <span className="flex-1 text-center font-geograph text-[32px]">
                      {passengers.children}
                    </span>
                    <button
                      onClick={() => handlePassengerChange("children", true)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                    >
                      <img
                        src="/images/plus.svg"
                        alt="Increase"
                        className="w-4 h-4"
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Child Age Inputs - Only show if children are selected */}
              {passengers.children > 0 && (
                <div className="grid grid-cols-2 gap-6 mb-8">
                  {[...Array(Math.min(passengers.children, 2))].map(
                    (_, index) => (
                      <div key={index}>
                        <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                          CHILD {index + 1} AGE
                        </label>
                        <div className="border border-[#d9d9d9] rounded-[10px] p-3">
                          <input
                            type="number"
                            min="0"
                            max="17"
                            value={passengers.childAges[index] || 10}
                            onChange={(e) =>
                              handleChildAgeChange(index, e.target.value)
                            }
                            placeholder={`Child ${index + 1} age`}
                            className="w-full font-geograph text-[20px] text-center outline-none"
                          />
                        </div>
                      </div>
                    ),
                  )}
                  {/* Empty grid cell if only 1 child */}
                  {passengers.children === 1 && <div />}
                </div>
              )}

              {/* Travel Insurance Checkbox */}
              <div className="mb-8">
                <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative mr-3">
                      <input
                        type="checkbox"
                        checked={discounts.travelInsurance}
                        onChange={(e) =>
                          handleDiscountChange(
                            "travelInsurance",
                            e.target.checked,
                          )
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-6 h-6 border rounded flex items-center justify-center ${
                          discounts.travelInsurance
                            ? "bg-[#2F7DDD] border-[#2F7DDD]"
                            : "bg-white border-[#d9d9d9]"
                        }`}
                      >
                        {discounts.travelInsurance && (
                          <img
                            src="/images/checkmark.svg"
                            alt="Checked"
                            className="w-4 h-4"
                          />
                        )}
                      </div>
                    </div>
                    <span
                      className="font-geograph text-[18px] text-[#2f2f2f]"
                      style={{ letterSpacing: "0px" }}
                    >
                      I'm interested in travel insurance for this cruise
                    </span>
                  </label>
                </div>

                {/* Additional Notes Input */}
                <div className="border border-[#d9d9d9] rounded-[10px] p-4 mt-4">
                  <input
                    type="text"
                    value={discounts.additionalNotes}
                    onChange={(e) =>
                      handleDiscountChange("additionalNotes", e.target.value)
                    }
                    placeholder="Additional comments"
                    className="w-full border-none outline-none font-geograph text-[18px] text-[#2f2f2f] bg-transparent"
                    style={{ letterSpacing: "0px" }}
                  />
                </div>
              </div>

              {/* Discount Qualifiers Section */}
              <div className="mb-8">
                <h3
                  className="font-whitney font-black text-[24px] md:text-[32px] text-dark-blue uppercase mb-1"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  DISCOUNT QUALIFIERS
                </h3>
                <p
                  className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5] mb-6"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  All optional, but might help you get more discounts off your
                  cruise
                </p>

                <div className="space-y-4">
                  {/* Pay in Full Checkbox */}
                  <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative mr-3">
                        <input
                          type="checkbox"
                          checked={discounts.payInFull}
                          onChange={(e) =>
                            handleDiscountChange("payInFull", e.target.checked)
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-6 h-6 border rounded flex items-center justify-center ${
                            discounts.payInFull
                              ? "bg-[#2F7DDD] border-[#2F7DDD]"
                              : "bg-white border-[#d9d9d9]"
                          }`}
                        >
                          {discounts.payInFull && (
                            <img
                              src="/images/checkmark.svg"
                              alt="Checked"
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className="font-geograph text-[18px] text-[#2f2f2f]"
                        style={{ letterSpacing: "0px" }}
                      >
                        I want to pay in full/non-refundable
                      </span>
                    </label>
                  </div>

                  {/* 55+ Checkbox */}
                  <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative mr-3">
                        <input
                          type="checkbox"
                          checked={discounts.age55Plus}
                          onChange={(e) =>
                            handleDiscountChange("age55Plus", e.target.checked)
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-6 h-6 border rounded flex items-center justify-center ${
                            discounts.age55Plus
                              ? "bg-[#2F7DDD] border-[#2F7DDD]"
                              : "bg-white border-[#d9d9d9]"
                          }`}
                        >
                          {discounts.age55Plus && (
                            <img
                              src="/images/checkmark.svg"
                              alt="Checked"
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className="font-geograph text-[18px] text-[#2f2f2f]"
                        style={{ letterSpacing: "0px" }}
                      >
                        I am 55 or older
                      </span>
                    </label>
                  </div>

                  {/* Military Checkbox */}
                  <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative mr-3">
                        <input
                          type="checkbox"
                          checked={discounts.military}
                          onChange={(e) =>
                            handleDiscountChange("military", e.target.checked)
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-6 h-6 border rounded flex items-center justify-center ${
                            discounts.military
                              ? "bg-[#2F7DDD] border-[#2F7DDD]"
                              : "bg-white border-[#d9d9d9]"
                          }`}
                        >
                          {discounts.military && (
                            <img
                              src="/images/checkmark.svg"
                              alt="Checked"
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className="font-geograph text-[18px] text-[#2f2f2f]"
                        style={{ letterSpacing: "0px" }}
                      >
                        I am an active/retired military member or veteran
                      </span>
                    </label>
                  </div>

                  {/* State of Residence Dropdown */}
                  <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                    <select
                      value={discounts.stateOfResidence}
                      onChange={(e) =>
                        handleDiscountChange("stateOfResidence", e.target.value)
                      }
                      className="w-full border-none outline-none font-geograph text-[18px] text-[#2f2f2f] bg-transparent"
                      style={{ letterSpacing: "0px" }}
                    >
                      <option value="">State of Residence</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Loyalty Number Input */}
                  <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                    <input
                      type="text"
                      value={discounts.loyaltyNumber}
                      onChange={(e) =>
                        handleDiscountChange("loyaltyNumber", e.target.value)
                      }
                      placeholder="Loyalty Number"
                      className="w-full border-none outline-none font-geograph text-[18px] text-[#2f2f2f] bg-transparent"
                      style={{ letterSpacing: "0px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleGetFinalQuotes}
                className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors"
              >
                Get final quotes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login/Signup Modal */}
      {showLoginPrompt && (
        <LoginSignupModal
          isOpen={showLoginPrompt}
          onClose={() => {
            setShowLoginPrompt(false);
            // Clear pending quote if user cancels
            sessionStorage.removeItem("pendingQuote");
            sessionStorage.removeItem("quoteReturnUrl");
          }}
          onSuccess={() => {
            // Don't submit here - let auth callback handle it
            setShowLoginPrompt(false);
            onClose(); // Close quote modal
          }}
          hasPendingQuote={true}
        />
      )}
    </>
  );
}
