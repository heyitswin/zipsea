"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "../../../context/BookingContext";
import BookingSummary from "../../../components/BookingSummary";

interface BookingSummary {
  passengers?: any[];
  leadContact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
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
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [selectedPerk, setSelectedPerk] = useState<string>("wifi");

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
  }, []);

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
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsProcessing(true);

    try {
      // Get lead contact info from localStorage (entered in options page)
      if (!bookingSummary.leadContact) {
        throw new Error("No contact information found");
      }
      if (
        !bookingSummary.passengers ||
        bookingSummary.passengers.length === 0
      ) {
        throw new Error("No passenger data found");
      }

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
          city: "",
          state: "",
          postalCode: "",
          country: "US",
        },
        payment: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryMonth,
          expiryYear: `20${expiryYear}`, // Convert YY to YYYY
          cardholderName: cardName,
          cvv,
          amount: totalAmount,
        },
        dining: "anytime", // Hardcoded to anytime dining
        specialRequests: specialRequests || undefined,
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
        {/* Booking Summary */}
        <div className="mb-6">
          <BookingSummary sessionId={sessionId} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Booking Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Passengers Summary */}
            {bookingSummary.passengers && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
                  Passengers ({bookingSummary.passengers.length})
                </h3>
                <div className="space-y-3">
                  {bookingSummary.passengers.map(
                    (passenger: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0"
                      >
                        <div>
                          <p className="font-geograph font-medium text-[16px] text-dark-blue">
                            {passenger.firstName} {passenger.lastName}
                          </p>
                          <p className="font-geograph text-[14px] text-gray-600">
                            {index === 0
                              ? "Lead Passenger"
                              : `Guest ${index + 1}`}
                          </p>
                        </div>
                        {index === 0 && passenger.email && (
                          <p className="font-geograph text-[14px] text-gray-600">
                            {passenger.email}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Special Requests */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-3">
                Special Requests{" "}
                <span className="text-gray-500 font-normal text-[14px]">
                  (Optional)
                </span>
              </h3>
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
              <p className="font-geograph text-[14px] text-gray-700">
                This cancellation policy is set by the cruise line. Please refer
                to the cruise line's cancellation policy. Zipsea does not add,
                remove, change, or modify policies.
              </p>
            </div>

            {/* Payment Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
                Payment Information
              </h3>

              {errors.submit && (
                <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg mb-4">
                  {errors.submit}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                    Card Number *
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => {
                      const formatted = formatCardNumber(
                        e.target.value.slice(0, 19),
                      );
                      setCardNumber(formatted);
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
          </div>

          {/* Right Column - Price Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
              <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
                Price Summary
              </h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="font-geograph text-[14px] text-gray-600">
                    Cruise Fare
                  </span>
                  <span className="font-geograph text-[14px] text-dark-blue">
                    $2,200.00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-geograph text-[14px] text-gray-600">
                    Taxes & Fees
                  </span>
                  <span className="font-geograph text-[14px] text-dark-blue">
                    $287.36
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="font-geograph font-bold text-[18px] text-dark-blue">
                      Total
                    </span>
                    <span className="font-geograph font-bold text-[18px] text-dark-blue">
                      $2,487.36
                    </span>
                  </div>
                  <p className="font-geograph text-[12px] text-gray-600 mt-2">
                    For {passengerCount.adults}{" "}
                    {passengerCount.adults === 1 ? "guest" : "guests"}
                  </p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="font-geograph font-bold text-[14px] text-green-800 mb-1">
                  Included Perks
                </p>
                <p className="font-geograph text-[14px] text-green-700">
                  +$497 Onboard Credit
                </p>
              </div>

              <button
                onClick={handleConfirmBooking}
                disabled={isProcessing}
                className={`w-full font-geograph font-medium text-[16px] px-6 py-4 rounded-[5px] transition-colors ${
                  isProcessing
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90"
                }`}
              >
                {isProcessing ? "Processing..." : "Confirm & Pay $2,487.36"}
              </button>

              <p className="font-geograph text-[12px] text-gray-600 text-center mt-4">
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
