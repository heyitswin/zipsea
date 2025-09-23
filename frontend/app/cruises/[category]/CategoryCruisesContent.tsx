"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navigation from "../../components/Navigation";
import { formatPrice } from "../../../lib/utils";
import { createSlugFromCruise } from "../../../lib/slug";
import { CategoryConfig } from "../../../lib/cruise-categories";

interface Cruise {
  id: string;
  cruiseId?: string;
  name: string;
  voyageCode?: string;
  nights: number;
  sailingDate: string;
  sailingDateText?: string;
  departureDate?: string;
  embarkPortName: string;
  disembarkPortName: string;
  interiorPrice?: string;
  oceanviewPrice?: string;
  oceanViewPrice?: string;
  balconyPrice?: string;
  suitePrice?: string;
  cheapestPrice?: string;
  pricing?: {
    interior?: number | string;
    oceanview?: number | string;
    balcony?: number | string;
    suite?: number | string;
    lowestPrice?: number | string;
  };
  combined?: {
    inside?: number | string;
    outside?: number | string;
    balcony?: number | string;
    suite?: number | string;
  };
  cruiseLine?: {
    id: number;
    name: string;
  };
  ship?: {
    id: number;
    name: string;
    defaultShipImage?: string;
    defaultShipImage2k?: string;
    defaultShipImageHd?: string;
  };
  shipImage?: string;
  shipImage2k?: string;
  shipImageHd?: string;
  embarkPort?: {
    id: number;
    name: string;
  };
  departurePort?: string;
  destinationName?: string;
  description?: string;
  featuredImageUrl?: string;
}

interface FilterOption {
  id: number | string;
  name: string;
  count?: number;
}

interface Props {
  category: CategoryConfig;
}

