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
  const [isInitialized, setIsInitialized] = useState(false);

  // Track requests to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestCounterRef = useRef(0);

  // Log component mount and cleanup on unmount
  useEffect(() => {
    console.log("=== CRUISES CONTENT MOUNTED ===");
    console.log("Initial URL params:", searchParams.toString());
    console.log("Initial filter states:", {
      cruiseLines: selectedCruiseLines,
      months: selectedMonths,
      nights: selectedNightRanges,
      ports: selectedDeparturePorts,
      ships: selectedShips,
      regions: selectedRegions,
    });

    return () => {
      // Cancel any pending requests when component unmounts
      if (abortControllerRef.current) {
        console.log("=== COMPONENT UNMOUNTING - Cancelling requests ===");
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Reset the request counter
      requestCounterRef.current = 0;
    };
  }, []); // Empty dependency array means this only runs on mount/unmount

  // Filter states - support multi-select
  const [selectedCruiseLines, setSelectedCruiseLines] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedNightRanges, setSelectedNightRanges] = useState<string[]>([]);
  const [selectedDeparturePorts, setSelectedDeparturePorts] = useState<
    number[]
  >([]);
  const [selectedShips, setSelectedShips] = useState<number[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<number[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  // Filter dropdown states
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] =
    useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isNightsDropdownOpen, setIsNightsDropdownOpen] = useState(false);
  const [isDeparturePortDropdownOpen, setIsDeparturePortDropdownOpen] =
    useState(false);
  const [isShipDropdownOpen, setIsShipDropdownOpen] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Search states for filter dropdowns
  const [cruiseLineSearch, setCruiseLineSearch] = useState("");
  const [shipSearch, setShipSearch] = useState("");
  const [departurePortSearch, setDeparturePortSearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");

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

  // Function to update URL parameters
  const updateURLParams = (
    updates: Record<string, string | number | string[] | number[] | null>,
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(","));
      } else {
        params.set(key, String(value));
      }
    });

    // Always reset to page 1 when filters change (unless we're updating page itself)
    if (!updates.hasOwnProperty("page")) {
      params.set("page", "1");
    }

    // Build URL without trailing ? if no params
    const paramString = params.toString();
    const newUrl = paramString
      ? `${window.location.pathname}?${paramString}`
      : window.location.pathname;
    router.push(newUrl, { scroll: false });
  };

  // Fetch filter options from API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // Fetch data for filters from search results to get actual values
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30s for production

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/filter-options`,
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          // Set filter options - already sorted alphabetically by the API
          setCruiseLines(data.cruiseLines || []);
          setDeparturePorts(data.departurePorts || []);
          setShips(data.ships || []);
          setRegions(data.regions || []);
        } else {
          throw new Error("API response not ok");
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
        // Set empty arrays to prevent errors
        setCruiseLines([]);
        setDeparturePorts([]);
        setShips([]);
        setRegions([]);
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

  // Fetch cruises based on filters - NOT using useCallback to avoid stale closures
  const fetchCruises = async () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      console.log("=== CANCELLING PREVIOUS REQUEST ===");
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Increment request counter and save the current request ID
    const currentRequestId = ++requestCounterRef.current;
    console.log(`=== STARTING REQUEST #${currentRequestId} ===`);

    setLoading(true);
    setError(false);
    // Clear existing cruises to prevent showing stale data
    setCruises([]);

    try {
      const params = new URLSearchParams();

      // Add pagination
      params.append("limit", ITEMS_PER_PAGE.toString());
      params.append("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      // Add filters - support multiple selections
      selectedCruiseLines.forEach((id) =>
        params.append("cruiseLineId", id.toString()),
      );
      selectedDeparturePorts.forEach((id) =>
        params.append("departurePortId", id.toString()),
      );
      selectedShips.forEach((id) => params.append("shipId", id.toString()));
      selectedRegions.forEach((id) => params.append("regionId", id.toString()));

      // Handle month filters - send each selected month
      if (selectedMonths.length > 0) {
        selectedMonths.forEach((month) => {
          params.append("departureMonth", month);
        });
      }

      // Handle night ranges - send each range separately
      if (selectedNightRanges.length > 0) {
        selectedNightRanges.forEach((range) => {
          params.append("nightRange", range);
        });
      }

      // Add maxPrice filter if present
      if (maxPrice !== null) {
        params.append("maxPrice", maxPrice.toString());
      }

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

      // Log filter state for debugging

      // Add timestamp to prevent any caching
      params.append("_t", Date.now().toString());

      // Try to fetch from API with timeout
      // Use the abort controller we created at the beginning of fetchCruises
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // Increased to 30s for production

      const url = `${process.env.NEXT_PUBLIC_API_URL}/search/comprehensive?${params.toString()}`;

      console.log(`=== FETCHING URL: ${url} ===`);
      console.log(`Request params:`, params.toString());

      const response = await fetch(url, {
        signal: abortController.signal,
        cache: "no-store", // Prevent caching
        // Removed headers that cause CORS issues
        // The backend now handles cache prevention
      });

      clearTimeout(timeoutId);

      // Check if this is still the current request
      if (currentRequestId !== requestCounterRef.current) {
        console.log(
          `=== IGNORING STALE RESPONSE #${currentRequestId} (current: ${requestCounterRef.current}) ===`,
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API response not ok:", response.status, errorText);
        throw new Error(`API response not ok: ${response.status}`);
      }

      const data = await response.json();

      // Double-check this is still the current request before updating state
      if (currentRequestId !== requestCounterRef.current) {
        console.log(
          `=== IGNORING STALE DATA #${currentRequestId} (current: ${requestCounterRef.current}) ===`,
        );
        return;
      }

      // Backend now filters out cruises with no prices or prices <= $99
      // So we can directly use the results without frontend filtering
      const cruisesData = data.results || data.cruises || [];

      console.log(`=== UPDATING CRUISES FROM REQUEST #${currentRequestId} ===`);
      console.log(`Found ${cruisesData.length} cruises matching filters`);

      // Log first few cruises to verify they match the filters
      if (cruisesData.length > 0) {
        console.log(
          "First 3 cruises:",
          cruisesData.slice(0, 3).map((c: any) => ({
            id: c.id,
            name: c.name,
            sailingDate: c.sailing_date,
            cruiseLine: c.cruise_line_name,
          })),
        );
      }

      setCruises(cruisesData);
      // Use total from API pagination if available
      setTotalCount(data.pagination?.total || data.total || cruisesData.length);
    } catch (error) {
      console.error("Error fetching cruises:", error);
      if (error instanceof Error && error.message.includes("abort")) {
        console.log("Request was aborted (timeout)");
      }
      setError(true);
      setCruises([]); // Clear cruises on error
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Track if we've done the initial URL sync
  const hasInitializedRef = useRef(false);

  // Sync state with URL parameters when they change
  useEffect(() => {
    console.log("=== URL PARAMS SYNC ===");
    console.log("Current searchParams:", searchParams.toString());
    console.log("Has initialized before:", hasInitializedRef.current);

    // ALWAYS reset all filters first, then apply from URL
    // This ensures we don't have stale filter state
    console.log("Resetting all filters to empty");
    setSelectedCruiseLines([]);
    setSelectedMonths([]);
    setSelectedNightRanges([]);
    setSelectedDeparturePorts([]);
    setSelectedShips([]);
    setSelectedRegions([]);
    setMaxPrice(null);
    setPage(1);
    setSortBy("soonest");

    // Now apply filters from URL if they exist
    const cruiseLinesParam = searchParams.get("cruiseLines");
    const monthsParam = searchParams.get("months");
    const nightsParam = searchParams.get("nights");
    const portsParam = searchParams.get("ports");
    const shipsParam = searchParams.get("ships");
    const regionsParam = searchParams.get("regions");
    const maxPriceParam = searchParams.get("maxPrice");
    const pageParam = searchParams.get("page");
    const sortParam = searchParams.get("sort");

    // Update cruise lines
    if (cruiseLinesParam) {
      const lines = cruiseLinesParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      console.log("Setting cruise lines from URL:", lines);
      setSelectedCruiseLines(lines);
    }

    // Update months
    if (monthsParam) {
      const months = monthsParam.split(",");
      console.log("Setting months from URL:", months);
      setSelectedMonths(months);
    }

    // Update night ranges
    if (nightsParam) {
      const nights = nightsParam.split(",");
      console.log("Setting night ranges from URL:", nights);
      setSelectedNightRanges(nights);
    }

    // Update departure ports
    if (portsParam) {
      const ports = portsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      console.log("Setting departure ports from URL:", ports);
      setSelectedDeparturePorts(ports);
    }

    // Update ships
    if (shipsParam) {
      const shipIds = shipsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      console.log("Setting ships from URL:", shipIds);
      setSelectedShips(shipIds);
    }

    // Update regions
    if (regionsParam) {
      const regionIds = regionsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      console.log("Setting regions from URL:", regionIds);
      setSelectedRegions(regionIds);
    }

    // Update maxPrice if specified
    if (maxPriceParam) {
      const price = parseInt(maxPriceParam);
      if (!isNaN(price) && price > 0) {
        console.log("Setting maxPrice from URL:", price);
        setMaxPrice(price);
      }
    }

    // Update page if specified
    if (pageParam) {
      const pageNum = parseInt(pageParam);
      if (!isNaN(pageNum) && pageNum > 0) {
        setPage(pageNum);
      }
    }

    // Update sort if specified
    if (sortParam) {
      setSortBy(sortParam);
    }

    // Mark as initialized only on first run
    if (!hasInitializedRef.current) {
      console.log("=== INITIAL SYNC COMPLETE ===");
      hasInitializedRef.current = true;
      setIsInitialized(true);
    }
  }, [searchParams]);

  // Initial load is now handled by fetchCruises in the useEffect below

  // Fetch cruises when filters or page changes (now handles initial load too)
  useEffect(() => {
    // Skip fetch until URL params are processed on initial load
    if (!isInitialized) {
      console.log("=== FETCH SKIPPED - Not initialized ===");
      return;
    }

    console.log("=== FETCH TRIGGER ===");
    console.log("Triggering fetch with:", {
      page,
      selectedCruiseLines,
      selectedMonths,
      selectedNightRanges,
      selectedDeparturePorts,
      selectedShips,
      selectedRegions,
      maxPrice,
      sortBy,
    });
    fetchCruises();

    // Cleanup: cancel any pending request when dependencies change
    return () => {
      if (abortControllerRef.current) {
        console.log("=== CLEANUP: Cancelling pending request ===");
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [
    isInitialized,
    page,
    selectedCruiseLines,
    selectedMonths,
    selectedNightRanges,
    selectedDeparturePorts,
    selectedShips,
    selectedRegions,
    maxPrice,
    sortBy,
  ]);

  // Get applied filters for display - memoized for performance
  const appliedFilters = useMemo(() => {
    const filters: AppliedFilter[] = [];

    // Cruise lines
    selectedCruiseLines.forEach((lineId) => {
      const line = cruiseLines.find((cl) => cl.id === lineId);
      if (line) {
        filters.push({
          type: "cruiseLine",
          value: lineId,
          label: line.name,
        });
      }
    });

    // Months
    selectedMonths.forEach((month) => {
      const [year, monthNum] = month.split("-");
      const monthName = new Date(
        parseInt(year),
        parseInt(monthNum) - 1,
      ).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      filters.push({
        type: "month",
        value: month,
        label: monthName,
      });
    });

    // Night ranges
    selectedNightRanges.forEach((range) => {
      const label = range === "12+" ? "12+ nights" : `${range} nights`;
      filters.push({
        type: "nights",
        value: range,
        label: label,
      });
    });

    // Departure ports
    selectedDeparturePorts.forEach((portId) => {
      const port = departurePorts.find((p) => p.id === portId);
      if (port) {
        filters.push({
          type: "departurePort",
          value: portId,
          label: port.name,
        });
      }
    });

    // Ships
    selectedShips.forEach((shipId) => {
      const ship = ships.find((s) => s.id === shipId);
      if (ship) {
        filters.push({
          type: "ship",
          value: shipId,
          label: ship.name,
        });
      }
    });

    // Regions
    selectedRegions.forEach((regionId) => {
      const region = regions.find((r) => r.id === regionId);
      if (region) {
        filters.push({
          type: "region",
          value: regionId,
          label: region.name,
        });
      }
    });

    return filters;
  }, [
    selectedCruiseLines,
    selectedMonths,
    selectedNightRanges,
    selectedDeparturePorts,
    selectedShips,
    selectedRegions,
    cruiseLines,
    departurePorts,
    ships,
    regions,
  ]);

  const removeFilter = (filter: AppliedFilter) => {
    let updates: Record<string, any> = {};

    // Read from actual URL to avoid stale closures
    const urlParams = new URLSearchParams(window.location.search);

    switch (filter.type) {
      case "cruiseLine":
        const currentCruiseLines = urlParams.get("cruiseLines");
        const lines = currentCruiseLines
          ? currentCruiseLines
              .split(",")
              .map(Number)
              .filter((n) => !isNaN(n))
          : [];
        updates.cruiseLines = lines.filter((id) => id !== filter.value);
        break;
      case "month":
        const currentMonths = urlParams.get("months");
        const months = currentMonths ? currentMonths.split(",") : [];
        updates.months = months.filter((m) => m !== filter.value);
        break;
      case "nights":
        const currentNights = urlParams.get("nights");
        const nights = currentNights ? currentNights.split(",") : [];
        updates.nights = nights.filter((r) => r !== filter.value);
        break;
      case "departurePort":
        const currentPorts = urlParams.get("ports");
        const ports = currentPorts
          ? currentPorts
              .split(",")
              .map(Number)
              .filter((n) => !isNaN(n))
          : [];
        updates.ports = ports.filter((id) => id !== filter.value);
        break;
      case "ship":
        const currentShips = urlParams.get("ships");
        const ships = currentShips
          ? currentShips
              .split(",")
              .map(Number)
              .filter((n) => !isNaN(n))
          : [];
        updates.ships = ships.filter((id) => id !== filter.value);
        break;
      case "region":
        const currentRegions = urlParams.get("regions");
        const regions = currentRegions
          ? currentRegions
              .split(",")
              .map(Number)
              .filter((n) => !isNaN(n))
          : [];
        updates.regions = regions.filter((id) => id !== filter.value);
        break;
    }

    updates.page = 1;
    updateURLParams(updates);
  };

  const clearAllFilters = () => {
    console.log("=== CLEARING ALL FILTERS ===");
    // Clear URL completely and navigate to base path
    router.push("/cruises", { scroll: false });
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
      {/* Banner Section - Hidden on mobile */}
      <div className="hidden md:block max-w-7xl mx-auto px-4">
        <div
          className="bg-[#E9B4EB] rounded-[10px] px-8 py-6 cursor-pointer"
          onClick={handleOpenMissive}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="font-whitney font-black text-[#0E1B4D] uppercase text-[32px] leading-[1.25] mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Always the most onboard credit back
              </h2>
              <p className="font-geograph text-[20px] text-[#0E1B4D]">
                Have a question? We're here to help, just click to chat →
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Mobile Filters Button */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="w-full px-6 py-3 bg-white border border-gray-300 rounded-full font-geograph font-medium text-[16px] text-dark-blue hover:border-gray-400 transition-colors"
          >
            Filters
          </button>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:flex flex-wrap gap-3 relative z-40 justify-center">
          {/* Cruise Lines Filter */}
          <div className="relative" ref={cruiseLineDropdownRef}>
            <button
              onClick={() =>
                setIsCruiseLineDropdownOpen(!isCruiseLineDropdownOpen)
              }
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                Cruise lines
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isCruiseLineDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50 flex flex-col max-h-96">
                {/* Search Input - Sticky */}
                <div className="sticky top-0 bg-white p-3 border-b border-gray-200 z-10">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={cruiseLineSearch}
                      onChange={(e) => setCruiseLineSearch(e.target.value)}
                      placeholder="Search cruise lines..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Scrollable Options */}
                <div className="overflow-y-auto flex-1">
                  {cruiseLines
                    .filter((line) =>
                      line.name
                        .toLowerCase()
                        .includes(cruiseLineSearch.toLowerCase()),
                    )
                    .map((line) => (
                      <button
                        key={line.id}
                        onClick={() => {
                          const lineId = line.id as number;
                          // Read current selection from actual URL to avoid stale closures
                          const urlParams = new URLSearchParams(
                            window.location.search,
                          );
                          const currentParam = urlParams.get("cruiseLines");
                          const currentLines = currentParam
                            ? currentParam
                                .split(",")
                                .map(Number)
                                .filter((n) => !isNaN(n))
                            : [];
                          const newSelection = currentLines.includes(lineId)
                            ? currentLines.filter((id) => id !== lineId)
                            : [...currentLines, lineId];
                          // Only update URL, let useEffect sync state
                          updateURLParams({
                            cruiseLines:
                              newSelection.length > 0 ? newSelection : null,
                            page: 1,
                          });
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedCruiseLines.includes(line.id as number)
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedCruiseLines.includes(line.id as number) && (
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
                      </button>
                    ))}
                </div>
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
                Cruise dates
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute top-full mt-2 w-96 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50 p-4">
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
                          const isSelected = selectedMonths.includes(monthStr);

                          // Check if month is in the past
                          const isPast =
                            year < currentYear ||
                            (year === currentYear && index < currentMonth);

                          return (
                            <button
                              key={monthStr}
                              onClick={() => {
                                if (!isPast) {
                                  // Read current selection from actual URL to avoid stale closures
                                  const urlParams = new URLSearchParams(
                                    window.location.search,
                                  );
                                  const currentParam = urlParams.get("months");
                                  const currentMonths = currentParam
                                    ? currentParam.split(",")
                                    : [];
                                  const newSelection = currentMonths.includes(
                                    monthStr,
                                  )
                                    ? currentMonths.filter(
                                        (m) => m !== monthStr,
                                      )
                                    : [...currentMonths, monthStr];
                                  // Only update URL, let useEffect sync state
                                  updateURLParams({
                                    months:
                                      newSelection.length > 0
                                        ? newSelection
                                        : null,
                                    page: 1,
                                  });
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

          {/* Number of Nights Filter */}
          <div className="relative" ref={nightsDropdownRef}>
            <button
              onClick={() => setIsNightsDropdownOpen(!isNightsDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
            >
              <span className="font-geograph font-medium text-[16px] text-dark-blue">
                Number of nights
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isNightsDropdownOpen && (
              <div className="absolute top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50 p-4">
                <div className="space-y-2">
                  {["2-5", "6-8", "9-11", "12+"].map((range) => {
                    const isSelected = selectedNightRanges.includes(range);
                    return (
                      <button
                        key={range}
                        onClick={() => {
                          // Read current selection from actual URL to avoid stale closures
                          const urlParams = new URLSearchParams(
                            window.location.search,
                          );
                          const currentParam = urlParams.get("nights");
                          const currentNights = currentParam
                            ? currentParam.split(",")
                            : [];
                          const newSelection = currentNights.includes(range)
                            ? currentNights.filter((r) => r !== range)
                            : [...currentNights, range];
                          // Only update URL, let useEffect sync state
                          updateURLParams({
                            nights:
                              newSelection.length > 0 ? newSelection : null,
                            page: 1,
                          });
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            isSelected
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
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
                        <span className="font-geograph text-[16px] text-dark-blue">
                          {range === "12+" ? "12+ nights" : `${range} nights`}
                        </span>
                      </button>
                    );
                  })}
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
                Departure port
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isDeparturePortDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50 flex flex-col max-h-96">
                {/* Search Input - Sticky */}
                <div className="sticky top-0 bg-white p-3 border-b border-gray-200 z-10">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={departurePortSearch}
                      onChange={(e) => setDeparturePortSearch(e.target.value)}
                      placeholder="Search ports..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Scrollable Options */}
                <div className="overflow-y-auto flex-1">
                  {departurePorts
                    .filter((port) =>
                      port.name
                        .toLowerCase()
                        .includes(departurePortSearch.toLowerCase()),
                    )
                    .map((port) => (
                      <button
                        key={port.id}
                        onClick={() => {
                          const portId = port.id as number;
                          // Read current selection from actual URL to avoid stale closures
                          const urlParams = new URLSearchParams(
                            window.location.search,
                          );
                          const currentParam = urlParams.get("ports");
                          const currentPorts = currentParam
                            ? currentParam
                                .split(",")
                                .map(Number)
                                .filter((n) => !isNaN(n))
                            : [];
                          const newSelection = currentPorts.includes(portId)
                            ? currentPorts.filter((id) => id !== portId)
                            : [...currentPorts, portId];
                          // Only update URL, let useEffect sync state
                          updateURLParams({
                            ports:
                              newSelection.length > 0 ? newSelection : null,
                            page: 1,
                          });
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedDeparturePorts.includes(port.id as number)
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedDeparturePorts.includes(
                            port.id as number,
                          ) && (
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
                          {port.name}
                        </div>
                      </button>
                    ))}
                </div>
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
                Ships
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isShipDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50 flex flex-col max-h-96">
                {/* Search Input - Sticky */}
                <div className="sticky top-0 bg-white p-3 border-b border-gray-200 z-10">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={shipSearch}
                      onChange={(e) => setShipSearch(e.target.value)}
                      placeholder="Search ships..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Scrollable Options */}
                <div className="overflow-y-auto flex-1">
                  {ships
                    .filter((ship) =>
                      ship.name
                        .toLowerCase()
                        .includes(shipSearch.toLowerCase()),
                    )
                    .map((ship) => (
                      <button
                        key={ship.id}
                        onClick={() => {
                          const shipId = ship.id as number;
                          // Read current selection from actual URL to avoid stale closures
                          const urlParams = new URLSearchParams(
                            window.location.search,
                          );
                          const currentParam = urlParams.get("ships");
                          const currentShips = currentParam
                            ? currentParam
                                .split(",")
                                .map(Number)
                                .filter((n) => !isNaN(n))
                            : [];
                          const newSelection = currentShips.includes(shipId)
                            ? currentShips.filter((id) => id !== shipId)
                            : [...currentShips, shipId];
                          // Only update URL, let useEffect sync state
                          updateURLParams({
                            ships:
                              newSelection.length > 0 ? newSelection : null,
                            page: 1,
                          });
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedShips.includes(ship.id as number)
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedShips.includes(ship.id as number) && (
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
                          {ship.name}
                        </div>
                      </button>
                    ))}
                </div>
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
                Region
              </span>
              <Image
                src="/images/arrow-down.svg"
                alt="Arrow"
                width={12}
                height={12}
              />
            </button>

            {isRegionDropdownOpen && (
              <div className="absolute top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50 flex flex-col max-h-96">
                {/* Search Input - Sticky */}
                <div className="sticky top-0 bg-white p-3 border-b border-gray-200 z-10">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      placeholder="Search regions..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Scrollable Options */}
                <div className="overflow-y-auto flex-1">
                  {regions
                    .filter((region) =>
                      region.name
                        .toLowerCase()
                        .includes(regionSearch.toLowerCase()),
                    )
                    .map((region) => (
                      <button
                        key={region.id}
                        onClick={() => {
                          const regionId = region.id as number;
                          // Read current selection from actual URL to avoid stale closures
                          const urlParams = new URLSearchParams(
                            window.location.search,
                          );
                          const currentParam = urlParams.get("regions");
                          const currentRegions = currentParam
                            ? currentParam
                                .split(",")
                                .map(Number)
                                .filter((n) => !isNaN(n))
                            : [];
                          const newSelection = currentRegions.includes(regionId)
                            ? currentRegions.filter((id) => id !== regionId)
                            : [...currentRegions, regionId];
                          // Only update URL, let useEffect sync state
                          updateURLParams({
                            regions:
                              newSelection.length > 0 ? newSelection : null,
                            page: 1,
                          });
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedRegions.includes(region.id as number)
                              ? "bg-[#0E1B4D] border-[#0E1B4D]"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedRegions.includes(region.id as number) && (
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
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Applied Filters and Sort */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex justify-between items-center gap-4">
          {/* Applied Filters */}
          <div className="flex items-center gap-3 flex-wrap flex-1 justify-start">
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
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#d9d9d9] z-50">
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
                        setIsSortDropdownOpen(false);
                        // Only update URL, let useEffect sync state
                        updateURLParams({
                          sort: option,
                          page: 1,
                        });
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors font-geograph text-[16px] text-dark-blue"
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
        <div className="max-w-7xl mx-auto mt-[10px]">
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
                    className="bg-white border border-gray-200 rounded-lg pt-[14px] px-3 pb-3 md:p-4 cursor-pointer overflow-hidden"
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden">
                      {/* Cruise Name - increased by 2px (18px → 20px), line-height 0.9 */}
                      <h3
                        className="font-whitney font-black uppercase text-[#2F2F2F] text-[20px] mb-2"
                        style={{ letterSpacing: "-0.02em", lineHeight: "0.9" }}
                      >
                        {cruise.name}
                      </h3>

                      {/* Cruise Line • Ship Name */}
                      <p className="font-geograph text-[14px] text-[#606060] mb-3">
                        {cruise.cruiseLine?.name || "Unknown Line"} •{" "}
                        {cruise.ship?.name || "Unknown Ship"}
                      </p>

                      {/* Ship Image + Details Grid */}
                      <div className="flex gap-3 mb-3">
                        {/* Ship Image - 140x100px (increased from 120x80px) */}
                        <div className="w-[140px] h-[100px] bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {cruise.ship?.defaultShipImage ||
                          cruise.ship?.defaultShipImageHd ||
                          cruise.ship?.defaultShipImage2k ||
                          cruise.shipImage ||
                          cruise.shipImageHd ||
                          cruise.shipImage2k ||
                          cruise.featuredImageUrl ? (
                            <Image
                              src={
                                cruise.ship?.defaultShipImage ||
                                cruise.ship?.defaultShipImageHd ||
                                cruise.ship?.defaultShipImage2k ||
                                cruise.shipImage ||
                                cruise.shipImageHd ||
                                cruise.shipImage2k ||
                                cruise.featuredImageUrl ||
                                ""
                              }
                              alt={
                                cruise.ship?.name ||
                                cruise.name ||
                                "Cruise ship"
                              }
                              fill
                              sizes="140px"
                              className="object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              No image
                            </div>
                          )}
                        </div>

                        {/* 2x2 Grid: Depart, Return, Leaving, Nights */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
                          {/* Depart Date */}
                          <div>
                            <div
                              className="font-geograph font-bold text-[11px] uppercase text-gray-500 mb-[-1px]"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              DEPART
                            </div>
                            <div className="font-geograph font-medium text-[16px] text-[#2F2F2F]">
                              {(() => {
                                const dateString =
                                  cruise.sailingDate || cruise.departureDate;
                                if (!dateString) return "N/A";
                                try {
                                  const date = new Date(dateString);
                                  return date
                                    .toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      timeZone: "UTC",
                                    })
                                    .replace(/,/g, "");
                                } catch {
                                  return "N/A";
                                }
                              })()}
                            </div>
                          </div>

                          {/* Return Date */}
                          <div>
                            <div
                              className="font-geograph font-bold text-[11px] uppercase text-gray-500 mb-[-1px]"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              RETURN
                            </div>
                            <div className="font-geograph font-medium text-[16px] text-[#2F2F2F]">
                              {(() => {
                                const dateString =
                                  cruise.sailingDate || cruise.departureDate;
                                if (!dateString || !cruise.nights) return "N/A";
                                try {
                                  const departDate = new Date(dateString);
                                  const returnDate = new Date(departDate);
                                  returnDate.setUTCDate(
                                    departDate.getUTCDate() + cruise.nights,
                                  );
                                  return returnDate
                                    .toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      timeZone: "UTC",
                                    })
                                    .replace(/,/g, "");
                                } catch {
                                  return "N/A";
                                }
                              })()}
                            </div>
                          </div>

                          {/* Leaving */}
                          <div>
                            <div
                              className="font-geograph font-bold text-[11px] uppercase text-gray-500 mb-[-1px]"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              LEAVING
                            </div>
                            <div className="font-geograph font-medium text-[16px] text-[#2F2F2F]">
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

                          {/* Nights */}
                          <div>
                            <div
                              className="font-geograph font-bold text-[11px] uppercase text-gray-500 mb-[-1px]"
                              style={{ letterSpacing: "0.1em" }}
                            >
                              NIGHTS
                            </div>
                            <div className="font-geograph font-medium text-[16px] text-[#2F2F2F]">
                              {cruise.nights}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Horizontal Separator */}
                      <div className="border-t border-gray-200 mb-3"></div>

                      {/* Price Block - Right Aligned */}
                      <div className="flex justify-end">
                        <div className="text-right">
                          {/* STARTING FROM Label */}
                          <div className="font-geograph font-bold text-[12px] text-gray-500 uppercase tracking-wider mb-[-3px]">
                            STARTING FROM
                          </div>

                          {/* Price */}
                          <div className="font-geograph font-bold text-[22px] text-dark-blue">
                            {(() => {
                              const prices: number[] = [];
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

                          {/* Onboard Credit Badge - Below Price */}
                          {(() => {
                            const prices: number[] = [];
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
                                  if (!isNaN(num) && num > 0) prices.push(num);
                                }
                              });
                            }
                            if (cruise.combined) {
                              [
                                cruise.combined.inside,
                                cruise.combined.outside,
                                cruise.combined.balcony,
                                cruise.combined.suite,
                              ].forEach((p) => {
                                if (p && p !== "0" && p !== "null") {
                                  const num = Number(p);
                                  if (!isNaN(num) && num > 0) prices.push(num);
                                }
                              });
                            }
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
                                  if (!isNaN(num) && num > 0) prices.push(num);
                                }
                              });
                            }
                            if (prices.length > 0) {
                              const lowestPrice = Math.min(...prices);
                              const creditPercent = 0.2;
                              const rawCredit = lowestPrice * creditPercent;
                              const onboardCredit =
                                Math.floor(rawCredit / 10) * 10;
                              if (onboardCredit > 0) {
                                return (
                                  <div className="font-geograph font-medium text-[14px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] mt-2">
                                    +${onboardCredit} onboard credit
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout - Unchanged */}
                    <div className="hidden md:flex md:gap-6">
                      {/* Featured Image */}
                      <div className="w-48 h-32 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {cruise.ship?.defaultShipImage ||
                        cruise.ship?.defaultShipImageHd ||
                        cruise.ship?.defaultShipImage2k ||
                        cruise.shipImage ||
                        cruise.shipImageHd ||
                        cruise.shipImage2k ||
                        cruise.featuredImageUrl ? (
                          <Image
                            src={
                              cruise.ship?.defaultShipImage ||
                              cruise.ship?.defaultShipImageHd ||
                              cruise.ship?.defaultShipImage2k ||
                              cruise.shipImage ||
                              cruise.shipImageHd ||
                              cruise.shipImage2k ||
                              cruise.featuredImageUrl ||
                              ""
                            }
                            alt={
                              cruise.ship?.name || cruise.name || "Cruise ship"
                            }
                            fill
                            sizes="192px"
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No image
                          </div>
                        )}
                      </div>

                      {/* Cruise Details */}
                      <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center">
                        <div className="flex-1">
                          <h3
                            className="font-whitney font-black uppercase text-[#2F2F2F] text-[24px] mb-1"
                            style={{ letterSpacing: "-0.02em" }}
                          >
                            {cruise.name}
                          </h3>

                          {/* Desktop: Cruise line and ship */}
                          <div className="mb-2 md:mb-4 hidden md:block">
                            <p className="font-geograph text-[12px] md:text-[16px] text-[#606060]">
                              {cruise.cruiseLine?.name || "Unknown Line"} |{" "}
                              {cruise.ship?.name || "Unknown Ship"}
                            </p>
                          </div>

                          {/* Desktop grid layout */}
                          <div className="hidden md:grid grid-cols-4 gap-4">
                            <div>
                              <div
                                className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                                style={{ letterSpacing: "0.1em" }}
                              >
                                DEPART
                              </div>
                              <div className="font-geograph font-medium text-[12px] md:text-[18px] text-[#2F2F2F]">
                                {(() => {
                                  // Use the same logic as cruise detail page
                                  const dateString =
                                    cruise.sailingDate || cruise.departureDate;

                                  if (!dateString) {
                                    return "N/A";
                                  }

                                  try {
                                    const date = new Date(dateString);
                                    // Format without day of week for mobile
                                    return date
                                      .toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        timeZone: "UTC",
                                      })
                                      .replace(/,/g, "");
                                  } catch {
                                    return "N/A";
                                  }
                                })()}
                              </div>
                            </div>

                            <div>
                              <div
                                className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                                style={{ letterSpacing: "0.1em" }}
                              >
                                RETURN
                              </div>
                              <div className="font-geograph font-medium text-[12px] md:text-[18px] text-[#2F2F2F]">
                                {(() => {
                                  // Calculate return date using same logic as detail page
                                  const dateString =
                                    cruise.sailingDate || cruise.departureDate;

                                  if (!dateString || !cruise.nights) {
                                    return "N/A";
                                  }

                                  try {
                                    const departDate = new Date(dateString);
                                    const returnDate = new Date(departDate);
                                    returnDate.setUTCDate(
                                      departDate.getUTCDate() + cruise.nights,
                                    );

                                    // Format without day of week for mobile
                                    return returnDate
                                      .toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        timeZone: "UTC",
                                      })
                                      .replace(/,/g, "");
                                  } catch {
                                    return "N/A";
                                  }
                                })()}
                              </div>
                            </div>

                            <div>
                              <div
                                className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1"
                                style={{ letterSpacing: "0.1em" }}
                              >
                                <span className="hidden md:inline">
                                  DEPARTURE PORT
                                </span>
                                <span className="md:hidden">LEAVING</span>
                              </div>
                              <div className="font-geograph font-medium text-[12px] md:text-[18px] text-[#2F2F2F]">
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
                              <div className="font-geograph font-medium text-[12px] md:text-[18px] text-[#2F2F2F]">
                                {cruise.nights}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Desktop Pricing - separate section */}
                        <div className="hidden md:flex flex-col items-end">
                          <div className="md:text-right">
                            <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                              STARTING FROM
                            </div>
                            <div className="font-geograph font-bold text-[18px] md:text-[24px] text-dark-blue">
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
                            {/* Onboard Credit Badge */}
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

                              if (prices.length > 0) {
                                const lowestPrice = Math.min(...prices);
                                // Calculate 20% of the price as onboard credit, rounded down to nearest $10
                                const creditPercent = 0.2; // 20%
                                const rawCredit = lowestPrice * creditPercent;
                                const onboardCredit =
                                  Math.floor(rawCredit / 10) * 10; // Round down to nearest $10

                                if (onboardCredit > 0) {
                                  return (
                                    <div className="hidden md:block font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] mt-1">
                                      +${onboardCredit} onboard credit
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()}
                          </div>
                        </div>
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
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  // Only update URL, let useEffect sync state
                  updateURLParams({ page: newPage });
                }}
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
                      onClick={() => {
                        // Only update URL, let useEffect sync state
                        updateURLParams({ page: pageNum });
                      }}
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
                onClick={() => {
                  const newPage = Math.min(totalPages, page + 1);
                  // Only update URL, let useEffect sync state
                  updateURLParams({ page: newPage });
                }}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden pt-[50px]">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-whitney font-black text-[24px] text-dark-blue uppercase">
                Filters
              </h2>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="p-2"
              >
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

            {/* Filter Options */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Cruise Lines */}
              <div className="pb-6 border-b border-gray-200">
                <h3 className="font-geograph font-bold text-[14px] text-gray-700 uppercase mb-3">
                  Cruise Lines
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={cruiseLineSearch}
                      onChange={(e) => setCruiseLineSearch(e.target.value)}
                      placeholder="Search cruise lines..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {cruiseLines
                    .filter((line) =>
                      line.name
                        .toLowerCase()
                        .includes(cruiseLineSearch.toLowerCase()),
                    )
                    .map((line) => (
                      <label key={line.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCruiseLines.includes(
                            line.id as number,
                          )}
                          onChange={() => {
                            const lineId = line.id as number;
                            const newSelection = selectedCruiseLines.includes(
                              lineId,
                            )
                              ? selectedCruiseLines.filter(
                                  (id) => id !== lineId,
                                )
                              : [...selectedCruiseLines, lineId];
                            setSelectedCruiseLines(newSelection);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-geograph text-[16px]">
                          {line.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Dates */}
              <div className="py-6 border-b border-gray-200">
                <h3 className="font-geograph font-bold text-[14px] text-gray-700 uppercase mb-3">
                  Cruise Dates
                </h3>
                <div className="space-y-4">
                  {["2025", "2026", "2027"].map((year) => {
                    const currentDate = new Date();
                    const currentYear = currentDate.getFullYear();
                    const currentMonth = currentDate.getMonth();

                    return (
                      <div key={year}>
                        <div className="font-geograph font-bold text-[12px] text-gray-600 mb-2">
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
                          ].map((month, idx) => {
                            const monthKey = `${year}-${String(idx + 1).padStart(2, "0")}`;
                            const isSelected =
                              selectedMonths.includes(monthKey);

                            // Check if month is in the past
                            const isPast =
                              parseInt(year) < currentYear ||
                              (parseInt(year) === currentYear &&
                                idx < currentMonth);

                            return (
                              <button
                                key={monthKey}
                                onClick={() => {
                                  if (!isPast) {
                                    const newSelection = isSelected
                                      ? selectedMonths.filter(
                                          (m) => m !== monthKey,
                                        )
                                      : [...selectedMonths, monthKey];
                                    setSelectedMonths(newSelection);
                                  }
                                }}
                                disabled={isPast}
                                className={`py-2 px-3 rounded-lg text-[14px] font-geograph ${
                                  isPast
                                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
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
              </div>

              {/* Number of Nights */}
              <div className="py-6 border-b border-gray-200">
                <h3 className="font-geograph font-bold text-[14px] text-gray-700 uppercase mb-3">
                  Number of Nights
                </h3>
                <div className="space-y-2">
                  {["1-5", "6-8", "9-11", "12+"].map((range) => (
                    <label key={range} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedNightRanges.includes(range)}
                        onChange={() => {
                          const newSelection = selectedNightRanges.includes(
                            range,
                          )
                            ? selectedNightRanges.filter((r) => r !== range)
                            : [...selectedNightRanges, range];
                          setSelectedNightRanges(newSelection);
                        }}
                        className="w-4 h-4"
                      />
                      <span className="font-geograph text-[16px]">
                        {range === "12+" ? "12+ nights" : `${range} nights`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Departure Ports */}
              <div className="py-6 border-b border-gray-200">
                <h3 className="font-geograph font-bold text-[14px] text-gray-700 uppercase mb-3">
                  Departure Ports
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={departurePortSearch}
                      onChange={(e) => setDeparturePortSearch(e.target.value)}
                      placeholder="Search ports..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {departurePorts
                    .filter((port) =>
                      port.name
                        .toLowerCase()
                        .includes(departurePortSearch.toLowerCase()),
                    )
                    .map((port) => (
                      <label key={port.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedDeparturePorts.includes(
                            port.id as number,
                          )}
                          onChange={() => {
                            const portId = port.id as number;
                            const newSelection =
                              selectedDeparturePorts.includes(portId)
                                ? selectedDeparturePorts.filter(
                                    (id) => id !== portId,
                                  )
                                : [...selectedDeparturePorts, portId];
                            setSelectedDeparturePorts(newSelection);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-geograph text-[16px]">
                          {port.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Ships */}
              <div className="py-6 border-b border-gray-200">
                <h3 className="font-geograph font-bold text-[14px] text-gray-700 uppercase mb-3">
                  Ships
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={shipSearch}
                      onChange={(e) => setShipSearch(e.target.value)}
                      placeholder="Search ships..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {ships
                    .filter((ship) =>
                      ship.name
                        .toLowerCase()
                        .includes(shipSearch.toLowerCase()),
                    )
                    .map((ship) => (
                      <label key={ship.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedShips.includes(ship.id as number)}
                          onChange={() => {
                            const shipId = ship.id as number;
                            const newSelection = selectedShips.includes(shipId)
                              ? selectedShips.filter((id) => id !== shipId)
                              : [...selectedShips, shipId];
                            setSelectedShips(newSelection);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-geograph text-[16px]">
                          {ship.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Regions */}
              <div className="pt-6">
                <h3 className="font-geograph font-bold text-[14px] text-gray-700 uppercase mb-3">
                  Regions
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <div className="relative">
                    <Image
                      src="/images/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                    />
                    <input
                      type="text"
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      placeholder="Search regions..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {regions
                    .filter((region) =>
                      region.name
                        .toLowerCase()
                        .includes(regionSearch.toLowerCase()),
                    )
                    .map((region) => (
                      <label
                        key={region.id}
                        className="flex items-center gap-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(
                            region.id as number,
                          )}
                          onChange={() => {
                            const regionId = region.id as number;
                            const newSelection = selectedRegions.includes(
                              regionId,
                            )
                              ? selectedRegions.filter((id) => id !== regionId)
                              : [...selectedRegions, regionId];
                            setSelectedRegions(newSelection);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-geograph text-[16px]">
                          {region.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // Apply filters and close modal
                  updateURLParams({
                    cruiseLines:
                      selectedCruiseLines.length > 0
                        ? selectedCruiseLines
                        : null,
                    months: selectedMonths.length > 0 ? selectedMonths : null,
                    nights:
                      selectedNightRanges.length > 0
                        ? selectedNightRanges
                        : null,
                    ports:
                      selectedDeparturePorts.length > 0
                        ? selectedDeparturePorts
                        : null,
                    ships: selectedShips.length > 0 ? selectedShips : null,
                    regions:
                      selectedRegions.length > 0 ? selectedRegions : null,
                    page: 1,
                  });
                  setIsFilterModalOpen(false);
                }}
                className="w-full py-3 bg-[#0E1B4D] text-white font-geograph font-medium text-[16px] rounded-full hover:bg-[#0E1B4D]/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
