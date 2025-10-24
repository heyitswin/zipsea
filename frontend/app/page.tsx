"use client";

import Image from "next/image";
import OptimizedImage from "../lib/OptimizedImage";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navigation from "./components/Navigation";
import { trackEngagement } from "../lib/analytics";

// Month options for the date selector
const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

// Cruise line options
const CRUISE_LINE_OPTIONS = [
  { value: "1", label: "Carnival" },
  { value: "22", label: "Royal Caribbean" },
  { value: "3", label: "Celebrity" },
  { value: "2", label: "Norwegian" },
  { value: "14", label: "Princess" },
  { value: "4", label: "Disney" },
  { value: "5", label: "MSC" },
  { value: "6", label: "Holland America" },
];

// Separate component to handle URL params (needs to be wrapped in Suspense)
function HomeWithParams() {
  const router = useRouter();

  // Search states
  const [selectedCruiseLine, setSelectedCruiseLine] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [passengerCount, setPassengerCount] = useState({
    adults: 2,
    children: 0,
    childAges: [] as number[],
  });

  // Dropdown states
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] =
    useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isPassengerDropdownOpen, setIsPassengerDropdownOpen] = useState(false);

  // Refs for click outside detection
  const cruiseLineRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const passengerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cruiseLineRef.current &&
        !cruiseLineRef.current.contains(event.target as Node)
      ) {
        setIsCruiseLineDropdownOpen(false);
      }
      if (
        monthRef.current &&
        !monthRef.current.contains(event.target as Node)
      ) {
        setIsMonthDropdownOpen(false);
      }
      if (
        passengerRef.current &&
        !passengerRef.current.contains(event.target as Node)
      ) {
        setIsPassengerDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle search
  const handleSearch = () => {
    const params = new URLSearchParams();

    if (selectedCruiseLine) {
      params.set("cruiseLines", selectedCruiseLine);
    }
    if (selectedMonth) {
      params.set("months", selectedMonth);
    }

    // Store passenger count in sessionStorage
    sessionStorage.setItem("passengerCount", JSON.stringify(passengerCount));

    // Track search
    trackEngagement("homepage_search", {
      cruiseLine: selectedCruiseLine || "any",
      month: selectedMonth || "any",
      passengers: passengerCount.adults + passengerCount.children,
    });

    router.push(`/cruises${params.toString() ? `?${params.toString()}` : ""}`);
  };

  // Get display text for dropdowns
  const getCruiseLineText = () => {
    if (!selectedCruiseLine) return "Cruise Line";
    const option = CRUISE_LINE_OPTIONS.find(
      (opt) => opt.value === selectedCruiseLine,
    );
    return option?.label || "Cruise Line";
  };

  const getMonthText = () => {
    if (!selectedMonth) return "Date";
    const option = MONTH_OPTIONS.find((opt) => opt.value === selectedMonth);
    return option?.label || "Date";
  };

  const getPassengerText = () => {
    const total = passengerCount.adults + passengerCount.children;
    return `${total} ${total === 1 ? "Guest" : "Guests"}`;
  };

  return (
    <>
      {/* Hero Section with Video Mask */}
      <section className="relative bg-sand overflow-hidden">
        {/* Container with max-width */}
        <div className="relative mx-auto" style={{ maxWidth: "1699px" }}>
          {/* Navigation - Inside container */}
          <div className="relative z-20">
            <Navigation />
          </div>

          {/* Video Background with Mask */}
          <div className="relative" style={{ height: "634px" }}>
            {/* Video with SVG mask */}
            <div className="absolute inset-0">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{
                  maskImage: "url('/images/updated-homepage/video-mask.svg')",
                  WebkitMaskImage:
                    "url('/images/updated-homepage/video-mask.svg')",
                  maskSize: "100% 100%",
                  WebkitMaskSize: "100% 100%",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              >
                <source
                  src="/images/updated-homepage/homepage-video.mov"
                  type="video/mp4"
                />
              </video>
            </div>

            {/* Content Overlay */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
              {/* Headline */}
              <h1
                className="text-white font-whitney uppercase text-center leading-none mb-8"
                style={{
                  fontSize: "64px",
                  letterSpacing: "-0.02em",
                }}
              >
                Find your next
                <br />
                cruise adventure
              </h1>

              {/* Pill-shaped Search Bar */}
              <div
                className="bg-white rounded-full flex items-center overflow-hidden"
                style={{
                  height: "64px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
              >
                {/* Cruise Line Selector */}
                <div className="relative" ref={cruiseLineRef}>
                  <button
                    onClick={() => {
                      setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen);
                      setIsMonthDropdownOpen(false);
                      setIsPassengerDropdownOpen(false);
                    }}
                    className="h-16 px-6 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    style={{
                      minWidth: "200px",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    <span
                      className="font-geograph"
                      style={{
                        fontSize: "16px",
                        color: selectedCruiseLine ? "#1c1c1c" : "#9ca3af",
                        fontWeight: selectedCruiseLine ? "500" : "400",
                      }}
                    >
                      {getCruiseLineText()}
                    </span>
                    <svg
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      fill="none"
                      style={{
                        transform: isCruiseLineDropdownOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <path
                        d="M1 1L6 6L11 1"
                        stroke="#9ca3af"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {isCruiseLineDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg overflow-hidden z-50"
                      style={{ minWidth: "200px" }}
                    >
                      <button
                        onClick={() => {
                          setSelectedCruiseLine("");
                          setIsCruiseLineDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 font-geograph text-sm"
                      >
                        All Cruise Lines
                      </button>
                      {CRUISE_LINE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSelectedCruiseLine(option.value);
                            setIsCruiseLineDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 font-geograph text-sm"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date (Month) Selector */}
                <div className="relative" ref={monthRef}>
                  <button
                    onClick={() => {
                      setIsMonthDropdownOpen(!isMonthDropdownOpen);
                      setIsCruiseLineDropdownOpen(false);
                      setIsPassengerDropdownOpen(false);
                    }}
                    className="h-16 px-6 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    style={{
                      minWidth: "180px",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    <span
                      className="font-geograph"
                      style={{
                        fontSize: "16px",
                        color: selectedMonth ? "#1c1c1c" : "#9ca3af",
                        fontWeight: selectedMonth ? "500" : "400",
                      }}
                    >
                      {getMonthText()}
                    </span>
                    <svg
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      fill="none"
                      style={{
                        transform: isMonthDropdownOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <path
                        d="M1 1L6 6L11 1"
                        stroke="#9ca3af"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {isMonthDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg overflow-hidden z-50"
                      style={{
                        minWidth: "180px",
                        maxHeight: "300px",
                        overflowY: "auto",
                      }}
                    >
                      <button
                        onClick={() => {
                          setSelectedMonth("");
                          setIsMonthDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 font-geograph text-sm"
                      >
                        Any Month
                      </button>
                      {MONTH_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSelectedMonth(option.value);
                            setIsMonthDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 font-geograph text-sm"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Passengers Selector */}
                <div className="relative" ref={passengerRef}>
                  <button
                    onClick={() => {
                      setIsPassengerDropdownOpen(!isPassengerDropdownOpen);
                      setIsCruiseLineDropdownOpen(false);
                      setIsMonthDropdownOpen(false);
                    }}
                    className="h-16 px-6 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    style={{
                      minWidth: "160px",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    <span
                      className="font-geograph"
                      style={{
                        fontSize: "16px",
                        color: "#1c1c1c",
                        fontWeight: "500",
                      }}
                    >
                      {getPassengerText()}
                    </span>
                    <svg
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      fill="none"
                      style={{
                        transform: isPassengerDropdownOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <path
                        d="M1 1L6 6L11 1"
                        stroke="#9ca3af"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {isPassengerDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg p-4 z-50"
                      style={{ minWidth: "280px" }}
                    >
                      {/* Adults */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-geograph text-sm font-medium">
                            Adults
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                if (passengerCount.adults > 1) {
                                  setPassengerCount({
                                    ...passengerCount,
                                    adults: passengerCount.adults - 1,
                                  });
                                }
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              disabled={passengerCount.adults <= 1}
                            >
                              <span className="text-lg">−</span>
                            </button>
                            <span className="font-geograph font-medium w-6 text-center">
                              {passengerCount.adults}
                            </span>
                            <button
                              onClick={() => {
                                if (passengerCount.adults < 8) {
                                  setPassengerCount({
                                    ...passengerCount,
                                    adults: passengerCount.adults + 1,
                                  });
                                }
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              disabled={passengerCount.adults >= 8}
                            >
                              <span className="text-lg">+</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Children */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-geograph text-sm font-medium">
                            Children
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                if (passengerCount.children > 0) {
                                  const newChildAges = [
                                    ...passengerCount.childAges,
                                  ];
                                  newChildAges.pop();
                                  setPassengerCount({
                                    ...passengerCount,
                                    children: passengerCount.children - 1,
                                    childAges: newChildAges,
                                  });
                                }
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              disabled={passengerCount.children <= 0}
                            >
                              <span className="text-lg">−</span>
                            </button>
                            <span className="font-geograph font-medium w-6 text-center">
                              {passengerCount.children}
                            </span>
                            <button
                              onClick={() => {
                                if (passengerCount.children < 6) {
                                  setPassengerCount({
                                    ...passengerCount,
                                    children: passengerCount.children + 1,
                                    childAges: [...passengerCount.childAges, 5],
                                  });
                                }
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              disabled={passengerCount.children >= 6}
                            >
                              <span className="text-lg">+</span>
                            </button>
                          </div>
                        </div>

                        {/* Child Ages */}
                        {passengerCount.children > 0 && (
                          <div className="mt-3 space-y-2">
                            {passengerCount.childAges.map((age, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2"
                              >
                                <span className="font-geograph text-xs text-gray-600 w-16">
                                  Child {index + 1}:
                                </span>
                                <select
                                  value={age}
                                  onChange={(e) => {
                                    const newAges = [
                                      ...passengerCount.childAges,
                                    ];
                                    newAges[index] = parseInt(e.target.value);
                                    setPassengerCount({
                                      ...passengerCount,
                                      childAges: newAges,
                                    });
                                  }}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded font-geograph text-sm"
                                >
                                  {Array.from({ length: 18 }, (_, i) => (
                                    <option key={i} value={i}>
                                      {i} years
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  className="h-16 px-6 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  style={{ minWidth: "64px" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                      stroke="#1c1c1c"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 21L16.65 16.65"
                      stroke="#1c1c1c"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banners Section */}
      <section className="bg-sand py-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Image
              src="/images/updated-homepage/banner-first-time.png"
              alt="First Time Cruiser Benefits"
              width={724}
              height={168}
              className="w-full h-auto rounded-lg"
            />
            <Image
              src="/images/updated-homepage/banner-free-gift.png"
              alt="Free Gift with Every Booking"
              width={724}
              height={168}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* Top Destinations Section */}
      <section className="bg-sand py-20">
        <div className="max-w-7xl mx-auto px-8">
          {/* Headline */}
          <h2
            className="text-center font-whitney uppercase mb-12"
            style={{
              fontSize: "42px",
              color: "#1c1c1c",
              letterSpacing: "-0.02em",
              fontWeight: "900",
            }}
          >
            Top Destinations
          </h2>

          {/* Destination Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {/* Bahamas */}
            <div
              className="relative overflow-hidden rounded-lg"
              style={{ height: "454px" }}
            >
              <Image
                src="/images/updated-homepage/destination-bahamas.png"
                alt="Bahamas"
                width={360}
                height={454}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p
                  className="font-geograph uppercase mb-1"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                  }}
                >
                  Weekend getaways
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "42px",
                    color: "white",
                    fontWeight: "900",
                  }}
                >
                  Bahamas
                </h3>
              </div>
            </div>

            {/* Caribbean */}
            <div
              className="relative overflow-hidden rounded-lg"
              style={{ height: "454px" }}
            >
              <Image
                src="/images/updated-homepage/destination-caribbean.png"
                alt="Caribbean"
                width={360}
                height={454}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p
                  className="font-geograph uppercase mb-1"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                  }}
                >
                  7 night cruises
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "42px",
                    color: "white",
                    fontWeight: "900",
                  }}
                >
                  Caribbean
                </h3>
              </div>
            </div>

            {/* Mexico */}
            <div
              className="relative overflow-hidden rounded-lg"
              style={{ height: "454px" }}
            >
              <Image
                src="/images/updated-homepage/destination-mexico.png"
                alt="Mexico"
                width={360}
                height={454}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p
                  className="font-geograph uppercase mb-1"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                  }}
                >
                  cruises going to
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "42px",
                    color: "white",
                    fontWeight: "900",
                  }}
                >
                  Mexico
                </h3>
              </div>
            </div>

            {/* New York */}
            <div
              className="relative overflow-hidden rounded-lg"
              style={{ height: "454px" }}
            >
              <Image
                src="/images/updated-homepage/destination-newyork.png"
                alt="New York"
                width={360}
                height={454}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p
                  className="font-geograph uppercase mb-1"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                  }}
                >
                  cruises departing
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "42px",
                    color: "white",
                    fontWeight: "900",
                  }}
                >
                  New York
                </h3>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center">
            <button
              onClick={() => router.push("/cruises")}
              className="font-geograph text-white rounded-full"
              style={{
                fontSize: "20px",
                fontWeight: "500",
                letterSpacing: "-0.02em",
                backgroundColor: "#2238C3",
                paddingTop: "20px",
                paddingBottom: "20px",
                paddingLeft: "32px",
                paddingRight: "32px",
              }}
            >
              Browse All Cruises
            </button>
          </div>
        </div>

        {/* Separator */}
        <div
          className="w-full h-[21px] mt-20"
          style={{
            backgroundImage: 'url("/images/separator-3.png")',
            backgroundRepeat: "repeat-x",
            backgroundSize: "1749px 21px",
            backgroundPosition: "left top",
          }}
        />
      </section>

      {/* Testimonials Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-8">
          {/* Headline */}
          <h2
            className="text-center font-whitney uppercase mb-12"
            style={{
              fontSize: "42px",
              color: "#1c1c1c",
              letterSpacing: "-0.02em",
              fontWeight: "900",
            }}
          >
            Smarter cruisers = happy cruisers
          </h2>

          {/* Review Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Review 1 */}
            <div
              className="bg-white border border-gray-200 rounded-lg p-7 flex flex-col"
              style={{ minHeight: "280px" }}
            >
              {/* Stars */}
              <div className="mb-4">
                <Image
                  src="/images/updated-homepage/trustpilot-stars.svg"
                  alt="5 stars"
                  width={120}
                  height={24}
                />
              </div>

              {/* Title */}
              <h3
                className="font-geograph font-bold text-lg mb-3"
                style={{ color: "#1c1c1c" }}
              >
                Every Number Matched
              </h3>

              {/* Body */}
              <p
                className="font-geograph text-base mb-4 flex-grow"
                style={{ color: "#2f2f2f", lineHeight: "1.5" }}
              >
                The base fare, taxes, and onboard credit lined up perfectly. No
                fine print, no surprises. That's why I trusted them.
              </p>

              {/* Author */}
              <p
                className="font-geograph text-sm font-medium mt-auto"
                style={{ color: "#6b7280" }}
              >
                James lee
              </p>
            </div>

            {/* Review 2 */}
            <div
              className="bg-white border border-gray-200 rounded-lg p-7 flex flex-col"
              style={{ minHeight: "280px" }}
            >
              {/* Stars */}
              <div className="mb-4">
                <Image
                  src="/images/updated-homepage/trustpilot-stars.svg"
                  alt="5 stars"
                  width={120}
                  height={24}
                />
              </div>

              {/* Title */}
              <h3
                className="font-geograph font-bold text-lg mb-3"
                style={{ color: "#1c1c1c" }}
              >
                Switching From Costco Paid Off
              </h3>

              {/* Body */}
              <p
                className="font-geograph text-base mb-4 flex-grow"
                style={{ color: "#2f2f2f", lineHeight: "1.5" }}
              >
                We almost booked with Costco for Royal Caribbean. They offered a
                small rebate card, but Zipsea added $400 in OBC...
              </p>

              {/* Author */}
              <p
                className="font-geograph text-sm font-medium mt-auto"
                style={{ color: "#6b7280" }}
              >
                Drew
              </p>
            </div>

            {/* Review 3 */}
            <div
              className="bg-white border border-gray-200 rounded-lg p-7 flex flex-col"
              style={{ minHeight: "280px" }}
            >
              {/* Stars */}
              <div className="mb-4">
                <Image
                  src="/images/updated-homepage/trustpilot-stars.svg"
                  alt="5 stars"
                  width={120}
                  height={24}
                />
              </div>

              {/* Title */}
              <h3
                className="font-geograph font-bold text-lg mb-3"
                style={{ color: "#1c1c1c" }}
              >
                Incredible perks with Zipsea!
              </h3>

              {/* Body */}
              <p
                className="font-geograph text-base mb-4 flex-grow"
                style={{ color: "#2f2f2f", lineHeight: "1.5" }}
              >
                ..My party and I can actually utilize the credit for our
                excursions. What a seamless experience.
              </p>

              {/* Author */}
              <p
                className="font-geograph text-sm font-medium mt-auto"
                style={{ color: "#6b7280" }}
              >
                Jamie
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Keep existing footer component if you have one */}
    </>
  );
}

// Main component wrapped with Suspense
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeWithParams />
    </Suspense>
  );
}
