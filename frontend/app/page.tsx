"use client";

import Image from "next/image";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { trackEngagement } from "../lib/analytics";
import {
  fetchShips,
  Ship,
  fetchLastMinuteDeals,
  LastMinuteDeals,
} from "../lib/api";
import { useAlert } from "../components/GlobalAlertProvider";
import LoginSignupModal from "../app/components/LoginSignupModal";
import { useBooking } from "../app/context/BookingContext";

interface FilterOption {
  id: number;
  name: string;
  count?: number;
}

// Separate component to handle URL params
function HomeWithParams() {
  const router = useRouter();
  const pathname = usePathname();
  const { showAlert } = useAlert();
  const { passengerCount, setPassengerCount } = useBooking();

  // Local guest selector states (synced with context)
  const [adults, setAdults] = useState(passengerCount.adults);
  const [children, setChildren] = useState(passengerCount.children);

  // Search states (cruise lines, dates, guests)
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCruiseLines, setSelectedCruiseLines] = useState<number[]>([]);

  // Login modal state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Dropdown open states
  const [isGuestsDropdownOpen, setIsGuestsDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] =
    useState(false);

  // Filter options from API
  const [cruiseLines, setCruiseLines] = useState<FilterOption[]>([]);

  // Refs for dropdown click outside detection
  const guestsDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const cruiseLineDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch filter options from API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/filter-options`,
        );
        if (response.ok) {
          const data = await response.json();
          setCruiseLines(data.cruiseLines || []);
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };

    fetchFilterOptions();
  }, []);

  // Sync local guest state with context
  useEffect(() => {
    setAdults(passengerCount.adults);
    setChildren(passengerCount.children);
  }, [passengerCount]);

  // Update context when local guest state changes
  useEffect(() => {
    setPassengerCount({
      adults,
      children,
      childAges: Array(children).fill(0),
    });
  }, [adults, children, setPassengerCount]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't close if clicking inside any dropdown
      if (
        guestsDropdownRef.current?.contains(target) ||
        dateDropdownRef.current?.contains(target) ||
        cruiseLineDropdownRef.current?.contains(target)
      ) {
        return;
      }

      // Close all dropdowns if clicking outside
      setIsGuestsDropdownOpen(false);
      setIsDateDropdownOpen(false);
      setIsCruiseLineDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle search - navigate to /cruises with filters including passenger counts
  const handleSearchCruises = () => {
    const params = new URLSearchParams();

    // Add passenger counts
    params.set("adults", adults.toString());
    if (children > 0) {
      params.set("children", children.toString());
    }

    if (selectedMonths.length > 0) {
      params.set("months", selectedMonths.join(","));
    }
    if (selectedCruiseLines.length > 0) {
      params.set("cruiseLines", selectedCruiseLines.join(","));
    }

    const url = params.toString()
      ? `/cruises?${params.toString()}`
      : "/cruises";
    router.push(url);
  };

  // Handle destination clicks
  const handleDestinationClick = (destination: string) => {
    const params = new URLSearchParams();

    // Always include passenger counts
    params.set("adults", adults.toString());
    if (children > 0) {
      params.set("children", children.toString());
    }

    switch (destination) {
      case "bahamas":
        params.set("regions", "28");
        params.set("minNights", "2");
        params.set("maxNights", "5");
        break;
      case "caribbean":
        params.set("regions", "2");
        params.set("minNights", "7");
        params.set("maxNights", "7");
        break;
      case "mexico":
        params.set("regions", "26");
        break;
      case "newyork":
        params.set("departurePorts", "362,5170,5171");
        break;
    }

    router.push(`/cruises?${params.toString()}`);
  };

  // Placeholder helpers
  const getGuestsPlaceholder = () => {
    const total = adults + children;
    if (total === 1) return "1 Guest";
    return `${total} Guests`;
  };

  const getDatePlaceholder = () => {
    if (selectedMonths.length === 0) return "All dates";
    if (selectedMonths.length === 1) {
      const [year, month] = selectedMonths[0].split("-");
      const monthName = new Date(
        parseInt(year),
        parseInt(month) - 1,
      ).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return monthName;
    }
    return `${selectedMonths.length} selected`;
  };

  const getCruiseLinePlaceholder = () => {
    if (selectedCruiseLines.length === 0) return "All cruise lines";
    if (selectedCruiseLines.length === 1) {
      const line = cruiseLines.find((cl) => cl.id === selectedCruiseLines[0]);
      return line?.name || "1 selected";
    }
    return `${selectedCruiseLines.length} selected`;
  };

  return (
    <>
      {/* Hero Section with Video Mask - REMOVED py padding and overflow-hidden */}
      <section className="relative bg-sand md:mt-3 md:px-3">
        <div className="relative mx-auto" style={{ maxWidth: "1880px" }}>
          {/* Video Background with Mask - Fixed Height Container with object-fit */}
          <div className="relative w-full" style={{ height: "700px" }}>
            {/* Video with SVG mask - FIXED: prevent shrinking */}
            <div className="absolute inset-0 w-full h-full">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: "cover",
                  maskImage: "url('/images/updated-homepage/video-mask.svg')",
                  WebkitMaskImage:
                    "url('/images/updated-homepage/video-mask.svg')",
                  maskSize: "cover",
                  WebkitMaskSize: "cover",
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

            {/* Radial Gradient Overlay - Increased opacity from 0.5 to 0.7 */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)",
                maskImage: "url('/images/updated-homepage/video-mask.svg')",
                WebkitMaskImage:
                  "url('/images/updated-homepage/video-mask.svg')",
                maskSize: "cover",
                WebkitMaskSize: "cover",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            />

            {/* Navigation + Content INSIDE the masked area */}
            <div className="absolute inset-0 z-10 flex flex-col p-4 md:p-12">
              {/* Navigation - Inside mask */}
              <div className="flex items-center justify-between mb-auto">
                <a href="/" className="flex items-center">
                  <Image
                    src="/images/zipsea-logo.svg"
                    alt="Zipsea"
                    width={120}
                    height={40}
                    className="h-6 md:h-8 w-auto"
                  />
                </a>

                <nav className="flex items-center gap-3 md:gap-6">
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="font-geograph text-sm md:text-base font-medium text-white hover:text-white/80 transition-colors"
                  >
                    Sign in
                  </button>
                  <a
                    href="/cruises"
                    className="font-geograph text-sm md:text-base font-medium text-white px-4 md:px-6 py-2 md:py-3 rounded-full transition-colors"
                    style={{ backgroundColor: "#2238C3" }}
                  >
                    Browse Cruises
                  </a>
                </nav>
              </div>

              {/* Centered Content */}
              <div
                className="flex flex-col items-center justify-center flex-1"
                style={{ marginTop: "-50px" }}
              >
                {/* Headline with drop shadow */}
                <h1
                  className="text-white font-whitney uppercase text-center leading-none mb-6 md:mb-8"
                  style={{
                    fontSize: "clamp(36px, 5vw, 64px)",
                    letterSpacing: "-0.02em",
                    textShadow: "0px 1px 4px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  Find your next
                  <br />
                  cruise adventure
                </h1>

                {/* DESKTOP: Combined Search Bar - Single Pill */}
                <div
                  className="w-full hidden md:block"
                  style={{ maxWidth: "900px" }}
                >
                  <div
                    className="bg-white rounded-full flex items-center"
                    style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                  >
                    {/* Cruise Line Dropdown */}
                    <div
                      className="relative flex-1 border-r border-gray-200"
                      ref={cruiseLineDropdownRef}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)
                        }
                        className="w-full h-[74px] flex items-center px-6 bg-white hover:bg-gray-50 transition-colors rounded-l-full"
                      >
                        <Image
                          src="/images/ship.svg"
                          alt=""
                          width={20}
                          height={20}
                          className="mr-3"
                        />
                        <span className="flex-1 text-left text-[18px] font-geograph text-dark-blue tracking-tight">
                          {getCruiseLinePlaceholder()}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          className={`transform transition-transform ${isCruiseLineDropdownOpen ? "rotate-180" : ""}`}
                        >
                          <path
                            d="M2 4L6 8L10 4"
                            stroke="#0E1B4D"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {isCruiseLineDropdownOpen && (
                        <div className="absolute top-full mt-2 left-0 w-72 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-[9999]">
                          {cruiseLines.map((line) => (
                            <div
                              key={line.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedCruiseLines((prev) =>
                                  prev.includes(line.id)
                                    ? prev.filter((id) => id !== line.id)
                                    : [...prev, line.id],
                                );
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <div
                                className={`w-4 h-4 border rounded ${selectedCruiseLines.includes(line.id) ? "bg-[#0E1B4D] border-[#0E1B4D]" : "border-gray-300"}`}
                              >
                                {selectedCruiseLines.includes(line.id) && (
                                  <svg
                                    className="w-full h-full text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <div className="font-geograph text-[16px] text-dark-blue">
                                {line.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dates Dropdown */}
                    <div
                      className="relative flex-1 border-r border-gray-200"
                      ref={dateDropdownRef}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setIsDateDropdownOpen(!isDateDropdownOpen)
                        }
                        className="w-full h-[74px] flex items-center px-6 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Image
                          src="/images/calendar.svg"
                          alt=""
                          width={20}
                          height={20}
                          className="mr-3"
                        />
                        <span className="flex-1 text-left text-[18px] font-geograph text-dark-blue tracking-tight">
                          {getDatePlaceholder()}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          className={`transform transition-transform ${isDateDropdownOpen ? "rotate-180" : ""}`}
                        >
                          <path
                            d="M2 4L6 8L10 4"
                            stroke="#0E1B4D"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {isDateDropdownOpen && (
                        <div className="absolute top-full mt-2 left-0 w-[450px] bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] p-4 max-h-[550px] overflow-y-auto">
                          {[2025, 2026, 2027].map((year) => {
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth();

                            return (
                              <div key={year} className="mb-4">
                                <div className="font-geograph font-bold text-[14px] text-gray-700 mb-2">
                                  {year}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {[
                                    "Jan",
                                    "Feb",
                                    "Mar",
                                    "Apr",
                                    "May",
                                    "Jun",
                                    "Jul",
                                    "Aug",
                                    "Sep",
                                    "Oct",
                                    "Nov",
                                    "Dec",
                                  ].map((month, index) => {
                                    const monthStr = `${year}-${String(index + 1).padStart(2, "0")}`;
                                    const isSelected =
                                      selectedMonths.includes(monthStr);
                                    const isPast =
                                      year < currentYear ||
                                      (year === currentYear &&
                                        index < currentMonth);

                                    if (isPast) return null;

                                    return (
                                      <button
                                        key={monthStr}
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedMonths((prev) =>
                                            prev.includes(monthStr)
                                              ? prev.filter(
                                                  (m) => m !== monthStr,
                                                )
                                              : [...prev, monthStr],
                                          );
                                        }}
                                        className={`px-3 py-2 rounded-full text-[14px] font-geograph transition-colors ${
                                          isSelected
                                            ? "bg-[#0E1B4D] text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                      >
                                        {month}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Guests Dropdown - FIXED: people-icon.svg */}
                    <div className="relative flex-1" ref={guestsDropdownRef}>
                      <button
                        type="button"
                        onClick={() =>
                          setIsGuestsDropdownOpen(!isGuestsDropdownOpen)
                        }
                        className="w-full h-[74px] flex items-center px-6 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Image
                          src="/images/people-icon.svg"
                          alt=""
                          width={20}
                          height={20}
                          className="mr-3"
                        />
                        <span className="flex-1 text-left text-[18px] font-geograph text-dark-blue tracking-tight">
                          {getGuestsPlaceholder()}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          className={`transform transition-transform ${isGuestsDropdownOpen ? "rotate-180" : ""}`}
                        >
                          <path
                            d="M2 4L6 8L10 4"
                            stroke="#0E1B4D"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {isGuestsDropdownOpen && (
                        <div className="absolute top-full mt-2 right-0 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] p-4">
                          <div className="flex items-center justify-between mb-4">
                            <span className="font-geograph text-[16px] text-dark-blue">
                              Adults
                            </span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAdults(Math.max(1, adults - 1));
                                }}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                −
                              </button>
                              <span className="font-geograph text-[18px] text-dark-blue w-8 text-center">
                                {adults}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const total = adults + 1 + children;
                                  if (total <= 4) {
                                    setAdults(adults + 1);
                                  }
                                }}
                                disabled={adults + children >= 4}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-geograph text-[16px] text-dark-blue">
                              Children
                            </span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChildren(Math.max(0, children - 1));
                                }}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                −
                              </button>
                              <span className="font-geograph text-[18px] text-dark-blue w-8 text-center">
                                {children}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const total = adults + children + 1;
                                  if (total <= 4) {
                                    setChildren(children + 1);
                                  }
                                }}
                                disabled={adults + children >= 4}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          {adults + children >= 4 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Maximum 4 guests total
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Search Button - Circle with WHITE icon */}
                    <button
                      type="button"
                      onClick={handleSearchCruises}
                      className="h-[74px] w-[74px] flex items-center justify-center rounded-full transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "#2238C3" }}
                    >
                      <Image
                        src="/images/search.svg"
                        alt="Search"
                        width={24}
                        height={24}
                        style={{ filter: "brightness(0) invert(1)" }}
                      />
                    </button>
                  </div>
                </div>

                {/* MOBILE: Stacked Search Fields */}
                <div
                  className="w-full md:hidden flex flex-col gap-3"
                  style={{ maxWidth: "400px" }}
                >
                  {/* Cruise Line - Mobile */}
                  <div className="relative" ref={cruiseLineDropdownRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)
                      }
                      className="w-full h-[60px] bg-white rounded-full flex items-center px-6 hover:bg-gray-50 transition-colors"
                    >
                      <Image
                        src="/images/ship.svg"
                        alt=""
                        width={18}
                        height={18}
                        className="mr-3"
                      />
                      <span className="flex-1 text-left text-[16px] font-geograph text-dark-blue tracking-tight">
                        {getCruiseLinePlaceholder()}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className={`transform transition-transform ${isCruiseLineDropdownOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M2 4L6 8L10 4"
                          stroke="#0E1B4D"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {isCruiseLineDropdownOpen && (
                      <div className="absolute top-full mt-2 left-0 right-0 max-h-72 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-[9999]">
                        {cruiseLines.map((line) => (
                          <div
                            key={line.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedCruiseLines((prev) =>
                                prev.includes(line.id)
                                  ? prev.filter((id) => id !== line.id)
                                  : [...prev, line.id],
                              );
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <div
                              className={`w-4 h-4 border rounded ${selectedCruiseLines.includes(line.id) ? "bg-[#0E1B4D] border-[#0E1B4D]" : "border-gray-300"}`}
                            >
                              {selectedCruiseLines.includes(line.id) && (
                                <svg
                                  className="w-full h-full text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="font-geograph text-[16px] text-dark-blue">
                              {line.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dates - Mobile */}
                  <div className="relative" ref={dateDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                      className="w-full h-[60px] bg-white rounded-full flex items-center px-6 hover:bg-gray-50 transition-colors"
                    >
                      <Image
                        src="/images/calendar.svg"
                        alt=""
                        width={18}
                        height={18}
                        className="mr-3"
                      />
                      <span className="flex-1 text-left text-[16px] font-geograph text-dark-blue tracking-tight">
                        {getDatePlaceholder()}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className={`transform transition-transform ${isDateDropdownOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M2 4L6 8L10 4"
                          stroke="#0E1B4D"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {isDateDropdownOpen && (
                      <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] p-4 max-h-96 overflow-y-auto">
                        {[2025, 2026, 2027].map((year) => {
                          const currentDate = new Date();
                          const currentYear = currentDate.getFullYear();
                          const currentMonth = currentDate.getMonth();

                          return (
                            <div key={year} className="mb-4">
                              <div className="font-geograph font-bold text-[14px] text-gray-700 mb-2">
                                {year}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  "Jan",
                                  "Feb",
                                  "Mar",
                                  "Apr",
                                  "May",
                                  "Jun",
                                  "Jul",
                                  "Aug",
                                  "Sep",
                                  "Oct",
                                  "Nov",
                                  "Dec",
                                ].map((month, index) => {
                                  const monthStr = `${year}-${String(index + 1).padStart(2, "0")}`;
                                  const isSelected =
                                    selectedMonths.includes(monthStr);
                                  const isPast =
                                    year < currentYear ||
                                    (year === currentYear &&
                                      index < currentMonth);

                                  if (isPast) return null;

                                  return (
                                    <button
                                      key={monthStr}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedMonths((prev) =>
                                          prev.includes(monthStr)
                                            ? prev.filter((m) => m !== monthStr)
                                            : [...prev, monthStr],
                                        );
                                      }}
                                      className={`px-2 py-2 rounded-full text-[12px] font-geograph transition-colors ${
                                        isSelected
                                          ? "bg-[#0E1B4D] text-white"
                                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                      }`}
                                    >
                                      {month}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Guests - Mobile */}
                  <div className="relative" ref={guestsDropdownRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setIsGuestsDropdownOpen(!isGuestsDropdownOpen)
                      }
                      className="w-full h-[60px] bg-white rounded-full flex items-center px-6 hover:bg-gray-50 transition-colors"
                    >
                      <Image
                        src="/images/people-icon.svg"
                        alt=""
                        width={18}
                        height={18}
                        className="mr-3"
                      />
                      <span className="flex-1 text-left text-[16px] font-geograph text-dark-blue tracking-tight">
                        {getGuestsPlaceholder()}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className={`transform transition-transform ${isGuestsDropdownOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M2 4L6 8L10 4"
                          stroke="#0E1B4D"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {isGuestsDropdownOpen && (
                      <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] p-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-geograph text-[16px] text-dark-blue">
                            Adults
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAdults(Math.max(1, adults - 1));
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              −
                            </button>
                            <span className="font-geograph text-[18px] text-dark-blue w-8 text-center">
                              {adults}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const total = adults + 1 + children;
                                if (total <= 4) {
                                  setAdults(adults + 1);
                                }
                              }}
                              disabled={adults + children >= 4}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-geograph text-[16px] text-dark-blue">
                            Children
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChildren(Math.max(0, children - 1));
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              −
                            </button>
                            <span className="font-geograph text-[18px] text-dark-blue w-8 text-center">
                              {children}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const total = adults + children + 1;
                                if (total <= 4) {
                                  setChildren(children + 1);
                                }
                              }}
                              disabled={adults + children >= 4}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {adults + children >= 4 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Maximum 4 guests total
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Search Button - Mobile */}
                  <button
                    type="button"
                    onClick={handleSearchCruises}
                    className="w-full h-[60px] rounded-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: "#2238C3",
                    }}
                  >
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={20}
                      height={20}
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                    <span className="text-white text-[16px] font-geograph font-medium">
                      Search cruises
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banners Section - Stack at larger breakpoint */}
      <section className="bg-sand py-8 md:py-12">
        <div className="mx-auto px-4 md:px-8" style={{ maxWidth: "1464px" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <a
              href="https://www.zipsea.com/first-time-cruisers-guide"
              className="block"
            >
              <Image
                src="/images/updated-homepage/banner-first-time.png"
                alt="First Time Cruiser Benefits"
                width={724}
                height={168}
                className="w-full h-auto rounded-lg hover:opacity-95 transition-opacity"
              />
            </a>
            <a href="/cruises" className="block">
              <Image
                src="/images/updated-homepage/banner-free-gift.png"
                alt="Free Gift with Every Booking"
                width={724}
                height={168}
                className="w-full h-auto rounded-lg hover:opacity-95 transition-opacity"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Top Destinations Section - Removed gradients, adjusted heights, line-height */}
      <section className="bg-sand pt-12 md:pt-20">
        <div className="mx-auto px-4 md:px-8" style={{ maxWidth: "1464px" }}>
          <h2
            className="text-center font-whitney uppercase mb-8 md:mb-12"
            style={{
              fontSize: "clamp(32px, 4vw, 42px)",
              color: "#1c1c1c",
              letterSpacing: "-0.02em",
              fontWeight: "900",
            }}
          >
            Top Destinations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
            {/* Bahamas - Reduced height on tablet/mobile, removed gradient */}
            <button
              onClick={() => handleDestinationClick("bahamas")}
              className="relative overflow-hidden rounded-lg cursor-pointer transition-transform hover:scale-[1.025] h-auto"
            >
              <Image
                src="/images/updated-homepage/destination-bahamas.png"
                alt="Bahamas"
                width={360}
                height={454}
                className="w-full h-full object-cover h-[38px] md:h-[152px] lg:h-[454px]"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6">
                <p
                  className="font-geograph uppercase"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                    marginBottom: "10px",
                  }}
                >
                  Weekend getaways
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "clamp(42px, 4vw, 46px)",
                    color: "white",
                    fontWeight: "900",
                    lineHeight: "1",
                  }}
                >
                  Bahamas
                </h3>
              </div>
            </button>

            {/* Caribbean */}
            <button
              onClick={() => handleDestinationClick("caribbean")}
              className="relative overflow-hidden rounded-lg cursor-pointer transition-transform hover:scale-[1.025] h-auto"
            >
              <Image
                src="/images/updated-homepage/destination-caribbean.png"
                alt="Caribbean"
                width={360}
                height={454}
                className="w-full h-full object-cover h-[38px] md:h-[152px] lg:h-[454px]"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6">
                <p
                  className="font-geograph uppercase"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                    marginBottom: "10px",
                  }}
                >
                  7 night cruises
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "clamp(42px, 4vw, 46px)",
                    color: "white",
                    fontWeight: "900",
                    lineHeight: "1",
                  }}
                >
                  Caribbean
                </h3>
              </div>
            </button>

            {/* Mexico */}
            <button
              onClick={() => handleDestinationClick("mexico")}
              className="relative overflow-hidden rounded-lg cursor-pointer transition-transform hover:scale-[1.025] h-auto"
            >
              <Image
                src="/images/updated-homepage/destination-mexico.png"
                alt="Mexico"
                width={360}
                height={454}
                className="w-full h-full object-cover h-[38px] md:h-[152px] lg:h-[454px]"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6">
                <p
                  className="font-geograph uppercase"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                    marginBottom: "10px",
                  }}
                >
                  cruises going to
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "clamp(42px, 4vw, 46px)",
                    color: "white",
                    fontWeight: "900",
                    lineHeight: "1",
                  }}
                >
                  Mexico
                </h3>
              </div>
            </button>

            {/* New York */}
            <button
              onClick={() => handleDestinationClick("newyork")}
              className="relative overflow-hidden rounded-lg cursor-pointer transition-transform hover:scale-[1.025] h-auto"
            >
              <Image
                src="/images/updated-homepage/destination-newyork.png"
                alt="New York"
                width={360}
                height={454}
                className="w-full h-full object-cover h-[38px] md:h-[152px] lg:h-[454px]"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6">
                <p
                  className="font-geograph uppercase"
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "white",
                    letterSpacing: "0.1em",
                    marginBottom: "10px",
                  }}
                >
                  cruises departing
                </p>
                <h3
                  className="font-whitney uppercase"
                  style={{
                    fontSize: "clamp(42px, 4vw, 46px)",
                    color: "white",
                    fontWeight: "900",
                    lineHeight: "1",
                  }}
                >
                  New York
                </h3>
              </div>
            </button>
          </div>

          <div className="flex justify-center pb-8 md:pb-12">
            <button
              onClick={() => router.push("/cruises")}
              className="font-geograph text-white rounded-full hover:opacity-90 transition-opacity"
              style={{
                fontSize: "clamp(16px, 2vw, 20px)",
                fontWeight: "500",
                letterSpacing: "-0.02em",
                backgroundColor: "#2238C3",
                paddingTop: "16px",
                paddingBottom: "16px",
                paddingLeft: "28px",
                paddingRight: "28px",
              }}
            >
              Browse All Cruises
            </button>
          </div>
        </div>

        <div
          className="w-full h-[21px]"
          style={{
            backgroundImage: 'url("/images/separator-3.png")',
            backgroundRepeat: "repeat-x",
            backgroundSize: "1749px 21px",
            backgroundPosition: "left top",
          }}
        />
      </section>

      {/* Testimonials Section - Removed min-height on mobile/tablet, line-height 1 on headline */}
      <section className="bg-white py-3 md:py-5 mt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <h2
            className="text-center font-whitney uppercase mb-6 md:mb-8"
            style={{
              fontSize: "clamp(32px, 4vw, 42px)",
              color: "#1c1c1c",
              letterSpacing: "-0.02em",
              fontWeight: "900",
              lineHeight: "1",
            }}
          >
            Smarter cruisers = happy cruisers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Review 1 */}
            <a
              href="https://www.trustpilot.com/reviews/68ccd495ecd5535685d2dd7f"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-lg p-6 md:p-7 flex flex-col transition-shadow md:min-h-0"
              style={{ boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(0,0,0,0)";
              }}
            >
              <div className="mb-4">
                <Image
                  src="/images/updated-homepage/trustpilot-stars.svg"
                  alt="5 stars"
                  width={120}
                  height={24}
                />
              </div>
              <h3
                className="font-geograph font-bold text-base md:text-lg mb-3"
                style={{ color: "#1c1c1c" }}
              >
                Every Number Matched
              </h3>
              <p
                className="font-geograph text-sm md:text-base mb-4 flex-grow"
                style={{ color: "#2f2f2f", lineHeight: "1.5" }}
              >
                The base fare, taxes, and onboard credit lined up perfectly. No
                fine print, no surprises. That's why I trusted them.
              </p>
              <p
                className="font-geograph text-xs md:text-sm font-medium mt-auto"
                style={{ color: "#6b7280" }}
              >
                James lee
              </p>
            </a>

            {/* Review 2 */}
            <a
              href="https://www.trustpilot.com/users/68cccfc38a838cf268714fe1"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-lg p-6 md:p-7 flex flex-col transition-shadow md:min-h-0"
              style={{ boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(0,0,0,0)";
              }}
            >
              <div className="mb-4">
                <Image
                  src="/images/updated-homepage/trustpilot-stars.svg"
                  alt="5 stars"
                  width={120}
                  height={24}
                />
              </div>
              <h3
                className="font-geograph font-bold text-base md:text-lg mb-3"
                style={{ color: "#1c1c1c" }}
              >
                Switching From Costco Paid Off
              </h3>
              <p
                className="font-geograph text-sm md:text-base mb-4 flex-grow"
                style={{ color: "#2f2f2f", lineHeight: "1.5" }}
              >
                We almost booked with Costco for Royal Caribbean. They offered a
                small rebate card, but Zipsea added $400 in OBC...
              </p>
              <p
                className="font-geograph text-xs md:text-sm font-medium mt-auto"
                style={{ color: "#6b7280" }}
              >
                Drew
              </p>
            </a>

            {/* Review 3 */}
            <a
              href="https://www.trustpilot.com/users/68cc73c37b741cb43a9a8473"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-lg p-6 md:p-7 flex flex-col transition-shadow md:min-h-0"
              style={{ boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 0 rgba(0,0,0,0)";
              }}
            >
              <div className="mb-4">
                <Image
                  src="/images/updated-homepage/trustpilot-stars.svg"
                  alt="5 stars"
                  width={120}
                  height={24}
                />
              </div>
              <h3
                className="font-geograph font-bold text-base md:text-lg mb-3"
                style={{ color: "#1c1c1c" }}
              >
                Incredible perks with Zipsea!
              </h3>
              <p
                className="font-geograph text-sm md:text-base mb-4 flex-grow"
                style={{ color: "#2f2f2f", lineHeight: "1.5" }}
              >
                ..My party and I can actually utilize the credit for our
                excursions. What a seamless experience.
              </p>
              <p
                className="font-geograph text-xs md:text-sm font-medium mt-auto"
                style={{ color: "#6b7280" }}
              >
                Jamie
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      <LoginSignupModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeWithParams />
    </Suspense>
  );
}
