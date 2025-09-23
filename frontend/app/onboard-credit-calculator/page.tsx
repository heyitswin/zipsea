"use client";
import { useState, useEffect } from "react";

// Pricing data structure for each cruise line
interface CruiseLinePricing {
  gratuities: number; // per day
  beveragePackage: number; // per day
  specialtyDining: number; // per meal
  wifi: number; // per day
  spaService: number; // per service
  photoPackage: number; // one time
  shoreExcursion: number; // per excursion
}

// Hardcoded pricing data based on provided document
const cruiseLinePricing: Record<string, CruiseLinePricing> = {
  "Royal Caribbean": {
    gratuities: 18.5,
    beveragePackage: 95, // mid-range of $75-115
    specialtyDining: 50, // mid-range of $45-65
    wifi: 26.99,
    spaService: 179, // mid-range of $159-229
    photoPackage: 161, // mid-range of packages
    shoreExcursion: 115, // mid-range of $80-150
  },
  Carnival: {
    gratuities: 16.0,
    beveragePackage: 69.95,
    specialtyDining: 52,
    wifi: 18.7,
    spaService: 159,
    photoPackage: 299,
    shoreExcursion: 100,
  },
  Princess: {
    gratuities: 17.0,
    beveragePackage: 65, // Plus package
    specialtyDining: 45, // included in packages but standalone price
    wifi: 24.99,
    spaService: 179,
    photoPackage: 150,
    shoreExcursion: 107,
  },
  Celebrity: {
    gratuities: 18.0,
    beveragePackage: 89.99,
    specialtyDining: 55,
    wifi: 30, // estimated
    spaService: 189,
    photoPackage: 175,
    shoreExcursion: 122,
  },
  "Disney Cruise Line": {
    gratuities: 16.0,
    beveragePackage: 0, // No packages, using 0
    specialtyDining: 95, // average of Remy and Palo
    wifi: 35, // estimated as individual pricing
    spaService: 199,
    photoPackage: 225,
    shoreExcursion: 135,
  },
  "Holland America": {
    gratuities: 17.0,
    beveragePackage: 55.95,
    specialtyDining: 33, // average of options
    wifi: 25, // included in packages but standalone estimate
    spaService: 179,
    photoPackage: 162,
    shoreExcursion: 117,
  },
  MSC: {
    gratuities: 16.0,
    beveragePackage: 50,
    specialtyDining: 40, // estimated
    wifi: 25, // estimated
    spaService: 179,
    photoPackage: 200,
    shoreExcursion: 110,
  },
};

interface SpendingItem {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  isDaily?: boolean;
}