export default function CategoryCruisesContent({ category }: Props) {
  const router = useRouter();

  // State management
  const [featuredCruises, setFeaturedCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Search state
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedCruiseLine, setSelectedCruiseLine] = useState<string>("");
  const [cruiseLines, setCruiseLines] = useState<FilterOption[]>([]);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] = useState(false);

  // Refs for dropdown click outside detection
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const cruiseLineDropdownRef = useRef<HTMLDivElement>(null);

  // Track requests to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get current year and month for date picker
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // Fetch featured cruises for this category (just 6)
  const fetchFeaturedCruises = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams();

      // Add category filters
      if (category.filters.regionId) {
        const regionIds = Array.isArray(category.filters.regionId)
          ? category.filters.regionId
          : [category.filters.regionId];
        regionIds.forEach(id => params.append("regionId", id.toString()));
      }

      if (category.filters.cruiseLineId) {
        const lineIds = Array.isArray(category.filters.cruiseLineId)
          ? category.filters.cruiseLineId
          : [category.filters.cruiseLineId];
        lineIds.forEach(id => params.append("cruiseLineId", id.toString()));
      }

      if (category.filters.departurePortId) {
        const portIds = Array.isArray(category.filters.departurePortId)
          ? category.filters.departurePortId
          : [category.filters.departurePortId];
        portIds.forEach(id => params.append("departurePortId", id.toString()));
      }

      if (category.filters.minNights !== undefined) {
        params.append("minNights", category.filters.minNights.toString());
      }

      if (category.filters.maxNights !== undefined) {
        params.append("maxNights", category.filters.maxNights.toString());
      }

      if (category.filters.maxPrice !== undefined) {
        params.append("maxPrice", category.filters.maxPrice.toString());
      }

      // Special handling for last-minute cruises (departing within 60 days)
      if (category.slug === 'last-minute') {
        const today = new Date();
        const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
        params.append("endDate", sixtyDaysFromNow.toISOString().split('T')[0]);
      }

      params.append("limit", "6"); // Only get 6 featured cruises
      params.append("sortBy", "date");
      params.append("sortOrder", "asc");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/search/comprehensive?${params.toString()}`,
        {
          signal: abortController.signal,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch cruises");
      }

      const data = await response.json();
      setFeaturedCruises(data.results || []);
      setLoading(false);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error fetching cruises:", err);
        setError(true);
        setLoading(false);
      }
    }
  }, [category]);

  // Fetch cruise lines for dropdown
  const fetchCruiseLines = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/filters/cruise-lines`,
      );
      if (response.ok) {
        const data = await response.json();
        setCruiseLines(data || []);
      }
    } catch (err) {
      console.error("Error fetching cruise lines:", err);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchFeaturedCruises();
    fetchCruiseLines();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchFeaturedCruises, fetchCruiseLines]);

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  // Helper function to parse price
  const getPrice = (cruise: Cruise): number => {
    if (cruise.cheapestPrice) {
      return parseFloat(cruise.cheapestPrice);
    }
    if (cruise.pricing?.lowestPrice) {
      return typeof cruise.pricing.lowestPrice === "string"
        ? parseFloat(cruise.pricing.lowestPrice)
        : cruise.pricing.lowestPrice;
    }
    return 0;
  };

  // Handle search button click
  const handleSearch = () => {
    const params = new URLSearchParams();

    // Add category filters
    if (category.filters.regionId) {
      params.append("regions", Array.isArray(category.filters.regionId)
        ? category.filters.regionId.join(',')
        : category.filters.regionId.toString());
    }

    if (category.filters.departurePortId) {
      params.append("departurePorts", Array.isArray(category.filters.departurePortId)
        ? category.filters.departurePortId.join(',')
        : category.filters.departurePortId.toString());
    }

    if (category.filters.minNights !== undefined) {
      params.append("minNights", category.filters.minNights.toString());
    }

    if (category.filters.maxNights !== undefined) {
      params.append("maxNights", category.filters.maxNights.toString());
    }

    if (category.filters.maxPrice !== undefined) {
      params.append("maxPrice", category.filters.maxPrice.toString());
    }

    // Add user selections
    if (selectedMonth) {
      params.append("months", selectedMonth);
    }

    if (selectedCruiseLine) {
      params.append("cruiseLines", selectedCruiseLine);
    }

    // Navigate to cruises page with filters
    router.push(`/cruises?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg">
      <Navigation />

      {/* Hero Section - Centered like guides */}
      <section
        className="relative pt-[100px] pb-[80px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[42px] md:text-[72px]"
            style={{ letterSpacing: "-0.02em", lineHeight: 1, color: "#F7F170" }}
          >
            {category.title}
          </h1>
          <h2 className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            {category.name} - Best Deals & Maximum Onboard Credit
          </h2>
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
      <main className="py-[40px] md:py-[80px]">
        <div className="max-w-7xl mx-auto px-4">
          {/* SEO Description */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <p className="font-geograph text-[18px] text-[#666] leading-relaxed">
              {category.description}
            </p>
          </div>

          {/* Search Bar Section */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="bg-white rounded-[10px] border border-[#E5E5E5] p-6">
              <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-4">
                Refine Your {category.name} Search
              </h3>

              <div className="flex flex-col md:flex-row gap-4">
                {/* Month Selector */}
                <div className="flex-1 relative" ref={dateDropdownRef}>
                  <button
                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-[#E5E5E5] rounded-[10px] hover:border-[#0E1B4D] transition-colors"
                  >
                    <span className="font-geograph text-[16px] text-[#0E1B4D]">
                      {selectedMonth ?
                        new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }) :
                        "Select Month"}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isDateDropdownOpen && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-[10px] shadow-lg border border-[#E5E5E5] z-50 p-4 max-h-96 overflow-y-auto">
                      {[currentYear, currentYear + 1, currentYear + 2].map((year) => (
                        <div key={year} className="mb-4">
                          <div className="font-geograph font-bold text-[14px] text-gray-700 mb-2">
                            {year}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, index) => {
                              const monthStr = `${year}-${String(index + 1).padStart(2, "0")}`;
                              const isSelected = selectedMonth === monthStr;
                              const isPast = year < currentYear || (year === currentYear && index < currentMonth);

                              return (
                                <button
                                  key={monthStr}
                                  onClick={() => {
                                    if (!isPast) {
                                      setSelectedMonth(isSelected ? "" : monthStr);
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
                      ))}
                    </div>
                  )}
                </div>

                {/* Cruise Line Selector */}
                <div className="flex-1 relative" ref={cruiseLineDropdownRef}>
                  <button
                    onClick={() => setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-[#E5E5E5] rounded-[10px] hover:border-[#0E1B4D] transition-colors"
                  >
                    <span className="font-geograph text-[16px] text-[#0E1B4D]">
                      {selectedCruiseLine ?
                        cruiseLines.find(cl => cl.id.toString() === selectedCruiseLine)?.name || "Select Cruise Line" :
                        "Select Cruise Line"}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isCruiseLineDropdownOpen && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-[10px] shadow-lg border border-[#E5E5E5] z-50 p-2 max-h-96 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedCruiseLine("");
                          setIsCruiseLineDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 font-geograph text-[16px] rounded-[8px] transition-colors ${
                          !selectedCruiseLine ? "bg-[#F6F3ED]" : "hover:bg-[#F6F3ED]"
                        }`}
                      >
                        All Cruise Lines
                      </button>
                      {cruiseLines.map((line) => (
                        <button
                          key={line.id}
                          onClick={() => {
                            setSelectedCruiseLine(line.id.toString());
                            setIsCruiseLineDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 font-geograph text-[16px] rounded-[8px] transition-colors ${
                            selectedCruiseLine === line.id.toString() ? "bg-[#F6F3ED]" : "hover:bg-[#F6F3ED]"
                          }`}
                        >
                          {line.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  className="px-8 py-3 bg-[#0E1B4D] text-white font-geograph font-bold text-[16px] rounded-[10px] hover:bg-[#2238C3] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Cruises
                </button>
              </div>
            </div>
          </div>

          {/* Featured Cruises Section */}
          <div className="mb-12">
            <h3 className="font-whitney font-black uppercase text-[32px] text-[#0E1B4D] mb-8 text-center">
              Featured {category.name} Cruises
            </h3>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E1B4D]"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 font-geograph">Failed to load cruises. Please try again.</p>
              </div>
            ) : featuredCruises.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#666] font-geograph">No cruises found for this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {featuredCruises.map((cruise) => {
                  const price = getPrice(cruise);
                  const cruiseSlug = createSlugFromCruise({
                    id: cruise.id,
                    shipName: cruise.ship?.name || "unknown",
                    sailingDate: cruise.sailingDate,
                  });

                  // Calculate return date
                  const sailingDate = new Date(cruise.sailingDate);
                  const returnDate = new Date(sailingDate);
                  returnDate.setDate(sailingDate.getDate() + cruise.nights);

                  // Format date range
                  const dateRange = `${sailingDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })} - ${returnDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}`;

                  // Truncate name if too long
                  const truncatedName = (cruise.ship?.name || cruise.name).length > 27
                    ? (cruise.ship?.name || cruise.name).substring(0, 27) + "..."
                    : (cruise.ship?.name || cruise.name);

                  // Calculate OBC (20% of cheapest price, rounded to nearest 10)
                  const obc = Math.floor((price * 0.2) / 10) * 10;

                  return (
                    <div
                      key={cruise.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/cruise/${cruiseSlug}`)}
                    >
                      {/* Featured Image with Date Range Badge */}
                      <div className="relative">
                        <div className="h-[180px] bg-gray-200 relative overflow-hidden rounded-[18px]">
                          {cruise.ship?.defaultShipImage2k || cruise.ship?.defaultShipImage || cruise.shipImage ? (
                            <Image
                              src={
                                cruise.ship?.defaultShipImage2k ||
                                cruise.ship?.defaultShipImage ||
                                cruise.shipImage ||
                                ""
                              }
                              alt={cruise.ship?.name || "Cruise ship"}
                              fill
                              className="object-cover"
                            />
                          ) : (
                        </div>

                        {/* Date Range Badge */}
                        <div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full">
                          <span className="font-geograph font-bold text-[14px] text-[#0E1B4D]">
                            {dateRange}
                          </span>
                        </div>

                      {/* Cruise Details */}
                      <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center p-3 md:p-0">
                        <div className="flex-1">
                          <h3
                            className="font-whitney font-black uppercase text-[#2F2F2F] text-[18px] md:text-[24px] mb-1"
                            style={{ letterSpacing: "-0.02em" }}
                          >
                            {cruise.ship?.name || cruise.name}
                          </h3>

                          {/* Mobile: Cruise line/ship and price block */}
                          <div className="md:hidden flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <p className="font-geograph text-[14px] text-[#606060]">
                                {cruise.cruiseLine?.name || "Unknown Line"}
                              </p>
                              <p className="font-geograph text-[14px] text-[#606060]">
                                {cruise.nights} Nights • {cruise.embarkPortName}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-geograph font-bold text-[12px] text-gray-500 uppercase tracking-wider mb-1">
                                STARTING FROM
                              </div>
                              <div className="font-geograph font-bold text-[20px] text-[#0E1B4D]">
                                ${price.toFixed(0)}
                              </div>
                            </div>
                          </div>

                          {/* Desktop: Cruise details */}
                          <div className="hidden md:block">
                            <p className="font-geograph text-[14px] text-[#606060] mb-1">
                              {cruise.cruiseLine?.name} • {cruise.nights} Nights
                            </p>
                            <p className="font-geograph text-[14px] text-[#606060]">
                              {cruise.embarkPortName} •{" "}
                              {new Date(cruise.sailingDate).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
mt4
                          20px] text-[0E1B4D

                        {truncatedName}
                                                <p className="font-geograph text-[14px] text-[#666] mb-1">
                          {cruise.cruiseLine?.name}
                        </p>
                        <p className="font-geograph text-[14px] text-[#666] mb-3">
                          {cruise.nights} Nights • {cruise.embarkPortName}
                        </p>

                        {/* Price and OBC */}
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="font-geograph font-bold text-[12px] text-gray-500 uppercase tracking-wider">
                              FROM
                            <p className="font-geograph font-bold text-[24px] text-[#0E1B4D]">
                              ${price.toFixed(0)}
                          <div className="text-right">
                            <p className="font-geograph text-[12px] text-[#666]">
                              + ${obc} Onboard Credit
                            </p>
                        </div>

                        {/* Desktop Price */}
                        <div className="hidden md:block text-right">
                          <div className="font-geograph font-bold text-[12px] text-gray-500 uppercase tracking-wider mb-1">
                            STARTING FROM
                          </div>
                          <div className="font-geograph font-bold text-[28px] text-[#0E1B4D]">
                            ${price.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SEO Content Section */}
          {!loading && !error && (
            <>
              {/* FAQs */}
              {category.faqItems && category.faqItems.length > 0 && (
                <div className="mb-12">
                  <h2
                    className="font-whitney font-black uppercase text-[28px] text-[#0E1B4D] mb-6 text-center"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Frequently Asked Questions
                  </h2>
                  <div className="max-w-4xl mx-auto space-y-4">
                    {category.faqItems.map((faq, index) => (
                      <div key={index} className="bg-white p-6 rounded-[10px] border border-[#E5E5E5]">
                        <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">{faq.question}</h3>
                        <p className="font-geograph text-[16px] text-[#666] leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why Book With Us */}
              <div className="max-w-4xl mx-auto">
                <div className="bg-white p-6 rounded-[10px] border border-[#E5E5E5]">
                  <h2
                    className="font-whitney font-black uppercase text-[28px] text-[#0E1B4D] mb-4 text-center"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Why Book with Zipsea?
                  </h2>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg
                        className="w-5 h-5 text-[#2238C3] mr-3 mt-1 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-geograph text-[16px] text-[#666]">
                        Maximum onboard credit on every booking - more spending money for your vacation
                      </span>
                    </li>
                    <li className="flex items-start">
                      <svg
                        className="w-5 h-5 text-[#2238C3] mr-3 mt-1 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-geograph text-[16px] text-[#666]">
                        Compare prices across all major cruise lines in one place
                      </span>
                    </li>
                    <li className="flex items-start">
                      <svg
                        className="w-5 h-5 text-[#2238C3] mr-3 mt-1 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-geograph text-[16px] text-[#666]">
                        Real-time pricing and availability direct from cruise lines
                      </span>
                    </li>
                    <li className="flex items-start">
                      <svg
                        className="w-5 h-5 text-[#2238C3] mr-3 mt-1 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-geograph text-[16px] text-[#666]">
                        Expert cruise consultants available to help you plan
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
