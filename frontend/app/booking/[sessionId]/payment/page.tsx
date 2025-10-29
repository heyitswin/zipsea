"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "../../../context/BookingContext";
import BookingSummary from "../../../components/BookingSummary";
import PricingSummary from "../../../components/PricingSummary";
import {
  detectCardType,
  formatCardNumber,
} from "../../../../lib/cardTypeDetection";

interface BookingSummary {
  passengers?: any[];
  leadContact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  cruise?: any;
  cabin?: any;
}

export default function BookingPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { passengerCount, clearSession } = useBooking();

  const [bookingSummary, setBookingSummary] = useState<BookingSummary>({});
  const [cardNumber, setCardNumber] = useState("");
  const [cardType, setCardType] = useState<string | null>(null);
  const [cardTypeName, setCardTypeName] = useState<string | null>(null);
  const [traveltekCardCode, setTraveltekCardCode] = useState<string | null>(
    null,
  );
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Special requests removed from UI - keeping backend support for future use
  // const [specialRequests, setSpecialRequests] = useState<string>("");
  const [selectedPerk, setSelectedPerk] = useState<string>("wifi");
  const [cancellationPolicyUrl, setCancellationPolicyUrl] = useState<
    string | null
  >(null);
  const [cruiseLineName, setCruiseLineName] = useState<string>("");

  useEffect(() => {
    // Load booking data from localStorage
    if (typeof window !== "undefined") {
      const passengers = localStorage.getItem("bookingPassengers");
      const leadContact = localStorage.getItem("leadContact");

      setBookingSummary({
        passengers: passengers ? JSON.parse(passengers) : undefined,
        leadContact: leadContact ? JSON.parse(leadContact) : undefined,
      });
    }

    // Note: Hold booking functionality has been removed
    // This page now only handles full payment bookings
  }, [sessionId]);

  useEffect(() => {
    // Fetch cruise line cancellation policy URL
    const fetchCancellationPolicy = async () => {
      try {
        // First get session data to get cruise ID
        const sessionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/booking/session/${sessionId}`,
        );
        if (!sessionResponse.ok) return;

        const sessionData = await sessionResponse.json();
        if (!sessionData.cruiseId) return;

        // Get cruise data to get cruise line ID
        const cruiseResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cruises/${sessionData.cruiseId}`,
        );
        if (!cruiseResponse.ok) return;

        const cruiseData = await cruiseResponse.json();
        const cruise = cruiseData.data || cruiseData;

        // Check for cruise line ID in multiple possible locations
        const lineId =
          cruise.cruiseLineId || cruise.lineid || cruise.cruiseLine?.id;

        if (lineId) {
          console.log("🚢 Cruise line ID:", lineId);

          // Get cruise line data
          const lineResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/cruise-lines/${lineId}`,
          );
          if (!lineResponse.ok) {
            console.error(
              "❌ Failed to fetch cruise line data:",
              lineResponse.status,
            );
            return;
          }

          const lineData = await lineResponse.json();
          console.log("📋 Cruise line data:", lineData);
          console.log(
            "🔗 Cancellation policy URL:",
            lineData.cancellationPolicyUrl,
          );

          setCruiseLineName(lineData.name || "");
          if (lineData.cancellationPolicyUrl) {
            setCancellationPolicyUrl(lineData.cancellationPolicyUrl);
          } else {
            console.warn(
              "⚠️ No cancellation policy URL found for",
              lineData.name,
            );
          }
        } else {
          console.warn("⚠️ No cruise line ID found in cruise data");
        }
      } catch (error) {
        console.error("Error fetching cancellation policy:", error);
      }
    };

    fetchCancellationPolicy();
  }, [sessionId]);

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(" ") : cleaned;
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate payment fields (required for all bookings)
    if (!cardNumber.replace(/\s/g, "")) {
      newErrors.cardNumber = "Card number is required";
    } else if (cardNumber.replace(/\s/g, "").length !== 16) {
      newErrors.cardNumber = "Card number must be 16 digits";
    }

    if (!expiryDate) {
      newErrors.expiryDate = "Expiry date is required";
    } else if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      newErrors.expiryDate = "Invalid format (MM/YY)";
    }

    if (!cvv) {
      newErrors.cvv = "CVV is required";
    } else if (!/^\d{3,4}$/.test(cvv)) {
      newErrors.cvv = "CVV must be 3 or 4 digits";
    }

    if (!cardName.trim()) {
      newErrors.cardName = "Cardholder name is required";
    }

    if (!agreedToTerms) {
      newErrors.terms = "You must agree to the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirmBooking = async () => {
    console.log("🔘 Confirm booking clicked");

    if (!validateForm()) {
      console.log("❌ Validation failed");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    console.log("✅ Validation passed");
    setIsProcessing(true);

    try {
      // Get lead contact info from localStorage (entered in options page)
      if (!bookingSummary.leadContact) {
        console.error("❌ No lead contact found");
        throw new Error("No contact information found");
      }

      console.log("✅ Lead contact found:", bookingSummary.leadContact);

      // Verify we have passenger data
      if (
        !bookingSummary.passengers ||
        bookingSummary.passengers.length === 0
      ) {
        console.error("❌ No passenger data found");
        throw new Error("No passenger data found");
      }

      // Process payment booking
      // Parse expiry date (MM/YY format)
      const [expiryMonth, expiryYear] = expiryDate.split("/");

      // Get total amount from the basket/pricing
      // TODO: This should come from the basket API response
      const totalAmount = 2487.36;

      // Format request according to backend API contract
      const requestBody = {
        passengers: bookingSummary.passengers,
        contact: {
          firstName: bookingSummary.leadContact.firstName,
          lastName: bookingSummary.leadContact.lastName,
          email: bookingSummary.leadContact.email,
          phone: bookingSummary.leadContact.phone,
          address: bookingSummary.leadContact.address,
          city: bookingSummary.leadContact.city || "",
          state: bookingSummary.leadContact.state || "",
          postalCode: bookingSummary.leadContact.postalCode || "",
          country: "US",
        },
        payment: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardType: traveltekCardCode || "VIS", // Default to Visa if detection fails
          expiryMonth,
          expiryYear: `20${expiryYear}`, // Convert YY to YYYY
          cardholderName: cardName,
          cvv,
          amount: totalAmount,
        },
        dining: "anytime", // Hardcoded to anytime dining
        // specialRequests removed from UI - backend still supports it for future use
      };

      // Call booking API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/booking/${sessionId}/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Booking failed");
      }

      const data = await response.json();

      // Clear session and booking data
      clearSession();
      if (typeof window !== "undefined") {
        localStorage.removeItem("bookingPassengers");
        localStorage.removeItem("leadContact");
      }

      // Navigate to success page
      router.push(
        `/booking/${sessionId}/success?confirmationId=${data.confirmationNumber || data.bookingId}`,
      );
    } catch (error) {
      console.error("Booking error:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Failed to process booking. Please try again.",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand pt-20">
      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Booking Summary and Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Summary with Passengers */}
            <BookingSummary
              sessionId={sessionId}
              passengers={bookingSummary.passengers}
              showPassengers={true}
            />

            {/* Payment Form or Hold Booking Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
                Payment Information
              </h3>

              {errors.submit && (
                <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg mb-4">
                  {errors.submit}
                </div>
              )}

              {/* Payment Form */}
              <div className="space-y-4">
                <div>
                  <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                    Card Number *
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => {
                      const input = e.target.value.slice(0, 19);
                      const formatted = formatCardNumber(input);
                      setCardNumber(formatted);

                      // Detect card type in real-time
                      const detected = detectCardType(input);
                      setCardType(detected.type);
                      setCardTypeName(detected.name);
                      setTraveltekCardCode(detected.traveltekCode);

                      if (errors.cardNumber) {
                        const newErrors = { ...errors };
                        delete newErrors.cardNumber;
                        setErrors(newErrors);
                      }
                    }}
                    className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                      errors.cardNumber ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                  />
                  {errors.cardNumber && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.cardNumber}
                    </p>
                  )}
                  {cardTypeName && traveltekCardCode && (
                    <p className="text-green-600 text-sm mt-1 flex items-center gap-2">
                      <span>✓</span>
                      <span>{cardTypeName} detected</span>
                    </p>
                  )}
                  {cardNumber.length > 4 && !traveltekCardCode && (
                    <p className="text-orange-600 text-sm mt-1">
                      ⚠ Card type not supported. Please use Visa, Mastercard,
                      American Express, Maestro, or Diners Club.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                      Expiry Date *
                    </label>
                    <input
                      type="text"
                      value={expiryDate}
                      onChange={(e) => {
                        const formatted = formatExpiryDate(e.target.value);
                        setExpiryDate(formatted);
                        if (errors.expiryDate) {
                          const newErrors = { ...errors };
                          delete newErrors.expiryDate;
                          setErrors(newErrors);
                        }
                      }}
                      className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                        errors.expiryDate ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="MM/YY"
                      maxLength={5}
                    />
                    {errors.expiryDate && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.expiryDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                      CVV *
                    </label>
                    <input
                      type="text"
                      value={cvv}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 4);
                        setCvv(value);
                        if (errors.cvv) {
                          const newErrors = { ...errors };
                          delete newErrors.cvv;
                          setErrors(newErrors);
                        }
                      }}
                      className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                        errors.cvv ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="123"
                      maxLength={4}
                    />
                    {errors.cvv && (
                      <p className="text-red-500 text-sm mt-1">{errors.cvv}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                    Cardholder Name *
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => {
                      setCardName(e.target.value);
                      if (errors.cardName) {
                        const newErrors = { ...errors };
                        delete newErrors.cardName;
                        setErrors(newErrors);
                      }
                    }}
                    className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                      errors.cardName ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="John Doe"
                  />
                  {errors.cardName && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.cardName}
                    </p>
                  )}
                </div>

                {/* Terms & Conditions */}
                <div className="pt-4">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => {
                        setAgreedToTerms(e.target.checked);
                        if (errors.terms) {
                          const newErrors = { ...errors };
                          delete newErrors.terms;
                          setErrors(newErrors);
                        }
                      }}
                      className="mt-1 mr-3 w-4 h-4"
                    />
                    <span className="font-geograph text-[14px] text-dark-blue">
                      I agree to the{" "}
                      <a href="/terms" className="text-blue-600 underline">
                        terms and conditions
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" className="text-blue-600 underline">
                        privacy policy
                      </a>
                    </span>
                  </label>
                  {errors.terms && (
                    <p className="text-red-500 text-sm mt-1">{errors.terms}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Choose Your Free Perk */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-3">
                Choose Your Free Perk
              </h3>
              <p className="font-geograph text-[14px] text-gray-600 mb-4">
                Zipsea is providing a free gift to you for booking with us
              </p>
              <div className="space-y-3">
                <label className="flex items-center p-4 rounded-lg border border-gray-300 hover:border-dark-blue cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="perk"
                    value="wifi"
                    checked={selectedPerk === "wifi"}
                    onChange={(e) => setSelectedPerk(e.target.value)}
                    className="mr-3 w-4 h-4"
                  />
                  <div>
                    <div className="font-geograph font-medium text-[16px] text-dark-blue">
                      Free WiFi for 1 Passenger
                    </div>
                  </div>
                </label>

                <label className="flex items-center p-4 rounded-lg border border-gray-300 hover:border-dark-blue cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="perk"
                    value="drinks"
                    checked={selectedPerk === "drinks"}
                    onChange={(e) => setSelectedPerk(e.target.value)}
                    className="mr-3 w-4 h-4"
                  />
                  <div>
                    <div className="font-geograph font-medium text-[16px] text-dark-blue">
                      Free Drink Package for 1 Passenger
                    </div>
                  </div>
                </label>

                <label className="flex items-center p-4 rounded-lg border border-gray-300 hover:border-dark-blue cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="perk"
                    value="dining"
                    checked={selectedPerk === "dining"}
                    onChange={(e) => setSelectedPerk(e.target.value)}
                    className="mr-3 w-4 h-4"
                  />
                  <div>
                    <div className="font-geograph font-medium text-[16px] text-dark-blue">
                      2 Specialty Dining Credits
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Cancellation Policy */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
                Cancellation Policy
              </h3>
              <p className="font-geograph text-[14px] text-gray-700 mb-3">
                This cancellation policy is set by the cruise line. Zipsea does
                not add, remove, change, or modify policies.
              </p>
              {cancellationPolicyUrl ? (
                <a
                  href={cancellationPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-geograph text-[14px] text-blue-600 hover:text-blue-800 underline"
                >
                  View{" "}
                  {cruiseLineName ? `${cruiseLineName}'s` : "Cruise Line's"}{" "}
                  Cancellation Policy
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 2H14V6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.66667 9.33333L14 2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              ) : (
                <p className="font-geograph text-[14px] text-gray-600 italic">
                  Please contact the cruise line directly for their cancellation
                  policy.
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Pricing Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-[100px] space-y-4">
              <PricingSummary sessionId={sessionId} />

              {/* Confirm & Pay Button */}
              <button
                onClick={handleConfirmBooking}
                disabled={isProcessing}
                className={`w-full font-geograph font-medium text-[16px] px-6 py-4 rounded-[5px] transition-colors ${
                  isProcessing
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90"
                }`}
              >
                {isProcessing ? "Processing..." : "Confirm & Pay"}
              </button>

              <p className="font-geograph text-[12px] text-gray-600 text-center">
                Your payment is secure and encrypted
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <button
            onClick={() => router.push(`/booking/${sessionId}/passengers`)}
            className="font-geograph font-medium text-[16px] px-6 py-3 rounded-[5px] bg-white text-dark-blue border border-gray-300 hover:border-dark-blue transition-colors"
          >
            Back to Passengers
          </button>
        </div>
      </div>
    </div>
  );
}