export default function OnboardCreditCalculator() {
  const [obcAmount, setObcAmount] = useState<number>(250);
  const [cruiseLine, setCruiseLine] = useState<string>("Royal Caribbean");
  const [cruiseDays, setCruiseDays] = useState<number>(7);
  const [spending, setSpending] = useState<SpendingItem[]>([]);
  const [remainingCredit, setRemainingCredit] = useState<number>(0);

  // Initialize spending items when cruise line changes or on mount
  useEffect(() => {
    const pricing = cruiseLinePricing[cruiseLine];
    const initialSpending: SpendingItem[] = [
      {
        id: "gratuities",
        name: "Daily Gratuities",
        unit: "per day",
        unitPrice: pricing.gratuities,
        quantity: 0,
        isDaily: true,
      },
      {
        id: "beverage",
        name: "Beverage Package",
        unit: "per day",
        unitPrice: pricing.beveragePackage,
        quantity: 0,
        isDaily: true,
      },
      {
        id: "dining",
        name: "Specialty Dining",
        unit: "per meal",
        unitPrice: pricing.specialtyDining,
        quantity: 0,
      },
      {
        id: "wifi",
        name: "WiFi Package",
        unit: "per day",
        unitPrice: pricing.wifi,
        quantity: 0,
        isDaily: true,
      },
      {
        id: "spa",
        name: "Spa Services",
        unit: "per treatment",
        unitPrice: pricing.spaService,
        quantity: 0,
      },
      {
        id: "photo",
        name: "Photo Package",
        unit: "package",
        unitPrice: pricing.photoPackage,
        quantity: 0,
      },
      {
        id: "excursion",
        name: "Shore Excursions",
        unit: "per excursion",
        unitPrice: pricing.shoreExcursion,
        quantity: 0,
      },
    ];

    // Set default allocations
    autoAllocateCredit(initialSpending, pricing);
  }, [cruiseLine, obcAmount, cruiseDays]);

  // Auto-allocate credit with smart defaults
  const autoAllocateCredit = (
    items: SpendingItem[],
    pricing: CruiseLinePricing,
  ) => {
    let tempSpending = [...items];
    let remainingOBC = obcAmount;

    // Priority 1: Gratuities (essential)
    const gratuitiesTotal = pricing.gratuities * cruiseDays;
    if (remainingOBC >= gratuitiesTotal) {
      tempSpending[0].quantity = cruiseDays;
      remainingOBC -= gratuitiesTotal;
    } else {
      tempSpending[0].quantity = Math.floor(remainingOBC / pricing.gratuities);
      remainingOBC -= tempSpending[0].quantity * pricing.gratuities;
    }

    // Priority 2: 2 specialty dining meals (if enough credit)
    if (remainingOBC >= pricing.specialtyDining * 2) {
      tempSpending[2].quantity = 2;
      remainingOBC -= pricing.specialtyDining * 2;
    } else if (remainingOBC >= pricing.specialtyDining) {
      tempSpending[2].quantity = 1;
      remainingOBC -= pricing.specialtyDining;
    }

    // Priority 3: 1 shore excursion (if enough credit)
    if (remainingOBC >= pricing.shoreExcursion) {
      tempSpending[6].quantity = 1;
      remainingOBC -= pricing.shoreExcursion;
    }

    // Priority 4: WiFi for half the days (if enough credit)
    const halfDaysWifi = Math.ceil(cruiseDays / 2);
    const wifiCost = pricing.wifi * halfDaysWifi;
    if (remainingOBC >= wifiCost) {
      tempSpending[3].quantity = halfDaysWifi;
      remainingOBC -= wifiCost;
    }

    // Priority 5: Photo package (if enough credit)
    if (remainingOBC >= pricing.photoPackage) {
      tempSpending[5].quantity = 1;
      remainingOBC -= pricing.photoPackage;
    }

    // Remainder stays as leftover
    setSpending(tempSpending);
    setRemainingCredit(remainingOBC);
  };

  // Calculate total spent
  const calculateTotalSpent = () => {
    return spending.reduce((total, item) => {
      const itemTotal = item.unitPrice * item.quantity;
      return total + itemTotal;
    }, 0);
  };

  // Update remaining credit when spending changes
  useEffect(() => {
    const totalSpent = calculateTotalSpent();
    setRemainingCredit(obcAmount - totalSpent);
  }, [spending, obcAmount]);

  // Handle quantity change
  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 0) return;

    const updatedSpending = spending.map((item) => {
      if (item.id === id) {
        // For daily items, cap at cruise days
        if (item.isDaily) {
          return { ...item, quantity: Math.min(newQuantity, cruiseDays) };
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    });

    // Check if we're over budget
    const newTotal = updatedSpending.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );

    if (newTotal <= obcAmount) {
      setSpending(updatedSpending);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section
        className="relative pt-[100px] pb-[80px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[42px] md:text-[72px] leading-tight"
            style={{ color: "#F7F170", letterSpacing: "-0.02em" }}
          >
            Onboard Credit Calculator
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[20px] mt-6 leading-relaxed">
            Plan how to spend your onboard credit wisely
          </p>
        </div>
      </section>

      {/* Separator Image */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-5.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Main Content */}
      <main
        style={{ backgroundColor: "#E9B4EB" }}
        className="py-[40px] md:py-[80px]"
      >
        <div className="max-w-6xl mx-auto px-8">
          {/* Introduction */}
          <div className="bg-white rounded-lg p-6 md:p-8 mb-8 shadow-sm">
            <p
              className="font-geograph text-[16px] md:text-[18px]"
              style={{ color: "#0E1B4D" }}
            >
              Use this calculator to plan how you'll spend your onboard credit
              during your cruise. Enter your total credit amount, select your
              cruise line, and customize how you want to allocate your spending
              across various onboard experiences.
            </p>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-geograph text-[14px] md:text-[16px] text-gray-700">
                <strong>Disclaimer:</strong> Prices shown are estimates based on
                average cruise line pricing and may vary depending on your
                specific ship, sailing date, and itinerary. Actual onboard
                prices may differ. Gratuities shown are per day, per person.
              </p>
            </div>
          </div>

          {/* Calculator Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Inputs */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg p-6 shadow-sm sticky top-8">
                <h2
                  className="font-geograph font-bold text-[24px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Your Cruise Details
                </h2>

                {/* OBC Amount */}
                <div className="mb-6">
                  <label
                    className="font-geograph font-medium text-[16px] mb-2 block"
                    style={{ color: "#0E1B4D" }}
                  >
                    Onboard Credit Amount ($)
                  </label>
                  <input
                    type="number"
                    value={obcAmount}
                    onChange={(e) =>
                      setObcAmount(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[18px]"
                    style={{ color: "#0E1B4D" }}
                    min="0"
                    step="50"
                  />
                </div>

                {/* Cruise Line */}
                <div className="mb-6">
                  <label
                    className="font-geograph font-medium text-[16px] mb-2 block"
                    style={{ color: "#0E1B4D" }}
                  >
                    Cruise Line
                  </label>
                  <select
                    value={cruiseLine}
                    onChange={(e) => setCruiseLine(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg font-geograph text-[18px] bg-white appearance-none"
                    style={{
                      color: "#0E1B4D",
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: "right 0.5rem center",
                      backgroundSize: "1.5em 1.5em",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <option value="Royal Caribbean">Royal Caribbean</option>
                    <option value="Carnival">Carnival</option>
                    <option value="Princess">Princess</option>
                    <option value="Celebrity">Celebrity</option>
                    <option value="Disney Cruise Line">
                      Disney Cruise Line
                    </option>
                    <option value="Holland America">Holland America</option>
                    <option value="MSC">MSC</option>
                  </select>
                </div>

                {/* Cruise Days */}
                <div className="mb-6">
                  <label
                    className="font-geograph font-medium text-[16px] mb-2 block"
                    style={{ color: "#0E1B4D" }}
                  >
                    Cruise Length (Days)
                  </label>
                  <input
                    type="number"
                    value={cruiseDays}
                    onChange={(e) =>
                      setCruiseDays(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-geograph text-[18px]"
                    style={{ color: "#0E1B4D" }}
                    min="1"
                    max="30"
                  />
                </div>

                {/* Summary */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex justify-between mb-3">
                    <span
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      Total Credit:
                    </span>
                    <span
                      className="font-geograph font-bold text-[18px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      ${obcAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between mb-3">
                    <span
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      Total Allocated:
                    </span>
                    <span
                      className="font-geograph font-bold text-[18px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      ${calculateTotalSpent().toFixed(2)}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between p-3 rounded-lg ${remainingCredit >= 0 ? "bg-green-50" : "bg-red-50"}`}
                  >
                    <span
                      className="font-geograph font-medium text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      {remainingCredit >= 0
                        ? "Remaining Credit:"
                        : "Over Budget:"}
                    </span>
                    <span
                      className={`font-geograph font-bold text-[18px] ${remainingCredit >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      ${Math.abs(remainingCredit).toFixed(2)}
                    </span>
                  </div>
                  {remainingCredit > 0 && (
                    <p className="mt-3 text-[14px] font-geograph text-gray-600">
                      Tip: Remaining credit can be used for miscellaneous
                      purchases, additional gratuities, or saved for onboard
                      shopping!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Spending Categories */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h2
                  className="font-geograph font-bold text-[24px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Customize Your Spending
                </h2>

                <div className="space-y-4">
                  {spending.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        {/* Item Info */}
                        <div className="md:col-span-1">
                          <h3
                            className="font-geograph font-medium text-[18px]"
                            style={{ color: "#0E1B4D" }}
                          >
                            {item.name}
                          </h3>
                          <p className="font-geograph text-[14px] text-gray-600">
                            ${item.unitPrice.toFixed(2)} {item.unit}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="md:col-span-1">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity - 1)
                              }
                              className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              style={{ color: "#0E1B4D" }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleQuantityChange(
                                  item.id,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg font-geograph"
                              style={{ color: "#0E1B4D" }}
                              min="0"
                              max={item.isDaily ? cruiseDays : 99}
                            />
                            <button
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity + 1)
                              }
                              className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              style={{ color: "#0E1B4D" }}
                            >
                              +
                            </button>
                          </div>
                          {item.isDaily && item.quantity > 0 && (
                            <p className="text-[12px] font-geograph text-gray-500 mt-1">
                              {item.quantity} of {cruiseDays} days
                            </p>
                          )}
                        </div>

                        {/* Subtotal */}
                        <div className="md:col-span-1 text-right">
                          <p
                            className="font-geograph font-bold text-[20px]"
                            style={{ color: "#0E1B4D" }}
                          >
                            ${(item.unitPrice * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Special notes for specific items */}
                      {item.id === "gratuities" && item.quantity > 0 && (
                        <p className="text-[13px] font-geograph text-gray-500 mt-2">
                          Covers automatic daily gratuities for your stateroom
                          attendant and dining staff
                        </p>
                      )}
                      {item.id === "beverage" &&
                        item.quantity > 0 &&
                        cruiseLine === "Disney Cruise Line" && (
                          <p className="text-[13px] font-geograph text-amber-600 mt-2">
                            Note: Disney Cruise Line doesn't offer beverage
                            packages. Consider individual drinks instead.
                          </p>
                        )}
                    </div>
                  ))}
                </div>

                {/* Tips Section */}
                <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    💡 Smart Spending Tips
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • Book specialty dining and spa services early for best
                      availability
                    </li>
                    <li>
                      • Consider if you'll actually use a full beverage package
                      vs. buying drinks à la carte
                    </li>
                    <li>
                      • Shore excursions booked through the cruise line ensure
                      the ship waits if you're late
                    </li>
                    <li>
                      • WiFi packages are usually cheaper when purchased for the
                      full voyage
                    </li>
                    <li>
                      • Photo packages capture memories but check if individual
                      photos might be more economical
                    </li>
                  </ul>
                </div>

                {/* Browse Cruises Callout */}
                <div
                  className="mt-8 p-6 rounded-lg"
                  style={{ backgroundColor: "#F7F170" }}
                >
                  <h3
                    className="font-geograph font-bold text-[20px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Ready to Book Your Cruise?
                  </h3>
                  <p
                    className="font-geograph text-[16px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Now that you've planned your onboard spending, browse
                    thousands of cruises and see exactly how much onboard credit
                    you'll get with Zipsea!
                  </p>
                  <a
                    href="/cruises"
                    className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                  >
                    Browse Cruises →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
