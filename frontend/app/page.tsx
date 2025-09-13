"use client";
import Image from "next/image";
import OptimizedImage from "../lib/OptimizedImage";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchShips,
  Ship,
  searchCruises,
  Cruise,
  fetchLastMinuteDeals,
  LastMinuteDeals,
  fetchAvailableSailingDates,
  AvailableSailingDate,
  normalizeCruiseData,
} from "../lib/api";
import { createSlugFromCruise } from "../lib/slug";
import { useAlert } from "../components/GlobalAlertProvider";
import Navigation from "./components/Navigation";
import SearchResultsModal from "./components/SearchResultsModal";
import { trackSearch, trackEngagement } from "../lib/analytics";

interface FilterOption {
  id: number;
  name: string;
  count?: number;
}

// Separate component to handle URL params (needs to be wrapped in Suspense)
function HomeWithParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();

  // New search states for the three dropdowns
  const [selectedRegions, setSelectedRegions] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCruiseLines, setSelectedCruiseLines] = useState<number[]>([]);

  // Dropdown open states
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] =
    useState(false);

  // Filter options from API
  const [regions, setRegions] = useState<FilterOption[]>([]);
  const [cruiseLines, setCruiseLines] = useState<FilterOption[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);

  // Refs for dropdown click outside detection
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const cruiseLineDropdownRef = useRef<HTMLDivElement>(null);

  // Last minute deals states
  const [lastMinuteDeals, setLastMinuteDeals] = useState<LastMinuteDeals[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);

  // Handle post-authentication redirects
  useEffect(() => {
    if (typeof window !== "undefined") {
      const redirectUrl = sessionStorage.getItem("redirectAfterSignIn");
      const hasPendingQuote = sessionStorage.getItem("pendingQuote");

      if (
        redirectUrl &&
        redirectUrl !== "/" &&
        redirectUrl !== window.location.pathname
      ) {
        // Clear the redirect URL and navigate to the stored path
        sessionStorage.removeItem("redirectAfterSignIn");

        // Add a small delay to ensure the redirect works properly
        setTimeout(() => {
          router.replace(redirectUrl);
        }, 100);
        return;
      }

      // If we're on the homepage but have a pending quote, it means we came back from auth
      // but the redirect URL was the homepage, so we should stay here
      if (hasPendingQuote && window.location.pathname === "/") {
        console.log("User returned to homepage after auth with pending quote");
        // The quote processing will be handled by the QuoteModalNative component
        // if they open a quote modal again
      }
    }
  }, [router]);

  // Fetch filter options from API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setIsLoadingFilters(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/filter-options`,
        );
        if (response.ok) {
          const data = await response.json();
          setRegions(data.regions || []);
          setCruiseLines(data.cruiseLines || []);
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
        setRegions([]);
        setCruiseLines([]);
      } finally {
        setIsLoadingFilters(false);
      }
    };

    fetchFilterOptions();
  }, []);

  // Load last minute deals on component mount
  useEffect(() => {
    const loadLastMinuteDeals = async () => {
      try {
        setIsLoadingDeals(true);
        const deals = await fetchLastMinuteDeals();
        setLastMinuteDeals(deals);
      } catch (err) {
        console.error("Failed to load last minute deals:", err);
        showAlert("Failed to load last minute deals. Please try again later.");
        setLastMinuteDeals([]);
      } finally {
        setIsLoadingDeals(false);
      }
    };

    loadLastMinuteDeals();
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRegionDropdownOpen(false);
      }
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDateDropdownOpen(false);
      }
      if (
        cruiseLineDropdownRef.current &&
        !cruiseLineDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCruiseLineDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle cruise card clicks for last minute deals
  const handleCruiseClick = (cruise: Cruise) => {
    try {
      // Generate slug for the cruise
      const slug = createSlugFromCruise({
        id: cruise.id,
        shipName: cruise.shipName || cruise.ship_name || "unknown-ship",
        sailingDate:
          cruise.departureDate || cruise.departure_date || cruise.sailing_date,
      });
      router.push(`/cruise/${slug}`);
    } catch (error) {
      console.error("Failed to create slug for cruise:", cruise, error);
      // Fallback to basic navigation with cruise ID
      router.push(`/cruise-details?id=${cruise.id}`);
    }
  };

  // Handle search - navigate to /cruises with filters
  const handleSearchCruises = () => {
    const params = new URLSearchParams();

    // Add regions if selected
    if (selectedRegions.length > 0) {
      params.set("regions", selectedRegions.join(","));
    }

    // Add months if selected
    if (selectedMonths.length > 0) {
      params.set("months", selectedMonths.join(","));
    }

    // Add cruise lines if selected
    if (selectedCruiseLines.length > 0) {
      params.set("cruiseLines", selectedCruiseLines.join(","));
    }

    // Navigate to /cruises with the filters
    const url = params.toString()
      ? `/cruises?${params.toString()}`
      : "/cruises";
    router.push(url);
  };

  // Helper function to get placeholder text
  const getRegionPlaceholder = () => {
    if (selectedRegions.length === 0) return "All destinations";
    if (selectedRegions.length === 1) {
      const region = regions.find((r) => r.id === selectedRegions[0]);
      return region?.name || "1 selected";
    }
    return `${selectedRegions.length} selected`;
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
      {/* Override global navigation with homepage-specific functionality */}
      <Navigation showMinimizedSearch={false} />

      {/* Hero Section */}
      <section className="relative h-[720px] bg-light-blue pt-[120px] md:pt-[100px] pb-[50px] md:pb-[100px] overflow-visible z-20">
        {/* Floating Swimmers - Behind all content - Hidden on mobile */}
        <div className="absolute inset-0 z-0 hidden md:block">
          {/* Swimmer 1 */}
          <div
            className="absolute swimmer-float-1"
            style={{
              top: "15%",
              left: "8%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-1.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{
                width: "140px",
                height: "auto",
              }}
            />
          </div>

          {/* Swimmer 2 */}
          <div
            className="absolute swimmer-float-2"
            style={{
              top: "60%",
              right: "12%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-2.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{
                width: "140px",
                height: "auto",
              }}
            />
          </div>

          {/* Swimmer 3 */}
          <div
            className="absolute swimmer-float-3"
            style={{
              bottom: "20%",
              left: "20%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-3.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{
                width: "140px",
                height: "auto",
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-[calc(720px-100px)] px-4 -mt-[80px]">
          {/* Main Heading - Responsive */}
          <h1 className="text-sunshine text-[48px] md:text-[72px] font-whitney uppercase text-center leading-none tracking-tight mb-6 md:mb-10">
            The most onboard credit
            <br />
            Simple as that
          </h1>

          {/* Subheading - Responsive */}
          <p
            className="text-white text-[18px] md:text-[18px] font-medium font-geograph tracking-tight text-center w-full max-w-[900px] mb-8 md:mb-5"
            style={{ lineHeight: "1.75" }}
          >
            We pass on the most onboard credit - every single booking
          </p>

          {/* Search Input Container - New Three Dropdowns */}
          <div className="w-full max-w-[740px] relative z-30">
            {/* Desktop: Three Dropdowns + Search Button on separate row */}
            <div className="hidden md:block space-y-3">
              {/* Three Dropdowns Row */}
              <div className="flex gap-3 items-center">
                {/* Destinations Dropdown */}
                <div className="relative flex-1" ref={regionDropdownRef}>
                  <button
                    onClick={() =>
                      setIsRegionDropdownOpen(!isRegionDropdownOpen)
                    }
                    className="w-full h-[74px] bg-white rounded-full flex items-center px-6 hover:bg-gray-50 transition-colors"
                    style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                  >
                    <Image
                      src="/images/place-icon.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="mr-3"
                    />
                    <span className="flex-1 text-left text-[20px] font-geograph text-dark-blue tracking-tight">
                      {getRegionPlaceholder()}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className={`transform transition-transform ${isRegionDropdownOpen ? "rotate-180" : ""}`}
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

                  {isRegionDropdownOpen && (
                    <div
                      className="absolute top-full mt-2 w-64 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {regions.map((region) => (
                        <div
                          key={region.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedRegions((prev) =>
                              prev.includes(region.id)
                                ? prev.filter((id) => id !== region.id)
                                : [...prev, region.id],
                            );
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <div
                            className={`w-4 h-4 border rounded ${
                              selectedRegions.includes(region.id)
                                ? "bg-[#0E1B4D] border-[#0E1B4D]"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedRegions.includes(region.id) && (
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
                            {region.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dates Dropdown */}
                <div className="relative flex-1" ref={dateDropdownRef}>
                  <button
                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                    className="w-full h-[74px] bg-white rounded-full flex items-center px-6 hover:bg-gray-50 transition-colors"
                    style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                  >
                    <Image
                      src="/images/calendar.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="mr-3"
                    />
                    <span className="flex-1 text-left text-[20px] font-geograph text-dark-blue tracking-tight">
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
                    <div
                      className="absolute top-full mt-2 w-96 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[2025, 2026, 2027, 2028].map((year) => {
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

                                return (
                                  <button
                                    key={monthStr}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!isPast) {
                                        setSelectedMonths((prev) =>
                                          prev.includes(monthStr)
                                            ? prev.filter((m) => m !== monthStr)
                                            : [...prev, monthStr],
                                        );
                                      }
                                    }}
                                    disabled={isPast}
                                    className={`px-3 py-1 rounded-full text-[14px] font-geograph transition-colors ${
                                      isPast
                                        ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                                        : isSelected
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

                {/* Cruise Lines Dropdown */}
                <div className="relative flex-1" ref={cruiseLineDropdownRef}>
                  <button
                    onClick={() =>
                      setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)
                    }
                    className="w-full h-[74px] bg-white rounded-full flex items-center px-6 hover:bg-gray-50 transition-colors"
                    style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                  >
                    <Image
                      src="/images/ship.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="mr-3"
                    />
                    <span className="flex-1 text-left text-[20px] font-geograph text-dark-blue tracking-tight">
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
                    <div
                      className="absolute top-full mt-2 w-64 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <div
                            className={`w-4 h-4 border rounded ${
                              selectedCruiseLines.includes(line.id)
                                ? "bg-[#0E1B4D] border-[#0E1B4D]"
                                : "border-gray-300"
                            }`}
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
              </div>

              {/* Search Button Row */}
              <div className="flex justify-center">
                <button
                  onClick={handleSearchCruises}
                  className="w-full h-[74px] px-12 bg-dark-blue rounded-full flex items-center justify-center hover:bg-dark-blue/90 transition-colors"
                  style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                >
                  <Image
                    src="/images/search.svg"
                    alt=""
                    width={20}
                    height={20}
                    className="mr-2"
                  />
                  <span className="text-white text-[20px] font-geograph font-medium whitespace-nowrap">
                    Search cruises
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile: 3 Separate Pills + Search Button */}
            <div className="md:hidden space-y-4">
              {/* Destinations Selector Pill */}
              <div className="relative" ref={regionDropdownRef}>
                <button
                  onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
                  className="w-full h-[64px] bg-white rounded-full flex items-center px-6"
                  style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                >
                  <span className="flex-1 text-left text-[18px] font-geograph text-dark-blue tracking-tight">
                    {getRegionPlaceholder()}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`transform transition-transform ${isRegionDropdownOpen ? "rotate-180" : ""}`}
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

                {isRegionDropdownOpen && (
                  <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[300px] overflow-y-auto">
                    {regions.map((region) => (
                      <button
                        key={region.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRegions((prev) =>
                            prev.includes(region.id)
                              ? prev.filter((id) => id !== region.id)
                              : [...prev, region.id],
                          );
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedRegions.includes(region.id)
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedRegions.includes(region.id) && (
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
                        <span className="font-geograph text-[14px] text-dark-blue">
                          {region.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dates Pill */}
              <div className="relative" ref={dateDropdownRef}>
                <button
                  onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                  className="w-full h-[64px] bg-white rounded-full flex items-center px-6"
                  style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                >
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
                  <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3 max-h-[400px] overflow-y-auto">
                    {[2025, 2026].map((year) => {
                      const currentDate = new Date();
                      const currentYear = currentDate.getFullYear();
                      const currentMonth = currentDate.getMonth();

                      return (
                        <div key={year} className="mb-3">
                          <div className="font-geograph font-bold text-[12px] text-gray-700 mb-2">
                            {year}
                          </div>
                          <div className="grid grid-cols-4 gap-1">
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
                                (year === currentYear && index < currentMonth);

                              return (
                                <button
                                  key={monthStr}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPast) {
                                      setSelectedMonths((prev) =>
                                        prev.includes(monthStr)
                                          ? prev.filter((m) => m !== monthStr)
                                          : [...prev, monthStr],
                                      );
                                    }
                                  }}
                                  disabled={isPast}
                                  className={`px-2 py-1 rounded-full text-[12px] font-geograph transition-colors ${
                                    isPast
                                      ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                                      : isSelected
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

              {/* Cruise Lines Pill */}
              <div className="relative" ref={cruiseLineDropdownRef}>
                <button
                  onClick={() =>
                    setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)
                  }
                  className="w-full h-[64px] bg-white rounded-full flex items-center px-6"
                  style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
                >
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
                  <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[300px] overflow-y-auto">
                    {cruiseLines.map((line) => (
                      <button
                        key={line.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCruiseLines((prev) =>
                            prev.includes(line.id)
                              ? prev.filter((id) => id !== line.id)
                              : [...prev, line.id],
                          );
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedCruiseLines.includes(line.id)
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
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
                        <span className="font-geograph text-[14px] text-dark-blue">
                          {line.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Button Pill */}
              <button
                onClick={handleSearchCruises}
                className="h-[64px] w-full bg-dark-blue rounded-full flex items-center justify-center hover:bg-dark-blue/90 active:bg-dark-blue transition-colors"
                style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
              >
                <span className="text-white text-[18px] font-geograph font-medium">
                  Search cruises
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Separator Image */}
      <div
        className="w-full h-[21px] block mt-0"
        style={{
          backgroundImage: 'url("/images/separator-1.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* OBC Section - Mobile Responsive */}
      <section className="bg-dark-blue py-[62px] md:py-[124px] relative">
        <div className="max-w-4xl mx-auto px-8 text-center">
          {/* Headline - Mobile Responsive */}
          <h2 className="text-white text-[42px] md:text-[52px] font-whitney leading-none tracking-tight mb-[50px] md:mb-[100px]">
            WHAT'S ONBOARD CREDIT (OBC)?
          </h2>

          {/* First Body Text - Mobile Responsive */}
          <p className="text-purple-obc text-[18px] md:text-[32px] font-geograph leading-[1.75] md:leading-[1.5] tracking-tight mb-[30px] md:mb-[60px]">
            Think of OBC as cruise cash.
            <br />
            <br />
            When you book, the cruise line gives you money to spend onboard —
            like a gift card just for your vacation.
          </p>

          {/* Image - Mobile Responsive */}
          <div className="mb-[30px] md:mb-[60px]">
            <OptimizedImage
              src="/images/what-you-can-buy.png"
              alt="What you can buy with onboard credit"
              width={1236}
              height={860}
              className="h-auto mx-auto w-full max-w-[618px]"
            />
          </div>

          {/* Second Body Text - Mobile Responsive */}
          <p className="text-purple-obc text-[18px] md:text-[32px] font-geograph leading-[1.75] md:leading-[1.5] tracking-tight mb-8 md:mb-16">
            Most travel agents keep as much of the commission as possible and
            only pass along a little OBC. Cruise lines also set a cap on how
            much agents can give back.
          </p>

          {/* Bottom Line Image - Mobile Responsive */}
          <div
            className="mx-auto relative z-10 w-full"
            style={{ marginBottom: "-150px" }}
          >
            <OptimizedImage
              src="/images/bottom-line.png"
              alt="The bottom line"
              width={1305}
              height={734}
              className="h-auto mx-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* Separator Image 2 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-2.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Last Minute Deals Section - Mobile Responsive */}
      <section className="bg-sand py-[100px] md:py-[100px] relative pt-[100px] md:pt-[200px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Headline with Hourglass Icon - Mobile Responsive */}
          <div className="flex items-center justify-center mb-[80px]">
            <svg
              width="36"
              height="36"
              viewBox="0 0 55 55"
              fill="none"
              className="mr-4 md:mr-6 md:w-12 md:h-12"
              style={{ shapeRendering: "geometricPrecision" }}
            >
              <g clipPath="url(#clip0_573_3612)">
                <path
                  d="M38.4687 49.648L35.7206 48.9646L37.3152 42.5522C37.9504 39.989 37.8041 37.2943 36.8953 34.8148C35.9865 32.3354 34.3567 30.1845 32.2156 28.6388C34.8312 28.2759 37.2785 27.1389 39.2428 25.374C41.2071 23.6091 42.5986 21.297 43.2383 18.7349L44.833 12.3226L47.5812 13.006C48.0671 13.1269 48.5811 13.0497 49.0101 12.7916C49.4391 12.5335 49.748 12.1155 49.8689 11.6296C49.9897 11.1437 49.9126 10.6297 49.6544 10.2006C49.3963 9.77159 48.9783 9.46268 48.4924 9.34184L17.3467 1.59625C16.8608 1.47541 16.3468 1.55254 15.9178 1.81068C15.4888 2.06882 15.1799 2.48682 15.059 2.97272C14.9382 3.45863 15.0153 3.97263 15.2735 4.40166C15.5316 4.83069 15.9496 5.1396 16.4355 5.26044L19.1836 5.94388L17.589 12.3562C16.9541 14.9195 17.1005 17.614 18.0092 20.0935C18.918 22.5729 20.5477 24.7238 22.6886 26.2696C20.0729 26.6323 17.6255 27.7692 15.6611 29.5341C13.6968 31.2991 12.3054 33.6113 11.6659 36.1735L10.0712 42.5858L7.32304 41.9024C6.83713 41.7816 6.32313 41.8587 5.8941 42.1168C5.46507 42.375 5.15615 42.793 5.03532 43.2789C4.91448 43.7648 4.99161 44.2788 5.24975 44.7078C5.50789 45.1368 5.92589 45.4458 6.41179 45.5666L37.5575 53.3122C38.0434 53.433 38.5574 53.3559 38.9864 53.0978C39.4154 52.8396 39.7243 52.4216 39.8452 51.9357C39.966 51.4498 39.8889 50.9358 39.6307 50.5068C39.3726 50.0777 38.9546 49.7688 38.4687 49.648ZM22.7864 16.4112C23.0148 16.1494 23.311 15.9556 23.6424 15.8513C23.9738 15.747 24.3276 15.7362 24.6648 15.8201L35.3642 18.4809C35.7012 18.565 36.0085 18.7404 36.2522 18.9878C36.4959 19.2352 36.6667 19.5451 36.7457 19.8833C36.8247 20.2215 36.8088 20.5749 36.6999 20.9047C36.591 21.2345 36.3932 21.5278 36.1284 21.7525C35.0797 22.6448 33.8334 23.2744 32.4929 23.5891C31.1524 23.9039 29.7562 23.8947 28.42 23.5624C27.0837 23.2301 25.8458 22.5842 24.8089 21.6782C23.772 20.7722 22.9659 19.6322 22.4573 18.3526C22.3282 18.0301 22.2906 17.6782 22.3487 17.3356C22.4067 16.9931 22.5582 16.6732 22.7864 16.4112ZM16.9564 37.7421L23.871 33.75C24.5077 33.4096 25.248 33.3176 25.9487 33.4919C26.6493 33.6661 27.2603 34.0942 27.6634 34.6931L31.9012 41.4568C32.1985 41.9225 32.3362 42.4723 32.2936 43.0232C32.251 43.5741 32.0304 44.0962 31.6651 44.5107C31.3276 44.8836 30.8946 45.1571 30.4129 45.3017C29.9312 45.4463 29.4191 45.4564 28.9321 45.3309L17.7764 42.5566C17.2883 42.4411 16.8409 42.1945 16.4825 41.8435C16.1242 41.4924 15.8684 41.0503 15.7428 40.5646C15.6112 40.0262 15.6584 39.4595 15.8773 38.9503C16.0963 38.4411 16.475 38.017 16.9564 37.7421Z"
                  fill="#0E1B4D"
                />
              </g>
              <defs>
                <clipPath id="clip0_573_3612">
                  <rect
                    width="45.3097"
                    height="45.3097"
                    fill="white"
                    transform="translate(10.9351) rotate(13.9655)"
                  />
                </clipPath>
              </defs>
            </svg>
            <h2 className="text-dark-blue text-[32px] md:text-[52px] font-whitney font-black leading-none tracking-tight">
              LAST MINUTE DEALS
            </h2>
          </div>

          {/* Loading State */}
          {isLoadingDeals && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-dark-blue"></div>
              <p className="mt-4 text-gray-600 font-geograph">
                Loading last minute deals...
              </p>
            </div>
          )}

          {/* Cruise Grid - 3x2 on desktop */}
          {!isLoadingDeals && lastMinuteDeals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lastMinuteDeals.slice(0, 6).map((deal) => {
                // Use OBC from backend (10% of cheapest pricing) or calculate if missing
                const obc =
                  deal.onboard_credit ||
                  Math.floor((deal.cheapest_pricing * 0.1) / 10) * 10;

                // Calculate return date from sailing_date + nights
                const sailingDate = new Date(deal.sailing_date);
                const returnDate = new Date(sailingDate);
                returnDate.setDate(sailingDate.getDate() + deal.nights);

                // Format date range as "Oct 5 - Oct 12"
                const dateRange = `${sailingDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })} - ${returnDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`;

                // Truncate cruise name to max 27 characters
                const truncatedName =
                  deal.name.length > 27
                    ? deal.name.substring(0, 27) + "..."
                    : deal.name;

                return (
                  <div
                    key={deal.id}
                    className="cursor-pointer"
                    onClick={() => {
                      // Handle cruise click - convert to expected format
                      const cruiseForNavigation = {
                        id: deal.id,
                        shipId: deal.ship_id || 0,
                        shipName: deal.ship_name,
                        cruiseLineName: deal.cruise_line_name,
                        departureDate: deal.sailing_date,
                        returnDate: deal.return_date || "",
                        duration: deal.nights,
                        itinerary: [],
                        departurePort:
                          deal.embarkation_port_name ||
                          deal.embark_port_name ||
                          "",
                        prices: {
                          interior:
                            deal.cheapest_price || deal.cheapest_pricing,
                          oceanView:
                            deal.cheapest_price || deal.cheapest_pricing,
                          balcony: deal.cheapest_price || deal.cheapest_pricing,
                          suite: deal.cheapest_price || deal.cheapest_pricing,
                        },
                      } as unknown as Cruise;
                      handleCruiseClick(cruiseForNavigation);
                    }}
                  >
                    {/* Featured Image with Date Range Badge */}
                    <div className="relative">
                      <div className="h-[180px] bg-gray-200 relative overflow-hidden rounded-[18px]">
                        {deal.ship_image ? (
                          <OptimizedImage
                            src={deal.ship_image}
                            alt={deal.ship_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-light-blue to-dark-blue flex items-center justify-center">
                            <svg
                              width="64"
                              height="64"
                              viewBox="0 0 34 27"
                              fill="none"
                              style={{ shapeRendering: "geometricPrecision" }}
                              className="opacity-60"
                            >
                              <path
                                d="M32.8662 25.4355C32.0707 25.4334 31.2888 25.2282 30.5947 24.8395C29.9005 24.4508 29.3171 23.8914 28.8995 23.2142C28.478 23.8924 27.8906 24.4519 27.1926 24.8398C26.4947 25.2278 25.7094 25.4314 24.9109 25.4314C24.1124 25.4314 23.3271 25.2278 22.6292 24.8398C21.9313 24.4519 21.3438 23.8924 20.9223 23.2142C20.5031 23.894 19.9167 24.4551 19.2191 24.844C18.5215 25.2329 17.7359 25.4365 16.9372 25.4355C14.8689 25.4355 11.4533 22.2962 9.31413 20.0961C9.17574 19.9536 8.99997 19.8529 8.80698 19.8057C8.61399 19.7585 8.4116 19.7666 8.22303 19.8292C8.03445 19.8917 7.86733 20.0062 7.74084 20.1594C7.61435 20.3126 7.53361 20.4984 7.50788 20.6954C7.36621 22.0086 6.83213 23.3105 5.25396 23.3105C4.30812 23.2648 3.39767 22.9367 2.64011 22.3686C1.88255 21.8004 1.31265 21.0183 1.00396 20.123"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                              <path
                                d="M18 20.123L22.8875 18.9005C24.0268 18.6152 25.0946 18.097 26.0236 17.3784C26.9526 16.6598 27.7226 15.7566 28.285 14.7255L32.875 6.31055L1 12.6855"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                              <path
                                d="M25.2861 7.8278L18.0002 4.18555L4.18772 6.31055"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                              <path
                                d="M6.31254 11.6236L4.18754 6.31109L1.9662 2.60934C1.86896 2.4482 1.81632 2.26409 1.81369 2.0759C1.81107 1.8877 1.85854 1.7022 1.95125 1.53841C2.04396 1.37461 2.17857 1.23843 2.34127 1.14382C2.50397 1.0492 2.68891 0.999569 2.87712 1H6.31254L11.54 5.18059"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Date Range Badge - Moved to top-right */}
                      <div
                        className="absolute top-3 right-3 bg-white px-1 py-0.5 rounded-[3px]"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Geograph",
                          fontWeight: "bold",
                          color: "#3a3c3e",
                          letterSpacing: "-0.02em",
                          paddingLeft: "6px", // Added 2px more padding (was 4px)
                          paddingRight: "6px", // Added 2px more padding (was 4px)
                          paddingTop: "2px",
                          paddingBottom: "2px",
                        }}
                      >
                        {dateRange}
                      </div>
                    </div>

                    {/* Card Content - Two Column Layout */}
                    <div className="mt-4">
                      <div className="flex justify-between items-start">
                        {/* Left Side - Cruise Details */}
                        <div className="flex-1 pr-4">
                          {/* Cruise Name - Truncated */}
                          <h3
                            className="font-geograph font-medium"
                            style={{
                              fontSize: "18px",
                              color: "#0E1B4D",
                              letterSpacing: "-0.02em",
                              marginBottom: "14px", // Reduced from 16px (mb-4) to 14px
                              lineHeight: "1.1",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {truncatedName}
                          </h3>

                          {/* Duration and Port */}
                          <p
                            className="font-geograph font-medium mb-1"
                            style={{
                              fontSize: "13px",
                              color: "#2f2f2f",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {deal.nights} nights • {deal.embark_port_name}
                          </p>

                          {/* Cruise Line */}
                          <p
                            className="font-geograph"
                            style={{
                              fontSize: "13px",
                              color: "#2f2f2f",
                              letterSpacing: "-0.02em",
                              fontWeight: "normal",
                            }}
                          >
                            {deal.cruise_line_name || "Cruise Line"}
                          </p>
                        </div>

                        {/* Right Side - Pricing */}
                        <div className="flex flex-col items-end min-w-0">
                          {/* "STARTING FROM" label */}
                          <p
                            className="font-geograph font-bold"
                            style={{
                              fontSize: "9px",
                              color: "#474747",
                              letterSpacing: "0.1em",
                              marginBottom: "0.25px", // Reduced from 0.5px to half again
                            }}
                          >
                            STARTING FROM
                          </p>

                          {/* Price */}
                          <p
                            className="font-geograph font-medium"
                            style={{
                              fontSize: "22px",
                              letterSpacing: "-0.02em",
                              marginBottom: "4px", // Reduced space between price and OBC badge by half
                            }}
                          >
                            $
                            {Math.floor(deal.cheapest_pricing).toLocaleString()}
                          </p>

                          {/* OBC Badge */}
                          {obc > 0 && (
                            <div
                              className="rounded-[3px]"
                              style={{
                                backgroundColor: "#1b8f57",
                                fontSize: "13px",
                                fontFamily: "Geograph",
                                fontWeight: "500", // Changed to medium (500)
                                color: "white",
                                letterSpacing: "-0.02em",
                                paddingLeft: "7px", // Added 2px more padding (was 5px)
                                paddingRight: "7px", // Added 2px more padding (was 5px)
                                paddingTop: "3px", // Increased from 1px to 3px
                                paddingBottom: "3px", // Increased from 1px to 3px
                                whiteSpace: "nowrap", // Prevent text wrapping
                              }}
                            >
                              +${obc} onboard credit
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Separator Image 3 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />
    </>
  );
}

// Main export component with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeWithParams />
    </Suspense>
  );
}
