"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "../../../context/BookingContext";

interface PassengerData {
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export default function BookingPassengersPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { passengerCount } = useBooking();

  const totalPassengers = passengerCount.adults + passengerCount.children;

  // Initialize passenger data array
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>(
    {},
  );

  useEffect(() => {
    // Initialize empty passenger forms
    const initialPassengers: PassengerData[] = [];
    for (let i = 0; i < totalPassengers; i++) {
      initialPassengers.push({
        title: "",
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: "",
        nationality: "US", // Default to United States
        email: i === 0 ? "" : undefined, // Only lead passenger needs contact info
        phone: i === 0 ? "" : undefined,
        address: i === 0 ? "" : undefined,
        city: i === 0 ? "" : undefined,
        state: i === 0 ? "" : undefined,
        zipCode: i === 0 ? "" : undefined,
        country: i === 0 ? "US" : undefined,
      });
    }
    setPassengers(initialPassengers);
  }, [totalPassengers]);

  const updatePassenger = (
    index: number,
    field: keyof PassengerData,
    value: string,
  ) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);

    // Clear error for this field
    if (errors[index]?.[field]) {
      const newErrors = { ...errors };
      delete newErrors[index][field];
      setErrors(newErrors);
    }
  };

  const validateForm = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let isValid = true;

    passengers.forEach((passenger, index) => {
      const passengerErrors: Record<string, string> = {};

      // Required fields for all passengers
      if (!passenger.title) {
        passengerErrors.title = "Title is required";
        isValid = false;
      }
      if (!passenger.firstName.trim()) {
        passengerErrors.firstName = "First name is required";
        isValid = false;
      }
      if (!passenger.lastName.trim()) {
        passengerErrors.lastName = "Last name is required";
        isValid = false;
      }
      if (!passenger.dateOfBirth) {
        passengerErrors.dateOfBirth = "Date of birth is required";
        isValid = false;
      }
      if (!passenger.gender) {
        passengerErrors.gender = "Gender is required";
        isValid = false;
      }
      if (!passenger.nationality) {
        passengerErrors.nationality = "Nationality is required";
        isValid = false;
      }

      // Additional validation for lead passenger (index 0)
      if (index === 0) {
        if (!passenger.email?.trim()) {
          passengerErrors.email = "Email is required";
          isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email)) {
          passengerErrors.email = "Invalid email address";
          isValid = false;
        }
        if (!passenger.phone?.trim()) {
          passengerErrors.phone = "Phone number is required";
          isValid = false;
        }
        if (!passenger.address?.trim()) {
          passengerErrors.address = "Address is required";
          isValid = false;
        }
        if (!passenger.city?.trim()) {
          passengerErrors.city = "City is required";
          isValid = false;
        }
        if (!passenger.state?.trim()) {
          passengerErrors.state = "State is required";
          isValid = false;
        }
        if (!passenger.zipCode?.trim()) {
          passengerErrors.zipCode = "ZIP code is required";
          isValid = false;
        }
      }

      if (Object.keys(passengerErrors).length > 0) {
        newErrors[index] = passengerErrors;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleContinue = async () => {
    if (!validateForm()) {
      // Scroll to first error
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save passenger data to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("bookingPassengers", JSON.stringify(passengers));
      }

      // Navigate to payment page
      router.push(`/booking/${sessionId}/payment`);
    } catch (error) {
      console.error("Error saving passenger data:", error);
      setIsSubmitting(false);
    }
  };

  const getPassengerLabel = (index: number) => {
    if (index === 0) return "Lead Passenger";
    if (index < passengerCount.adults) return `Guest ${index + 1}`;
    return `Child ${index - passengerCount.adults + 1}`;
  };

  return (
    <div className="min-h-screen bg-sand">
      {/* Header */}
      <div className="bg-purple-obc py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-whitney text-[32px] md:text-[42px] text-dark-blue uppercase mb-2">
            Passenger Details
          </h1>
          <p className="font-geograph text-[16px] text-dark-blue">
            Step 2 of 3 • Enter passenger information
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-geograph font-bold text-sm">
                ✓
              </div>
              <div className="flex-1 h-1 bg-dark-blue mx-2"></div>
            </div>
            <div className="flex items-center flex-1">
              <div className="w-8 h-8 rounded-full bg-dark-blue text-white flex items-center justify-center font-geograph font-bold text-sm">
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
            <span className="font-geograph text-xs text-green-600 font-medium">
              Options
            </span>
            <span className="font-geograph text-xs text-dark-blue font-medium">
              Passengers
            </span>
            <span className="font-geograph text-xs text-gray-500">Payment</span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {passengers.map((passenger, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 mb-6"
          >
            <h3 className="font-geograph font-bold text-[20px] text-dark-blue mb-6">
              {getPassengerLabel(index)}
              {index === 0 && (
                <span className="ml-2 text-sm font-normal text-gray-600">
                  (Primary Contact)
                </span>
              )}
            </h3>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                  Title *
                </label>
                <select
                  value={passenger.title}
                  onChange={(e) =>
                    updatePassenger(index, "title", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                    errors[index]?.title ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="">Select title</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Ms">Ms</option>
                  <option value="Miss">Miss</option>
                  <option value="Dr">Dr</option>
                </select>
                {errors[index]?.title && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[index].title}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={passenger.firstName}
                  onChange={(e) =>
                    updatePassenger(index, "firstName", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                    errors[index]?.firstName
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  placeholder="John"
                />
                {errors[index]?.firstName && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[index].firstName}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={passenger.lastName}
                  onChange={(e) =>
                    updatePassenger(index, "lastName", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                    errors[index]?.lastName
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  placeholder="Doe"
                />
                {errors[index]?.lastName && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[index].lastName}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={passenger.dateOfBirth}
                  onChange={(e) =>
                    updatePassenger(index, "dateOfBirth", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                    errors[index]?.dateOfBirth
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {errors[index]?.dateOfBirth && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[index].dateOfBirth}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                  Gender *
                </label>
                <select
                  value={passenger.gender}
                  onChange={(e) =>
                    updatePassenger(index, "gender", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                    errors[index]?.gender ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
                {errors[index]?.gender && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[index].gender}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                  Nationality *
                </label>
                <select
                  value={passenger.nationality}
                  onChange={(e) =>
                    updatePassenger(index, "nationality", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                    errors[index]?.nationality
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                >
                  <option value="">Select nationality</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="NZ">New Zealand</option>
                  <option value="IE">Ireland</option>
                  <option value="FR">France</option>
                  <option value="DE">Germany</option>
                  <option value="IT">Italy</option>
                  <option value="ES">Spain</option>
                  <option value="PT">Portugal</option>
                  <option value="NL">Netherlands</option>
                  <option value="BE">Belgium</option>
                  <option value="CH">Switzerland</option>
                  <option value="AT">Austria</option>
                  <option value="SE">Sweden</option>
                  <option value="NO">Norway</option>
                  <option value="DK">Denmark</option>
                  <option value="FI">Finland</option>
                  <option value="MX">Mexico</option>
                  <option value="BR">Brazil</option>
                  <option value="AR">Argentina</option>
                  <option value="CL">Chile</option>
                  <option value="JP">Japan</option>
                  <option value="KR">South Korea</option>
                  <option value="CN">China</option>
                  <option value="IN">India</option>
                  <option value="SG">Singapore</option>
                  <option value="ZA">South Africa</option>
                </select>
                {errors[index]?.nationality && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors[index].nationality}
                  </p>
                )}
              </div>
            </div>

            {/* Lead Passenger Contact Info */}
            {index === 0 && (
              <>
                <h4 className="font-geograph font-bold text-[16px] text-dark-blue mb-4 mt-6">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={passenger.email || ""}
                      onChange={(e) =>
                        updatePassenger(index, "email", e.target.value)
                      }
                      className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                        errors[index]?.email
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="john@example.com"
                    />
                    {errors[index]?.email && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors[index].email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={passenger.phone || ""}
                      onChange={(e) =>
                        updatePassenger(index, "phone", e.target.value)
                      }
                      className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                        errors[index]?.phone
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="(555) 123-4567"
                    />
                    {errors[index]?.phone && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors[index].phone}
                      </p>
                    )}
                  </div>
                </div>

                <h4 className="font-geograph font-bold text-[16px] text-dark-blue mb-4 mt-6">
                  Billing Address
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      value={passenger.address || ""}
                      onChange={(e) =>
                        updatePassenger(index, "address", e.target.value)
                      }
                      className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                        errors[index]?.address
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="123 Main St"
                    />
                    {errors[index]?.address && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors[index].address}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        value={passenger.city || ""}
                        onChange={(e) =>
                          updatePassenger(index, "city", e.target.value)
                        }
                        className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                          errors[index]?.city
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        placeholder="New York"
                      />
                      {errors[index]?.city && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[index].city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                        State *
                      </label>
                      <input
                        type="text"
                        value={passenger.state || ""}
                        onChange={(e) =>
                          updatePassenger(index, "state", e.target.value)
                        }
                        className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                          errors[index]?.state
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        placeholder="NY"
                      />
                      {errors[index]?.state && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[index].state}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-geograph font-medium text-[14px] text-dark-blue mb-2">
                        ZIP Code *
                      </label>
                      <input
                        type="text"
                        value={passenger.zipCode || ""}
                        onChange={(e) =>
                          updatePassenger(index, "zipCode", e.target.value)
                        }
                        className={`w-full px-4 py-3 border rounded-lg font-geograph text-[16px] focus:outline-none focus:border-dark-blue ${
                          errors[index]?.zipCode
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        placeholder="10001"
                      />
                      {errors[index]?.zipCode && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[index].zipCode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push(`/booking/${sessionId}/options`)}
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
            {isSubmitting ? "Saving..." : "Continue to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
