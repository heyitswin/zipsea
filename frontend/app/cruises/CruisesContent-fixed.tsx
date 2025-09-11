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

  // Filter states - support multi-select
  const [selectedCruiseLines, setSelectedCruiseLines] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // Format: "YYYY-MM"
  const [selectedNightRanges, setSelectedNightRanges] = useState<string[]>([]); // "2-5", "6-8", "9-11", "12+"
  const [selectedDeparturePorts, setSelectedDeparturePorts] = useState<number[]>([]);
  const [selectedShips, setSelectedShips] = useState<number[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<number[]>([]);

  // Filter dropdown states
  const [isCruiseLineDropdownOpen, setIsCruiseLineDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isNightsDropdownOpen, setIsNightsDropdownOpen] = useState(false);
  const [isDeparturePortDropdownOpen, setIsDeparturePortDropdownOpen] = useState(false);
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
          `${process.env.NEXT_PUBLIC_API_URL}/filter-options`,
          { signal: controller.signal }
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

      // Add filters - support multiple selections
      selectedCruiseLines.forEach((id) =>
        params.append("cruiseLineId", id.toString())
      );
      selectedDeparturePorts.forEach((id) =>
        params.append("departurePortId", id.toString())
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
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout

      const url = `${process.env.NEXT_PUBLIC_API_URL}/search/comprehensive?${params.toString()}`;
      console.log("Fetching cruises from:", url);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        // Filter out cruises without any valid prices and cruises departing within 1 week
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

        const filteredCruises = (data.results || data.cruises || []).filter(
          (cruise: Cruise) => {
            // Filter out cruises departing within 1 week from today
            const sailingDate = new Date(cruise.sailingDate);
            if (sailingDate < oneWeekFromNow) {
              return false;
            }

            // Collect all valid prices to check minimum
            const allPrices: number[] = [];

            // Check pricing object
            if (cruise.pricing) {
              Object.values(cruise.pricing).forEach((price: any) => {
                const num = Number(price);
                if (!isNaN(num) && num > 0) {
                  allPrices.push(num);
                }
              });
            }

            // Check combined object
            if (cruise.combined) {
              Object.values(cruise.combined).forEach((price: any) => {
                const num = Number(price);
                if (!isNaN(num) && num > 0) {
                  allPrices.push(num);
                }
              });
            }

            // Check individual price fields
            const priceFields = [
              "interiorPrice",
              "oceanviewPrice",
              "oceanViewPrice",
              "balconyPrice",
              "suitePrice",
              "cheapestPrice",
            ];

            priceFields.forEach((field) => {
              const price = (cruise as any)[field];
              if (price) {
                const num = Number(price);
                if (!isNaN(num) && num > 0) {
                  allPrices.push(num);
                }
              }
            });

            // If no prices found, filter out
            if (allPrices.length === 0) {
              return false;
            }

            // Check if lowest price is above $99
            const lowestPrice = Math.min(...allPrices);
            return lowestPrice > 99;
          }
        );

        setCruises(filteredCruises);
        setTotalCount(data.totalCount || data.total || filteredCruises.length);
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching cruises:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sortBy,
    selectedCruiseLines,
    selectedMonths,
    selectedNightRanges,
    selectedDeparturePorts,
    selectedShips,
    selectedRegions,
  ]);

  // Fetch cruises when filters or page changes (including initial load)
  useEffect(() => {
    fetchCruises();
  }, [fetchCruises]);

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
        parseInt(monthNum) - 1
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
    switch (filter.type) {
      case "cruiseLine":
        setSelectedCruiseLines((prev) =>
          prev.filter((id) => id !== filter.value)
        );
        break;
      case "month":
        setSelectedMonths((prev) =>
          prev.filter((month) => month !== filter.value)
        );
        break;
      case "nights":
        setSelectedNightRanges((prev) =>
          prev.filter((range) => range !== filter.value)
        );
        break;
      case "departurePort":
        setSelectedDeparturePorts((prev) =>
          prev.filter((id) => id !== filter.value)
        );
        break;
      case "ship":
        setSelectedShips((prev) =>
          prev.filter((id) => id !== filter.value)
        );
        break;
      case "region":
        setSelectedRegions((prev) =>
          prev.filter((id) => id !== filter.value)
        );
        break;
    }
    setPage(1); // Reset to first page when removing a filter
  };

  const clearAllFilters = () => {
    setSelectedCruiseLines([]);
    setSelectedMonths([]);
    setSelectedNightRanges([]);
    setSelectedDeparturePorts([]);
    setSelectedShips([]);
    setSelectedRegions([]);
    setPage(1);
  };

  // Continue with the rest of the component (render part)...
  // The rest of the file remains the same from here on
}
