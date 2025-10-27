"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Navigation from "../components/Navigation";
import { formatPrice } from "../../lib/utils";
import { createSlugFromCruise } from "../../lib/slug";
import { getCruiseLineLogo } from "../../lib/cruiseLineLogos";

interface Cruise {
  id: string;
  cruiseId?: string;
  name: string;
  voyageCode?: string;
  nights: number;
  sailingDate: string;
  returnDate?: string;
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

  // Log component mount and cleanup on unmount
  useEffect(() => {
    console.log("=== CRUISES CONTENT MOUNTED ===");
    console.log("Initial URL params:", searchParams.toString());

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
  }, []);

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/filter-options`,
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setCruiseLines(data.cruiseLines || []);
          setDeparturePorts(data.departurePorts || []);
          setShips(data.ships || []);
          setRegions(data.regions || []);
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
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

  // Fetch cruises based on filters
  const fetchCruises = async () => {
    if (abortControllerRef.current) {
      console.log("=== CANCELLING PREVIOUS REQUEST ===");
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentRequestId = ++requestCounterRef.current;
    console.log(`=== STARTING REQUEST #${currentRequestId} ===`);

    setLoading(true);
    setError(false);
    setCruises([]);

    try {
      const params = new URLSearchParams();

      params.append("limit", ITEMS_PER_PAGE.toString());
      params.append("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      selectedCruiseLines.forEach((id) =>
        params.append("cruiseLineId", id.toString()),
      );
      selectedDeparturePorts.forEach((id) =>
        params.append("departurePortId", id.toString()),
      );
      selectedShips.forEach((id) => params.append("shipId", id.toString()));
      selectedRegions.forEach((id) => params.append("regionId", id.toString()));

      if (selectedMonths.length > 0) {
        selectedMonths.forEach((month) => {
          params.append("departureMonth", month);
        });
      }

      if (selectedNightRanges.length > 0) {
        selectedNightRanges.forEach((range) => {
          params.append("nightRange", range);
        });
      }

      if (maxPrice !== null) {
        params.append("maxPrice", maxPrice.toString());
      }

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

      params.append("_t", Date.now().toString());

      const url = `${process.env.NEXT_PUBLIC_API_URL}/search/comprehensive?${params.toString()}`;

      console.log(`=== FETCHING URL: ${url} ===`);

      const timeoutId = setTimeout(() => abortController.abort(), 30000);

      const response = await fetch(url, {
        signal: abortController.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (currentRequestId !== requestCounterRef.current) {
        console.log(
          `=== IGNORING STALE RESPONSE #${currentRequestId} (current: ${requestCounterRef.current}) ===`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`API response not ok: ${response.status}`);
      }

      const data = await response.json();

      if (currentRequestId !== requestCounterRef.current) {
        console.log(
          `=== IGNORING STALE DATA #${currentRequestId} (current: ${requestCounterRef.current}) ===`,
        );
        return;
      }

      const cruisesData = data.results || data.cruises || [];

      console.log(`=== UPDATING CRUISES FROM REQUEST #${currentRequestId} ===`);
      console.log(`Found ${cruisesData.length} cruises matching filters`);

      setCruises(cruisesData);
      setTotalCount(data.pagination?.total || data.total || cruisesData.length);
    } catch (error) {
      console.error("Error fetching cruises:", error);
      if (error instanceof Error && error.message.includes("abort")) {
        console.log("Request was aborted (timeout)");
      }
      setError(true);
      setCruises([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const hasInitializedRef = useRef(false);

  // Sync state with URL parameters when they change
  useEffect(() => {
    console.log("=== URL PARAMS SYNC ===");
    console.log("Current searchParams:", searchParams.toString());

    setSelectedCruiseLines([]);
    setSelectedMonths([]);
    setSelectedNightRanges([]);
    setSelectedDeparturePorts([]);
    setSelectedShips([]);
    setSelectedRegions([]);
    setMaxPrice(null);
    setPage(1);
    setSortBy("soonest");

    const cruiseLinesParam = searchParams.get("cruiseLines");
    const monthsParam = searchParams.get("months");
    const nightsParam = searchParams.get("nights");
    const portsParam = searchParams.get("ports");
    const shipsParam = searchParams.get("ships");
    const regionsParam = searchParams.get("regions");
    const maxPriceParam = searchParams.get("maxPrice");
    const pageParam = searchParams.get("page");
    const sortParam = searchParams.get("sort");

    if (cruiseLinesParam) {
      const lines = cruiseLinesParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      setSelectedCruiseLines(lines);
    }

    if (monthsParam) {
      setSelectedMonths(monthsParam.split(","));
    }

    if (nightsParam) {
      setSelectedNightRanges(nightsParam.split(","));
    }

    if (portsParam) {
      const ports = portsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      setSelectedDeparturePorts(ports);
    }

    if (shipsParam) {
      const shipIds = shipsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      setSelectedShips(shipIds);
    }

    if (regionsParam) {
      const regionIds = regionsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      setSelectedRegions(regionIds);
    }

    if (maxPriceParam) {
      const price = parseInt(maxPriceParam);
      if (!isNaN(price) && price > 0) {
        setMaxPrice(price);
      }
    }

    if (pageParam) {
      const pageNum = parseInt(pageParam);
      if (!isNaN(pageNum) && pageNum > 0) {
        setPage(pageNum);
      }
    }

    if (sortParam) {
      setSortBy(sortParam);
    }

    if (!hasInitializedRef.current) {
      console.log("=== INITIAL SYNC COMPLETE ===");
      hasInitializedRef.current = true;
      setIsInitialized(true);
    }
  }, [searchParams]);

  // Fetch cruises when filters or page changes
  useEffect(() => {
    if (!isInitialized) {
      console.log("=== FETCH SKIPPED - Not initialized ===");
      return;
    }

    console.log("=== FETCH TRIGGER ===");
    fetchCruises();

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

  // Get applied filters for display
  const appliedFilters = useMemo(() => {
    const filters: AppliedFilter[] = [];

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

    selectedNightRanges.forEach((range) => {
      const label = range === "12+" ? "12+ nights" : `${range} nights`;
      filters.push({
        type: "nights",
        value: range,
        label: label,
      });
    });

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
    router.push("/cruises", { scroll: false });
  };

  const handleOpenMissive = () => {
    if (typeof window !== "undefined" && (window as any).MissiveChat) {
      (window as any).MissiveChat.open();
    }
  };

  const totalPages = useMemo(
    () => Math.ceil(totalCount / ITEMS_PER_PAGE),
    [totalCount],
  );

  // Helper function to get lowest price
  const getLowestPrice = (cruise: Cruise): number | null => {
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

    return prices.length > 0 ? Math.min(...prices) : null;
  };

  // Helper function to format date
  const formatDate = (dateString: string | undefined): string => {
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
  };

  // Helper function to format date without year (for mobile end dates)
  const formatDateNoYear = (dateString: string | undefined): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
        .replace(/,/g, "");
    } catch {
      return "N/A";
    }
  };

  // Helper function to calculate return date
  const getReturnDate = (cruise: Cruise): string => {
    // First check if we have return_date from the API
    if (cruise.returnDate) {
      return formatDate(cruise.returnDate);
    }

    // Otherwise calculate it
    const dateString = cruise.sailingDate || cruise.departureDate;
    if (!dateString || !cruise.nights) return "N/A";

    try {
      const departDate = new Date(dateString);
      const returnDate = new Date(departDate);
      returnDate.setUTCDate(departDate.getUTCDate() + cruise.nights);
      return formatDate(returnDate.toISOString().split("T")[0]);
    } catch {
      return "N/A";
    }
  };

  // Helper function to calculate return date without year (for mobile)
  const getReturnDateNoYear = (cruise: Cruise): string => {
    // First check if we have return_date from the API
    if (cruise.returnDate) {
      return formatDateNoYear(cruise.returnDate);
    }

    // Otherwise calculate it
    const dateString = cruise.sailingDate || cruise.departureDate;
    if (!dateString || !cruise.nights) return "N/A";

    try {
      const departDate = new Date(dateString);
      const returnDate = new Date(departDate);
      returnDate.setUTCDate(departDate.getUTCDate() + cruise.nights);
      return formatDateNoYear(returnDate.toISOString().split("T")[0]);
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F3ED] pt-[100px]">
      {/* Main Content Area with Sidebar Filters */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar - Filters (Desktop Only) */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="space-y-4">
              {/* Cruise Lines Filter */}
              <div>
                <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                  Cruise Lines
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={cruiseLineSearch}
                    onChange={(e) => setCruiseLineSearch(e.target.value)}
                    placeholder="Search cruise lines..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-gray-400"
                  />
                </div>
                {/* Scrollable List */}
                <div
                  className="space-y-2 max-h-64 overflow-y-auto pr-2"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#d9d9d9 #f6f3ed",
                  }}
                >
                  {cruiseLines
                    .filter((line) =>
                      line.name
                        .toLowerCase()
                        .includes(cruiseLineSearch.toLowerCase()),
                    )
                    .map((line) => (
                      <label
                        key={line.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCruiseLines.includes(
                            line.id as number,
                          )}
                          onChange={() => {
                            const lineId = line.id as number;
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
                            updateURLParams({
                              cruiseLines:
                                newSelection.length > 0 ? newSelection : null,
                              page: 1,
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                        />
                        <span className="font-geograph text-[14px] text-[#2F2F2F]">
                          {line.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Cruise Dates Filter */}
              <div>
                <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                  Cruise Dates
                </h3>
                <div className="space-y-3">
                  {[2025, 2026, 2027].map((year) => {
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
                          ].map((month, index) => {
                            const monthStr = `${year}-${String(index + 1).padStart(2, "0")}`;
                            const isSelected =
                              selectedMonths.includes(monthStr);
                            const isPast =
                              year < currentYear ||
                              (year === currentYear && index < currentMonth);

                            // Don't render past months at all
                            if (isPast) return null;

                            return (
                              <button
                                key={monthStr}
                                onClick={() => {
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
                                  updateURLParams({
                                    months:
                                      newSelection.length > 0
                                        ? newSelection
                                        : null,
                                    page: 1,
                                  });
                                }}
                                className={`px-2 py-1 rounded text-[12px] font-geograph transition-colors ${
                                  isSelected
                                    ? "bg-[#0E1B4D] text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
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

              {/* Number of Nights Filter */}
              <div>
                <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                  Number of Nights
                </h3>
                <div className="space-y-2">
                  {["2-5", "6-8", "9-11", "12+"].map((range) => (
                    <label
                      key={range}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedNightRanges.includes(range)}
                        onChange={() => {
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
                          updateURLParams({
                            nights:
                              newSelection.length > 0 ? newSelection : null,
                            page: 1,
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                      />
                      <span className="font-geograph text-[14px] text-[#2F2F2F]">
                        {range === "12+" ? "12+ nights" : `${range} nights`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Departure Port Filter */}
              <div>
                <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                  Departure Port
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={departurePortSearch}
                    onChange={(e) => setDeparturePortSearch(e.target.value)}
                    placeholder="Search ports..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-gray-400"
                  />
                </div>
                {/* Scrollable List */}
                <div
                  className="space-y-2 max-h-64 overflow-y-auto pr-2"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#d9d9d9 #f6f3ed",
                  }}
                >
                  {departurePorts
                    .filter((port) =>
                      port.name
                        .toLowerCase()
                        .includes(departurePortSearch.toLowerCase()),
                    )
                    .map((port) => (
                      <label
                        key={port.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDeparturePorts.includes(
                            port.id as number,
                          )}
                          onChange={() => {
                            const portId = port.id as number;
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
                            updateURLParams({
                              ports:
                                newSelection.length > 0 ? newSelection : null,
                              page: 1,
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                        />
                        <span className="font-geograph text-[14px] text-[#2F2F2F]">
                          {port.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Region Filter */}
              <div>
                <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                  Region
                </h3>
                {/* Search Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                    placeholder="Search regions..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-geograph text-[16px] focus:outline-none focus:border-gray-400"
                  />
                </div>
                {/* Scrollable List */}
                <div
                  className="space-y-2 max-h-64 overflow-y-auto pr-2"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#d9d9d9 #f6f3ed",
                  }}
                >
                  {regions
                    .filter((region) =>
                      region.name
                        .toLowerCase()
                        .includes(regionSearch.toLowerCase()),
                    )
                    .map((region) => (
                      <label
                        key={region.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(
                            region.id as number,
                          )}
                          onChange={() => {
                            const regionId = region.id as number;
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
                            const newSelection = currentRegions.includes(
                              regionId,
                            )
                              ? currentRegions.filter((id) => id !== regionId)
                              : [...currentRegions, regionId];
                            updateURLParams({
                              regions:
                                newSelection.length > 0 ? newSelection : null,
                              page: 1,
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                        />
                        <span className="font-geograph text-[14px] text-[#2F2F2F]">
                          {region.name}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Clear All Filters Button */}
              {appliedFilters.length > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="w-full py-2 px-4 bg-[#0E1B4D] text-white font-geograph font-medium text-[14px] rounded-lg hover:bg-[#0E1B4D]/90 transition-colors"
                >
                  Clear All Filters
                </button>
              )}

              {/* Create Price Alert Button */}
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedCruiseLines.length > 0) {
                    params.set("cruiseLine", selectedCruiseLines.join(","));
                  }
                  if (selectedMonths.length > 0) {
                    params.set("months", selectedMonths.join(","));
                  }
                  const queryString = params.toString();
                  router.push(
                    `/alerts/new${queryString ? `?${queryString}` : ""}`,
                  );
                }}
                className="w-full py-2 px-4 bg-white border-2 border-[#0E1B4D] text-[#0E1B4D] font-geograph font-medium text-[14px] rounded-lg hover:bg-[#0E1B4D] hover:text-white transition-colors"
              >
                🔔 Create Price Alert
              </button>
            </div>
          </aside>

          {/* Main Content - Cruise Cards */}
          <div className="flex-1">
            {/* Mobile Filters Button - Fixed at Bottom */}
            <div className="md:hidden fixed bottom-[10px] left-0 right-0 px-4 z-40">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="w-full px-6 py-3 bg-white border border-gray-300 rounded-full font-geograph font-medium text-[16px] text-dark-blue hover:border-gray-400 transition-colors shadow-lg"
              >
                Filters{" "}
                {appliedFilters.length > 0 && `(${appliedFilters.length})`}
              </button>
            </div>

            {/* Applied Filters and Sort */}
            <div className="mb-6 flex justify-between items-center gap-4">
              {/* Applied Filters - Hidden on Mobile */}
              <div className="hidden md:flex items-center gap-2 flex-wrap flex-1">
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
              </div>

              {/* Sort Dropdown */}
              <div className="flex-shrink-0">
                <div className="relative inline-block" ref={sortDropdownRef}>
                  <button
                    onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full bg-white hover:border-gray-400 transition-colors"
                  >
                    <span className="font-geograph font-medium text-[16px] text-dark-blue">
                      Sort:{" "}
                      {sortBy === "soonest"
                        ? "Soonest"
                        : sortBy === "lowest_price"
                          ? "Lowest price"
                          : sortBy === "highest_price"
                            ? "Highest price"
                            : sortBy === "shortest"
                              ? "Shortest"
                              : "Longest"}
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

            {/* Cruise Cards */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-xl text-gray-600">Loading cruises...</div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-xl text-gray-600">
                  There was a problem fetching cruises, try reloading the page
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
                  const lowestPrice = getLowestPrice(cruise);
                  const cruiseLineLogo = cruise.cruiseLine?.name
                    ? getCruiseLineLogo(cruise.cruiseLine.name)
                    : "";

                  return (
                    <div
                      key={cruise.id}
                      onClick={() => router.push(`/cruise/${slug}`)}
                      className="bg-white rounded-lg overflow-hidden cursor-pointer border border-[#d9d9d9]"
                    >
                      {/* Mobile Layout */}
                      <div className="md:hidden">
                        {/* Ship Image - Full Width on Mobile */}
                        <div className="w-full h-48 bg-gray-200 relative">
                          {cruise.ship?.defaultShipImageHd ||
                          cruise.ship?.defaultShipImage2k ||
                          cruise.ship?.defaultShipImage ||
                          cruise.shipImageHd ||
                          cruise.shipImage2k ||
                          cruise.shipImage ||
                          cruise.featuredImageUrl ? (
                            <Image
                              src={
                                cruise.ship?.defaultShipImageHd ||
                                cruise.ship?.defaultShipImage2k ||
                                cruise.ship?.defaultShipImage ||
                                cruise.shipImageHd ||
                                cruise.shipImage2k ||
                                cruise.shipImage ||
                                cruise.featuredImageUrl ||
                                ""
                              }
                              alt={
                                cruise.ship?.name ||
                                cruise.name ||
                                "Cruise ship"
                              }
                              fill
                              sizes="100vw"
                              className="object-cover"
                              loading="lazy"
                              unoptimized
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "/images/image-missing.png";
                              }}
                            />
                          ) : (
                            <Image
                              src="/images/image-missing.png"
                              alt="No image available"
                              fill
                              sizes="100vw"
                              className="object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          {/* Cruise Name */}
                          <h3
                            className="font-geograph text-[16px] font-medium text-[#2F2F2F] mb-2"
                            style={{
                              letterSpacing: "-0.02em",
                              lineHeight: "1.3",
                            }}
                          >
                            {cruise.name}
                          </h3>

                          {/* Cruise Line Logo */}
                          {cruiseLineLogo && (
                            <div className="mb-3 flex items-center">
                              <img
                                src={cruiseLineLogo}
                                alt={cruise.cruiseLine?.name || ""}
                                width={96}
                                height={31}
                                className="object-contain"
                                style={{ width: "96px", height: "31px" }}
                              />
                            </div>
                          )}

                          {/* Details and Price - Same Line */}
                          <div className="flex items-end gap-4">
                            {/* Details with Icons */}
                            <div className="space-y-1 flex-1">
                              {/* Ship */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/ship-small.svg"
                                  alt="Ship"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
                                  {cruise.ship?.name || "Unknown Ship"}
                                </span>
                              </div>

                              {/* Dates */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/calendar-small.svg"
                                  alt="Calendar"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
                                  {formatDateNoYear(
                                    cruise.sailingDate || cruise.departureDate,
                                  )}{" "}
                                  - {getReturnDate(cruise)}
                                </span>
                              </div>

                              {/* Departure Port */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/location-small.svg"
                                  alt="Location"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
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
                                </span>
                              </div>
                            </div>

                            {/* Price Block */}
                            <div className="text-right flex-shrink-0">
                              <div className="font-geograph font-bold text-[10px] text-[#474747] uppercase tracking-wider -mb-1">
                                PER PERSON
                              </div>
                              <div className="font-geograph font-medium text-[24px] text-[#1c1c1c]">
                                {lowestPrice !== null
                                  ? formatPrice(lowestPrice / 2)
                                  : "Call for price"}
                              </div>
                              {lowestPrice && (
                                <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[5px] inline-block">
                                  +${Math.floor((lowestPrice * 0.2) / 10) * 10}{" "}
                                  onboard credit
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout */}
                      <div className="hidden md:flex p-4 gap-4">
                        {/* Ship Thumbnail - Square */}
                        <div className="w-40 h-40 md:w-52 md:h-52 lg:w-56 lg:h-56 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {cruise.ship?.defaultShipImageHd ||
                          cruise.ship?.defaultShipImage2k ||
                          cruise.ship?.defaultShipImage ||
                          cruise.shipImageHd ||
                          cruise.shipImage2k ||
                          cruise.shipImage ||
                          cruise.featuredImageUrl ? (
                            <Image
                              src={
                                cruise.ship?.defaultShipImageHd ||
                                cruise.ship?.defaultShipImage2k ||
                                cruise.ship?.defaultShipImage ||
                                cruise.shipImageHd ||
                                cruise.shipImage2k ||
                                cruise.shipImage ||
                                cruise.featuredImageUrl ||
                                ""
                              }
                              alt={
                                cruise.ship?.name ||
                                cruise.name ||
                                "Cruise ship"
                              }
                              fill
                              sizes="(max-width: 768px) 160px, (max-width: 1024px) 416px, 448px"
                              className="object-cover"
                              loading="lazy"
                              quality={90}
                              unoptimized
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "/images/image-missing.png";
                              }}
                            />
                          ) : (
                            <Image
                              src="/images/image-missing.png"
                              alt="No image available"
                              fill
                              sizes="(max-width: 768px) 160px, (max-width: 1024px) 416px, 448px"
                              className="object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col justify-between">
                          {/* Top Section */}
                          <div>
                            {/* Cruise Name */}
                            <h3
                              className="font-geograph text-[22px] font-medium text-[#2F2F2F] mb-2"
                              style={{ letterSpacing: "-0.02em" }}
                            >
                              {cruise.name}
                            </h3>

                            {/* Cruise Line Logo */}
                            {cruiseLineLogo && (
                              <div className="mb-3 flex items-center">
                                <img
                                  src={cruiseLineLogo}
                                  alt={cruise.cruiseLine?.name || ""}
                                  width={96}
                                  height={31}
                                  className="object-contain"
                                  style={{ width: "96px", height: "31px" }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Bottom Section - Details and Price */}
                          <div className="flex items-end gap-4">
                            {/* Details with Icons */}
                            <div className="space-y-1 flex-1">
                              {/* Ship */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/ship-small.svg"
                                  alt="Ship"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
                                  {cruise.ship?.name || "Unknown Ship"}
                                </span>
                              </div>

                              {/* Dates */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/calendar-small.svg"
                                  alt="Calendar"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
                                  {formatDateNoYear(
                                    cruise.sailingDate || cruise.departureDate,
                                  )}{" "}
                                  - {getReturnDate(cruise)}
                                </span>
                              </div>

                              {/* Departure Port */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/location-small.svg"
                                  alt="Location"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
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
                                </span>
                              </div>

                              {/* Nights */}
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/nights-small.svg"
                                  alt="Nights"
                                  width={14}
                                  height={14}
                                  className="flex-shrink-0"
                                />
                                <span className="font-geograph text-[14px] text-[#606060]">
                                  {cruise.nights} nights
                                </span>
                              </div>
                            </div>

                            {/* Price Block - Push to right */}
                            <div className="text-right flex-shrink-0 ml-auto">
                              <div className="font-geograph font-bold text-[10px] text-[#474747] uppercase tracking-wider -mb-1">
                                PER PERSON
                              </div>
                              <div className="font-geograph font-medium text-[24px] text-[#1c1c1c]">
                                {lowestPrice !== null
                                  ? formatPrice(lowestPrice / 2)
                                  : "Call for price"}
                              </div>
                              {lowestPrice && (
                                <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[5px] mt-2 inline-block">
                                  +${Math.floor((lowestPrice * 0.2) / 10) * 10}{" "}
                                  onboard credit
                                </div>
                              )}
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
            {!loading && !error && cruises.length > 0 && totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() =>
                    updateURLParams({ page: Math.max(1, page - 1) })
                  }
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] text-[#0E1B4D] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>

                <span className="font-geograph text-[14px] text-[#606060]">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() =>
                    updateURLParams({ page: Math.min(totalPages, page + 1) })
                  }
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-geograph text-[14px] text-[#0E1B4D] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden">
          <div className="absolute inset-0 flex flex-col">
            {/* Modal Header */}
            <div className="bg-white px-4 py-4 flex items-center justify-between border-b">
              <h2 className="font-geograph font-bold text-[20px] text-[#0E1B4D]">
                Filters
              </h2>
              <button onClick={() => setIsFilterModalOpen(false)}>
                <Image
                  src="/images/close-white.svg"
                  alt="Close"
                  width={24}
                  height={24}
                  className="invert"
                />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 bg-white overflow-y-auto px-4 py-4">
              {/* Applied Filters */}
              {appliedFilters.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                    Active Filters ({appliedFilters.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                  {appliedFilters.length > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="mt-3 text-[#0E1B4D] font-geograph font-medium text-[14px] underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}

              {/* All Filter Options */}
              <div className="space-y-6">
                {/* Cruise Lines Filter */}
                <div>
                  <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                    Cruise Lines
                  </h3>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={cruiseLineSearch}
                      onChange={(e) => setCruiseLineSearch(e.target.value)}
                      placeholder="Search cruise lines..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-geograph text-[18px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <div
                    className="space-y-3 max-h-64 overflow-y-auto pr-2"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#d9d9d9 #f6f3ed",
                    }}
                  >
                    {cruiseLines
                      .filter((line) =>
                        line.name
                          .toLowerCase()
                          .includes(cruiseLineSearch.toLowerCase()),
                      )
                      .map((line) => (
                        <label
                          key={line.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCruiseLines.includes(
                              line.id as number,
                            )}
                            onChange={() => {
                              const lineId = line.id as number;
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
                              updateURLParams({
                                cruiseLines:
                                  newSelection.length > 0 ? newSelection : null,
                                page: 1,
                              });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                          />
                          <span className="font-geograph text-[18px] text-[#2F2F2F]">
                            {line.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>

                {/* Cruise Dates Filter */}
                <div>
                  <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                    Cruise Dates
                  </h3>
                  <div className="space-y-3">
                    {[2025, 2026, 2027].map((year) => {
                      const currentDate = new Date();
                      const currentYear = currentDate.getFullYear();
                      const currentMonth = currentDate.getMonth();
                      return (
                        <div key={year}>
                          <div className="font-geograph font-bold text-[16px] text-gray-600 mb-2">
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
                                (year === currentYear && index < currentMonth);

                              // Don't render past months at all
                              if (isPast) return null;

                              return (
                                <button
                                  key={monthStr}
                                  onClick={() => {
                                    const urlParams = new URLSearchParams(
                                      window.location.search,
                                    );
                                    const currentParam =
                                      urlParams.get("months");
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
                                    updateURLParams({
                                      months:
                                        newSelection.length > 0
                                          ? newSelection
                                          : null,
                                      page: 1,
                                    });
                                  }}
                                  className={`px-2 py-1 rounded text-[16px] font-geograph transition-colors ${
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
                </div>

                {/* Number of Nights Filter */}
                <div>
                  <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                    Number of Nights
                  </h3>
                  <div className="space-y-2">
                    {["2-5", "6-8", "9-11", "12+"].map((range) => (
                      <label
                        key={range}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNightRanges.includes(range)}
                          onChange={() => {
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
                            updateURLParams({
                              nights:
                                newSelection.length > 0 ? newSelection : null,
                              page: 1,
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                        />
                        <span className="font-geograph text-[18px] text-[#2F2F2F]">
                          {range === "12+" ? "12+ nights" : `${range} nights`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Departure Port Filter */}
                <div>
                  <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                    Departure Port
                  </h3>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={departurePortSearch}
                      onChange={(e) => setDeparturePortSearch(e.target.value)}
                      placeholder="Search ports..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-geograph text-[18px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <div
                    className="space-y-3 max-h-64 overflow-y-auto pr-2"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#d9d9d9 #f6f3ed",
                    }}
                  >
                    {departurePorts
                      .filter((port) =>
                        port.name
                          .toLowerCase()
                          .includes(departurePortSearch.toLowerCase()),
                      )
                      .map((port) => (
                        <label
                          key={port.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDeparturePorts.includes(
                              port.id as number,
                            )}
                            onChange={() => {
                              const portId = port.id as number;
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
                              updateURLParams({
                                ports:
                                  newSelection.length > 0 ? newSelection : null,
                                page: 1,
                              });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                          />
                          <span className="font-geograph text-[18px] text-[#2F2F2F]">
                            {port.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>

                {/* Region Filter */}
                <div>
                  <h3 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-3">
                    Region
                  </h3>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      placeholder="Search regions..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-geograph text-[18px] focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <div
                    className="space-y-3 max-h-64 overflow-y-auto pr-2"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#d9d9d9 #f6f3ed",
                    }}
                  >
                    {regions
                      .filter((region) =>
                        region.name
                          .toLowerCase()
                          .includes(regionSearch.toLowerCase()),
                      )
                      .map((region) => (
                        <label
                          key={region.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRegions.includes(
                              region.id as number,
                            )}
                            onChange={() => {
                              const regionId = region.id as number;
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
                              const newSelection = currentRegions.includes(
                                regionId,
                              )
                                ? currentRegions.filter((id) => id !== regionId)
                                : [...currentRegions, regionId];
                              updateURLParams({
                                regions:
                                  newSelection.length > 0 ? newSelection : null,
                                page: 1,
                              });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#0E1B4D] focus:ring-[#0E1B4D]"
                          />
                          <span className="font-geograph text-[18px] text-[#2F2F2F]">
                            {region.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-4 py-4 border-t">
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="w-full px-6 py-3 bg-[#0E1B4D] text-white font-geograph font-medium text-[16px] rounded-full hover:bg-[#0E1B4D]/90 transition-colors"
              >
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
