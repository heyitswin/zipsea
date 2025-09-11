"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Navigation from "../components/Navigation";
import { formatPrice } from "../../lib/utils";
import { createSlugFromCruise } from "../../lib/slug";

interface Cruise {
  id: string;
  cruiseId?: string;
  name: string;
  voyageCode?: string;
  nights: number;
  sailingDate: string;
  sailingDateText?: string;
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

interface AppliedFilter {
  type: string;
  value: string | number;
  label: string;
}

export default function CruisesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("soonest");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Filter states
  const [selectedCruiseLine, setSelectedCruiseLine] = useState<number | null>(
    null,
  );
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start?: string;
    end?: string;
  }>({});
  const [selectedNights, setSelectedNights] = useState<{
    min?: number;
    max?: number;
  }>({});
  const [selectedDeparturePort, setSelectedDeparturePort] = useState<
    number | null
  >(null);
  const [selectedShip, setSelectedShip] = useState<number | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);

  // Filter dropdown states
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] =
    useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isNightsDropdownOpen, setIsNightsDropdownOpen] = useState(false);
  const [isDeparturePortDropdownOpen, setIsDeparturePortDropdownOpen] =
    useState(false);
  const [isShipDropdownOpen, setIsShipDropdownOpen] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);

  // Filter options from API
  const [cruiseLines, setCruiseLines] = useState<FilterOption[]>([]);
  const [departurePorts, setDeparturePorts] = useState<FilterOption[]>([]);
  const [ships, setShips] = useState<FilterOption[]>([]);
  const [regions, setRegions] = useState<FilterOption[]>([]);

  // Refs for dropdown click outside detection
  const cruiseLineDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const nightsDropdownRef = useRef<HTMLDivElement>(null);
  const departurePortDropdownRef = useRef<HTMLDivElement>(null);
  const shipDropdownRef = useRef<HTMLDivElement>(null);
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 20;

  // Fetch filter options from API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // Fetch data for filters from search results to get actual values
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/search/comprehensive?limit=100`,
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const results = data.results || [];

          // Extract unique cruise lines
          const cruiseLineMap = new Map();
          results.forEach((cruise: any) => {
            if (cruise.cruiseLine) {
              const id = cruise.cruiseLine.id;
              if (!cruiseLineMap.has(id)) {
                cruiseLineMap.set(id, {
                  id,
                  name: cruise.cruiseLine.name,
                  count: 1,
                });
              } else {
                cruiseLineMap.get(id).count++;
              }
            }
          });

          // Extract unique departure ports
          const portMap = new Map();
          results.forEach((cruise: any) => {
            if (cruise.embarkPort) {
              const id = cruise.embarkPort.id;
              if (!portMap.has(id)) {
                portMap.set(id, {
                  id,
                  name: cruise.embarkPort.name,
                  count: 1,
                });
              } else {
                portMap.get(id).count++;
              }
            }
          });

          // Extract unique ships
          const shipMap = new Map();
          results.forEach((cruise: any) => {
            if (cruise.ship) {
              const id = cruise.ship.id;
              if (!shipMap.has(id)) {
                shipMap.set(id, {
                  id,
                  name: cruise.ship.name,
                  count: 1,
                });
              } else {
                shipMap.get(id).count++;
              }
            }
          });

          // Extract unique regions (simplified)
          const regionMap = new Map();
          const regionNames = [
            "Caribbean",
            "Mediterranean",
            "Alaska",
            "Europe",
            "Asia",
          ];
          regionNames.forEach((name, index) => {
            regionMap.set(index + 1, {
              id: index + 1,
              name,
              count: Math.floor(Math.random() * 100) + 10, // Placeholder counts
            });
          });

          // Convert maps to arrays and sort by count
          setCruiseLines(
            Array.from(cruiseLineMap.values()).sort(
              (a, b) => b.count - a.count,
            ),
          );
          setDeparturePorts(
            Array.from(portMap.values()).sort((a, b) => b.count - a.count),
          );
          setShips(
            Array.from(shipMap.values()).sort((a, b) => b.count - a.count),
          );
          setRegions(
            Array.from(regionMap.values()).sort((a, b) => b.count - a.count),
          );
        } else {
          throw new Error("API response not ok");
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
        // Set some default values to prevent empty dropdowns
        setCruiseLines([
          { id: 22, name: "Royal Caribbean", count: 100 },
          { id: 23, name: "Carnival", count: 80 },
          { id: 24, name: "Norwegian", count: 60 },
        ]);
        setDeparturePorts([
          { id: 410, name: "Miami, Florida", count: 50 },
          { id: 411, name: "Fort Lauderdale, Florida", count: 40 },
          { id: 412, name: "Port Canaveral, Florida", count: 30 },
        ]);
        setShips([
          { id: 270, name: "Freedom of the Seas", count: 20 },
          { id: 271, name: "Oasis of the Seas", count: 15 },
        ]);
        setRegions([
          { id: 1, name: "Caribbean", count: 100 },
          { id: 2, name: "Mediterranean", count: 50 },
          { id: 3, name: "Alaska", count: 30 },
        ]);
      }
    };

    fetchFilterOptions();
  }, []);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cruiseLineDropdownRef.current &&
        !cruiseLineDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCruiseLineDropdownOpen(false);
      }
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDateDropdownOpen(false);
      }
      if (
        nightsDropdownRef.current &&
        !nightsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsNightsDropdownOpen(false);
      }
      if (
        departurePortDropdownRef.current &&
        !departurePortDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDeparturePortDropdownOpen(false);
      }
      if (
        shipDropdownRef.current &&
        !shipDropdownRef.current.contains(event.target as Node)
      ) {
        setIsShipDropdownOpen(false);
      }
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRegionDropdownOpen(false);
      }
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch cruises based on filters
  const fetchCruises = useCallback(async () => {
    setLoading(true);
    setError(false);
    // Clear existing cruises to prevent showing stale data
    setCruises([]);
    try {
      const params = new URLSearchParams();

      // Add pagination
      params.append("limit", ITEMS_PER_PAGE.toString());
      params.append("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      // Add filters
      if (selectedCruiseLine)
        params.append("cruiseLineId", selectedCruiseLine.toString());
      if (selectedDeparturePort)
        params.append("departurePortId", selectedDeparturePort.toString());
      if (selectedShip) params.append("shipId", selectedShip.toString());
      if (selectedRegion) params.append("regionId", selectedRegion.toString());
      if (selectedDateRange.start)
        params.append("startDate", selectedDateRange.start);
      if (selectedDateRange.end)
        params.append("endDate", selectedDateRange.end);
      if (selectedNights.min)
        params.append("minNights", selectedNights.min.toString());
      if (selectedNights.max)
        params.append("maxNights", selectedNights.max.toString());

      // Add sorting
      switch (sortBy) {
        case "soonest":
          params.append("sortBy", "date");
          params.append("sortOrder", "asc");
          break;
        case "lowest_price":
          params.append("sortBy", "price");
          params.append("sortOrder", "asc");
          break;
        case "highest_price":
          params.append("sortBy", "price");
          params.append("sortOrder", "desc");
          break;
        case "shortest":
          params.append("sortBy", "nights");
          params.append("sortOrder", "asc");
          break;
        case "longest":
          params.append("sortBy", "nights");
          params.append("sortOrder", "desc");
          break;
      }

      // Try to fetch from API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/search/comprehensive?${params.toString()}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Filter out cruises without any valid prices
        const filteredCruises = (data.results || []).filter(
          (cruise: Cruise) => {
            // Check pricing object first
            if (cruise.pricing) {
              const hasValidPrice = [
                cruise.pricing.interior,
                cruise.pricing.oceanview,
                cruise.pricing.balcony,
                cruise.pricing.suite,
                cruise.pricing.lowestPrice,
              ].some(
                (price) =>
                  price &&
                  price !== "0" &&
                  price !== "null" &&
                  Number(price) > 0,
              );
              if (hasValidPrice) return true;
            }

            // Check combined field
            if (cruise.combined) {
              const hasValidPrice = [
                cruise.combined.inside,
                cruise.combined.outside,
                cruise.combined.balcony,
                cruise.combined.suite,
              ].some(
                (price) =>
                  price &&
                  price !== "0" &&
                  price !== "null" &&
                  Number(price) > 0,
              );
              if (hasValidPrice) return true;
            }

            // Fallback to individual price fields
            const prices = [
              cruise.cheapestPrice,
              cruise.interiorPrice,
              cruise.oceanviewPrice,
              cruise.oceanViewPrice,
              cruise.balconyPrice,
              cruise.suitePrice,
            ]
              .filter((p) => p && p !== "0" && p !== "null")
              .map((p) => Number(p))
              .filter((p) => !isNaN(p) && p > 0);

            return prices.length > 0;
          },
        );

        setCruises(filteredCruises);
        setTotalCount(filteredCruises.length);
      } else {
        throw new Error("API response not ok");
      }
    } catch (error) {
      console.error("Error fetching cruises:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    selectedCruiseLine,
    selectedDateRange,
    selectedNights,
    selectedDeparturePort,
    selectedShip,
    selectedRegion,
    sortBy,
  ]);

  // Force fresh data fetch on component mount
  useEffect(() => {
    // Reset cruises to prevent showing stale cached data
    setCruises([]);
    setLoading(true);
    fetchCruises();
  }, [fetchCruises]);

  // Clear any cached state when component unmounts
  useEffect(() => {
    return () => {
      setCruises([]);
    };
  }, []);

  // Get applied filters for display - memoized for performance
  const appliedFilters = useMemo(() => {
    const filters: AppliedFilter[] = [];

    if (selectedCruiseLine) {
      const line = cruiseLines.find((cl) => cl.id === selectedCruiseLine);
      if (line)
        filters.push({
          type: "cruiseLine",
          value: selectedCruiseLine,
          label: line.name,
        });
    }

    if (selectedDateRange.start || selectedDateRange.end) {
      const label = `${selectedDateRange.start || "Any"} - ${selectedDateRange.end || "Any"}`;
      filters.push({ type: "date", value: "date", label });
    }

    if (selectedNights.min || selectedNights.max) {
      const label = `${selectedNights.min || "0"}-${selectedNights.max || "30+"} nights`;
      filters.push({ type: "nights", value: "nights", label });
    }

    if (selectedDeparturePort) {
      const port = departurePorts.find((p) => p.id === selectedDeparturePort);
      if (port)
        filters.push({
          type: "departurePort",
          value: selectedDeparturePort,
          label: port.name,
        });
    }

    if (selectedShip) {
      const ship = ships.find((s) => s.id === selectedShip);
      if (ship)
        filters.push({ type: "ship", value: selectedShip, label: ship.name });
    }

    if (selectedRegion) {
      const region = regions.find((r) => r.id === selectedRegion);
      if (region)
        filters.push({
          type: "region",
          value: selectedRegion,
          label: region.name,
        });
    }

    return filters;
  }, [
    selectedCruiseLine,
    selectedDateRange,
    selectedNights,
    selectedDeparturePort,
    selectedShip,
    selectedRegion,
    cruiseLines,
    departurePorts,
    ships,
    regions,
  ]);

  const removeFilter = (filter: AppliedFilter) => {
    switch (filter.type) {
      case "cruiseLine":
        setSelectedCruiseLine(null);
        break;
      case "date":
        setSelectedDateRange({});
        break;
      case "nights":
        setSelectedNights({});
        break;
      case "departurePort":
        setSelectedDeparturePort(null);
        break;
      case "ship":
        setSelectedShip(null);
        break;
      case "region":
        setSelectedRegion(null);
        break;
    }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSelectedCruiseLine(null);
    setSelectedDateRange({});
    setSelectedNights({});
    setSelectedDeparturePort(null);
    setSelectedShip(null);
    setSelectedRegion(null);
    setPage(1);
  };

  const handleOpenMissive = () => {
    // Open Missive chat widget using the correct API
    if (typeof window !== "undefined" && (window as any).MissiveChat) {
      (window as any).MissiveChat.open();
    }
  };

  const totalPages = useMemo(
    () => Math.ceil(totalCount / ITEMS_PER_PAGE),
    [totalCount],
  );

  return (
    <div className="min-h-screen bg-[#F6F3ED] pt-[100px]">
      {/* Banner Section */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div
          className="bg-[#E9B4EB] rounded-[10px] p-8 cursor-pointer"
          onClick={handleOpenMissive}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="font-whitney font-black text-[#0E1B4D] uppercase mb-2 text-[32px]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Always the most onboard credit back
              </h2>
              <p className="font-geograph text-[20px] text-[#0E1B4D]">
                Have a question? We're here to help, just click to chat →
              </p>
            </div>
            <Image
              src="/images/zippy.png"
              alt="Zippy"
              width={100}
              height={100}
              className="w-[100px] h-auto"
            />
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-3 relative z-40">
          {/* Cruise Lines Filter */}
          <div className="relative" ref={cruiseLineDropdownRef}>
            <button
              onClick={() =>
                setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)
              }
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                {selectedCruiseLine
                  ? cruiseLines.find((cl) => cl.id === selectedCruiseLine)?.name
                  : "Cruise lines"}
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isCruiseLineDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {cruiseLines.map((line) => (
                  <button
                    key={line.id}
                    onClick={() => {
                      setSelectedCruiseLine(line.id as number);
                      setIsCruiseLineDropdownOpen(false);
                      setPage(1);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-geograph text-[16px] text-dark-blue">
                      {line.name}
                    </div>
                    {line.count && (
                      <div className="font-geograph text-[14px] text-gray-500">
                        {line.count} cruises
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cruise Dates Filter */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                {selectedDateRange.start || selectedDateRange.end
                  ? "Selected dates"
                  : "Cruise dates"}
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block font-geograph text-[14px] text-gray-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={selectedDateRange.start || ""}
                      onChange={(e) => {
                        setSelectedDateRange({
                          ...selectedDateRange,
                          start: e.target.value,
                        });
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-geograph text-[14px] text-gray-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={selectedDateRange.end || ""}
                      onChange={(e) => {
                        setSelectedDateRange({
                          ...selectedDateRange,
                          end: e.target.value,
                        });
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setIsDateDropdownOpen(false)}
                    className="w-full py-2 bg-[#0E1B4D] text-white rounded-lg hover:bg-opacity-90 transition-colors font-geograph"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Number of Nights Filter */}
          <div className="relative" ref={nightsDropdownRef}>
            <button
              onClick={() => setIsNightsDropdownOpen(!isNightsDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                {selectedNights.min || selectedNights.max
                  ? `${selectedNights.min || 0}-${selectedNights.max || 30}+ nights`
                  : "Number of nights"}
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isNightsDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block font-geograph text-[14px] text-gray-600 mb-1">
                      Min Nights
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={selectedNights.min || ""}
                      onChange={(e) => {
                        setSelectedNights({
                          ...selectedNights,
                          min: parseInt(e.target.value) || undefined,
                        });
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-geograph text-[14px] text-gray-600 mb-1">
                      Max Nights
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={selectedNights.max || ""}
                      onChange={(e) => {
                        setSelectedNights({
                          ...selectedNights,
                          max: parseInt(e.target.value) || undefined,
                        });
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setIsNightsDropdownOpen(false)}
                    className="w-full py-2 bg-[#0E1B4D] text-white rounded-lg hover:bg-opacity-90 transition-colors font-geograph"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Departure Port Filter */}
          <div className="relative" ref={departurePortDropdownRef}>
            <button
              onClick={() =>
                setIsDeparturePortDropdownOpen(!isDeparturePortDropdownOpen)
              }
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                {selectedDeparturePort
                  ? departurePorts.find((p) => p.id === selectedDeparturePort)
                      ?.name
                  : "Departure port"}
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isDeparturePortDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {departurePorts.map((port) => (
                  <button
                    key={port.id}
                    onClick={() => {
                      setSelectedDeparturePort(port.id as number);
                      setIsDeparturePortDropdownOpen(false);
                      setPage(1);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-geograph text-[16px] text-dark-blue">
                      {port.name}
                    </div>
                    {port.count && (
                      <div className="font-geograph text-[14px] text-gray-500">
                        {port.count} cruises
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ships Filter */}
          <div className="relative" ref={shipDropdownRef}>
            <button
              onClick={() => setIsShipDropdownOpen(!isShipDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                {selectedShip
                  ? ships.find((s) => s.id === selectedShip)?.name
                  : "Ships"}
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isShipDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {ships.map((ship) => (
                  <button
                    key={ship.id}
                    onClick={() => {
                      setSelectedShip(ship.id as number);
                      setIsShipDropdownOpen(false);
                      setPage(1);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-geograph text-[16px] text-dark-blue">
                      {ship.name}
                    </div>
                    {ship.count && (
                      <div className="font-geograph text-[14px] text-gray-500">
                        {ship.count} cruises
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Region Filter */}
          <div className="relative" ref={regionDropdownRef}>
            <button
              onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                {selectedRegion
                  ? regions.find((r) => r.id === selectedRegion)?.name
                  : "Region"}
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isRegionDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {regions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => {
                      setSelectedRegion(region.id as number);
                      setIsRegionDropdownOpen(false);
                      setPage(1);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-geograph text-[16px] text-dark-blue">
                      {region.name}
                    </div>
                    {region.count && (
                      <div className="font-geograph text-[14px] text-gray-500">
                        {region.count} cruises
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Applied Filters and Sort */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-start gap-4">
          {/* Applied Filters */}
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {appliedFilters.map((filter, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1 bg-[#0E1B4D] rounded-full"
              >
                <span className="font-geograph font-medium text-[14px] text-white">
                  {filter.label}
                </span>
                <button
                  onClick={() => removeFilter(filter)}
                  className="flex items-center justify-center"
                >
                  <Image
                    src="/images/close-white.svg"
                    alt="Remove"
                    width={12}
                    height={12}
                  />
                </button>
              </div>
            ))}

            {appliedFilters.length > 0 && (
              <button
                onClick={clearAllFilters}
                className="font-geograph font-medium text-[14px] text-[#0E1B4D] underline hover:opacity-80 transition-opacity"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex-shrink-0">
            <div className="relative inline-block" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
              >
                <span className="font-geograph font-medium text-[16px] text-dark-blue">
                  Sort by:{" "}
                  {sortBy === "soonest"
                    ? "Soonest"
                    : sortBy === "lowest_price"
                      ? "Lowest price"
                      : sortBy === "highest_price"
                        ? "Highest price"
                        : sortBy === "shortest"
                          ? "Shortest cruises"
                          : "Longest cruises"}
                </span>
                <Image
                  src="/images/arrow-down.svg"
                  alt="Arrow"
                  width={12}
                  height={12}
                />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {[
                    "soonest",
                    "lowest_price",
                    "highest_price",
                    "shortest",
                    "longest",
                  ].map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortBy(option);
                        setIsSortDropdownOpen(false);
                        setPage(1);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors font-geograph font-medium text-[16px] text-dark-blue"
                    >
                      {option === "soonest"
                        ? "Soonest"
                        : option === "lowest_price"
                          ? "Lowest price"
                          : option === "highest_price"
                            ? "Highest price"
                            : option === "shortest"
                              ? "Shortest cruises"
                              : "Longest cruises"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cruise Results */}
        <div className="max-w-7xl mx-auto px-4 pb-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">Loading cruises...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">
                There was a problem fetching cruises, try reloading the page in
                a couple seconds
              </div>
            </div>
          ) : cruises.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">
                No cruises found matching your criteria
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {cruises.map((cruise) => {
                const slug = createSlugFromCruise({
                  id: cruise.id,
                  shipName: cruise.ship?.name || "unknown",
                  sailingDate: cruise.sailingDate,
                });

                return (
                  <div
                    key={cruise.id}
                    onClick={() => router.push(`/cruise/${slug}`)}
                    className="bg-white border border-gray-200 rounded-lg p-6 cursor-pointer"
                  >
                    <div className="flex gap-6">
                      {/* Featured Image */}
                      <div className="w-48 h-32 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {cruise.ship?.defaultShipImageHd ||
                        cruise.ship?.defaultShipImage2k ||
                        cruise.ship?.defaultShipImage ? (
                          <img
                            src={
                              cruise.ship.defaultShipImageHd ||
                              cruise.ship.defaultShipImage2k ||
                              cruise.ship.defaultShipImage
                            }
                            alt={cruise.ship?.name || cruise.name}
                            className="w-full h-full object-cover"
                          />
                        ) : cruise.featuredImageUrl ? (
                          <img
                            src={cruise.featuredImageUrl}
                            alt={cruise.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No image
                          </div>
                        )}
                      </div>

                      {/* Cruise Details */}
                      <div className="flex-1">
                        <h3
                          className="font-whitney font-black uppercase text-[#2F2F2F] text-[24px] mb-1"
                          style={{ letterSpacing: "-0.02em" }}
                        >
                          {cruise.name}
                        </h3>

                        <p className="font-geograph text-[16px] text-[#606060] mb-4">
                          {cruise.cruiseLine?.name || "Unknown Line"} |{" "}
                          {cruise.ship?.name || "Unknown Ship"}
                        </p>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <div
                              className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              DEPART
                            </div>
                            <div className="font-geograph font-medium text-[18px] text-[#2F2F2F]">
                              {new Date(cruise.sailingDate).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </div>
                          </div>

                          <div>
                            <div
                              className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              RETURN
                            </div>
                            <div className="font-geograph font-medium text-[18px] text-[#2F2F2F]">
                              {new Date(
                                new Date(cruise.sailingDate).getTime() +
                                  cruise.nights * 24 * 60 * 60 * 1000,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                          </div>

                          <div>
                            <div
                              className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              DEPARTURE PORT
                            </div>
                            <div className="font-geograph font-medium text-[18px] text-[#2F2F2F]">
                              {(() => {
                                const portName =
                                  cruise.embarkPort?.name ||
                                  cruise.embarkPortName ||
                                  "Unknown";
                                const commaIndex = portName.indexOf(",");
                                return commaIndex > -1
                                  ? portName.substring(0, commaIndex)
                                  : portName;
                              })()}
                            </div>
                          </div>

                          <div>
                            <div
                              className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              NIGHTS
                            </div>
                            <div className="font-geograph font-medium text-[18px] text-[#2F2F2F]">
                              {cruise.nights}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pricing and CTA */}
                      <div className="flex flex-col items-end justify-between">
                        <div className="text-right">
                          <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            STARTING FROM
                          </div>
                          <div className="font-geograph font-bold text-[24px] text-dark-blue">
                            {(() => {
                              const prices: number[] = [];

                              // Check pricing object first (from API)
                              if (cruise.pricing) {
                                [
                                  cruise.pricing.interior,
                                  cruise.pricing.oceanview,
                                  cruise.pricing.balcony,
                                  cruise.pricing.suite,
                                  cruise.pricing.lowestPrice,
                                ].forEach((p) => {
                                  if (p && p !== "0" && p !== "null") {
                                    const num = Number(p);
                                    if (!isNaN(num) && num > 0)
                                      prices.push(num);
                                  }
                                });
                              }

                              // Check combined field (from detail page)
                              if (cruise.combined) {
                                [
                                  cruise.combined.inside,
                                  cruise.combined.outside,
                                  cruise.combined.balcony,
                                  cruise.combined.suite,
                                ].forEach((p) => {
                                  if (p && p !== "0" && p !== "null") {
                                    const num = Number(p);
                                    if (!isNaN(num) && num > 0)
                                      prices.push(num);
                                  }
                                });
                              }

                              // Fallback to individual price fields
                              if (prices.length === 0) {
                                [
                                  cruise.cheapestPrice,
                                  cruise.interiorPrice,
                                  cruise.oceanviewPrice,
                                  cruise.oceanViewPrice,
                                  cruise.balconyPrice,
                                  cruise.suitePrice,
                                ].forEach((p) => {
                                  if (p && p !== "0" && p !== "null") {
                                    const num = Number(p);
                                    if (!isNaN(num) && num > 0)
                                      prices.push(num);
                                  }
                                });
                              }

                              return prices.length > 0
                                ? formatPrice(Math.min(...prices))
                                : "Call for price";
                            })()}
                          </div>
                        </div>

                        <button
                          className="px-4 py-2 bg-[#2F7DDD] text-white rounded-full font-geograph font-medium text-[14px] hover:bg-opacity-90 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/cruise/${slug}`);
                          }}
                        >
                          View cruise
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!error && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>

              <div className="flex gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-lg transition-colors ${
                        pageNum === page
                          ? "bg-[#0E1B4D] text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
