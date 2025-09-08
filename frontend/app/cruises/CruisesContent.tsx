"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  ChevronDown,
  Calendar,
  DollarSign,
  Moon,
  Ship,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAdmin } from "../hooks/useAdmin";
import { useUser } from "../hooks/useClerkHooks";

interface Cruise {
  id: string;
  name: string;
  shipName: string;
  cruiseLineName: string;
  cruiseLineLogo?: string;
  nights: number;
  sailingDate: string;
  embarkPortName: string;
  disembarkPortName: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  cheapestPrice?: number;
  slug?: string;
  imageUrl?: string;
}

interface FilterState {
  cruiseLine: string[];
  nights: { min?: number; max?: number };
  price: { min?: number; max?: number };
  sailingDate: { start?: string; end?: string };
  embarkPort: string[];
  sort: "price" | "date" | "nights" | "recommended";
  sortDirection: "asc" | "desc";
}

export default function CruisesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isLoaded } = useUser();
  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Available filter options
  const [availableCruiseLines, setAvailableCruiseLines] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [availablePorts, setAvailablePorts] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Check admin access
  useEffect(() => {
    if (isLoaded && !adminLoading && !isAdmin) {
      router.push("/");
    }
  }, [isLoaded, adminLoading, isAdmin, router]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    cruiseLine: [],
    nights: {},
    price: {},
    sailingDate: {},
    embarkPort: [],
    sort: "price",
    sortDirection: "asc",
  });

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [cruiseLinesRes, portsRes] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/search/filters/cruise-lines`,
          ),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/search/filters/ports`),
        ]);

        if (cruiseLinesRes.ok) {
          const data = await cruiseLinesRes.json();
          setAvailableCruiseLines(data.cruiseLines || []);
        }

        if (portsRes.ok) {
          const data = await portsRes.json();
          setAvailablePorts(data.ports || []);
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };

    fetchFilterOptions();
  }, []);

  // Parse URL params on mount
  useEffect(() => {
    const cruiseLineParam = searchParams.get("cruiseLine");
    const nightsMin = searchParams.get("nightsMin");
    const nightsMax = searchParams.get("nightsMax");
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    const sailingStart = searchParams.get("sailingStart");
    const sailingEnd = searchParams.get("sailingEnd");
    const embarkPort = searchParams.get("embarkPort");
    const sort = searchParams.get("sort");
    const sortDirection = searchParams.get("sortDirection");

    setFilters((prev) => ({
      ...prev,
      cruiseLine: cruiseLineParam ? cruiseLineParam.split(",") : [],
      nights: {
        ...(nightsMin && { min: parseInt(nightsMin) }),
        ...(nightsMax && { max: parseInt(nightsMax) }),
      },
      price: {
        ...(priceMin && { min: parseInt(priceMin) }),
        ...(priceMax && { max: parseInt(priceMax) }),
      },
      sailingDate: {
        ...(sailingStart && { start: sailingStart }),
        ...(sailingEnd && { end: sailingEnd }),
      },
      embarkPort: embarkPort ? embarkPort.split(",") : [],
      sort: (sort as FilterState["sort"]) || "price",
      sortDirection: (sortDirection as FilterState["sortDirection"]) || "asc",
    }));
  }, [searchParams]);

  const fetchCruises = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "20");

      if (filters.cruiseLine.length > 0) {
        params.append("cruiseLine", filters.cruiseLine.join(","));
      }
      if (filters.nights.min)
        params.append("nightsMin", filters.nights.min.toString());
      if (filters.nights.max)
        params.append("nightsMax", filters.nights.max.toString());
      if (filters.price.min)
        params.append("priceMin", filters.price.min.toString());
      if (filters.price.max)
        params.append("priceMax", filters.price.max.toString());
      if (filters.sailingDate.start)
        params.append("sailingStart", filters.sailingDate.start);
      if (filters.sailingDate.end)
        params.append("sailingEnd", filters.sailingDate.end);
      if (filters.embarkPort.length > 0) {
        params.append("embarkPort", filters.embarkPort.join(","));
      }
      params.append("sort", filters.sort);
      params.append("sortDirection", filters.sortDirection);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/search/cruises?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch cruises");
      }

      const data = await response.json();
      setCruises(data.cruises || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error("Error fetching cruises:", error);
      setCruises([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchCruises();
  }, [fetchCruises]);

  const updateFilters = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);

    // Update URL
    const params = new URLSearchParams();
    const merged = { ...filters, ...newFilters };

    if (merged.cruiseLine.length > 0)
      params.set("cruiseLine", merged.cruiseLine.join(","));
    if (merged.nights.min)
      params.set("nightsMin", merged.nights.min.toString());
    if (merged.nights.max)
      params.set("nightsMax", merged.nights.max.toString());
    if (merged.price.min) params.set("priceMin", merged.price.min.toString());
    if (merged.price.max) params.set("priceMax", merged.price.max.toString());
    if (merged.sailingDate.start)
      params.set("sailingStart", merged.sailingDate.start);
    if (merged.sailingDate.end)
      params.set("sailingEnd", merged.sailingDate.end);
    if (merged.embarkPort.length > 0)
      params.set("embarkPort", merged.embarkPort.join(","));
    if (merged.sort !== "recommended") params.set("sort", merged.sort);
    if (merged.sortDirection !== "asc")
      params.set("sortDirection", merged.sortDirection);

    router.push(`/cruises?${params.toString()}`);
  };

  const toggleCruiseLine = (cruiseLineId: string) => {
    const newCruiseLines = filters.cruiseLine.includes(cruiseLineId)
      ? filters.cruiseLine.filter((id) => id !== cruiseLineId)
      : [...filters.cruiseLine, cruiseLineId];
    updateFilters({ cruiseLine: newCruiseLines });
  };

  const togglePort = (portId: string) => {
    const newPorts = filters.embarkPort.includes(portId)
      ? filters.embarkPort.filter((id) => id !== portId)
      : [...filters.embarkPort, portId];
    updateFilters({ embarkPort: newPorts });
  };

  const getCheapestPrice = (cruise: Cruise) => {
    const prices = [
      cruise.interiorPrice,
      cruise.oceanviewPrice,
      cruise.balconyPrice,
      cruise.suitePrice,
    ].filter((p): p is number => p !== undefined && p !== null && p > 0);

    return prices.length > 0 ? Math.min(...prices) : cruise.cheapestPrice;
  };

  // Show loading while checking admin status
  if (!isLoaded || adminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render content if not admin (redirect will happen)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Browse Cruises</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {totalCount} cruises found
              </span>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <aside
            className={`${
              showFilters ? "block" : "hidden"
            } md:block w-full md:w-64 lg:w-80`}
          >
            <div className="bg-white rounded-lg shadow p-6 sticky top-20">
              <h2 className="font-semibold text-lg mb-4">Filters</h2>

              {/* Sort */}
              <div className="mb-6">
                <h3 className="font-medium mb-2">Sort By</h3>
                <select
                  value={`${filters.sort}-${filters.sortDirection}`}
                  onChange={(e) => {
                    const [sort, direction] = e.target.value.split("-");
                    updateFilters({
                      sort: sort as FilterState["sort"],
                      sortDirection: direction as FilterState["sortDirection"],
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="date-asc">Date: Soonest First</option>
                  <option value="date-desc">Date: Latest First</option>
                  <option value="nights-asc">Duration: Shortest First</option>
                  <option value="nights-desc">Duration: Longest First</option>
                </select>
              </div>

              {/* Cruise Lines - Only show if we have data */}
              {availableCruiseLines.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Cruise Lines</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableCruiseLines.map((line) => (
                      <label key={line.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.cruiseLine.includes(line.id)}
                          onChange={() => toggleCruiseLine(line.id)}
                          className="mr-2"
                        />
                        <span className="text-sm">{line.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Nights Range */}
              <div className="mb-6">
                <h3 className="font-medium mb-2">Number of Nights</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.nights.min || ""}
                    onChange={(e) =>
                      updateFilters({
                        nights: {
                          ...filters.nights,
                          min: parseInt(e.target.value) || undefined,
                        },
                      })
                    }
                    className="w-1/2 px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.nights.max || ""}
                    onChange={(e) =>
                      updateFilters({
                        nights: {
                          ...filters.nights,
                          max: parseInt(e.target.value) || undefined,
                        },
                      })
                    }
                    className="w-1/2 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h3 className="font-medium mb-2">Price Range</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min $"
                    value={filters.price.min || ""}
                    onChange={(e) =>
                      updateFilters({
                        price: {
                          ...filters.price,
                          min: parseInt(e.target.value) || undefined,
                        },
                      })
                    }
                    className="w-1/2 px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Max $"
                    value={filters.price.max || ""}
                    onChange={(e) =>
                      updateFilters({
                        price: {
                          ...filters.price,
                          max: parseInt(e.target.value) || undefined,
                        },
                      })
                    }
                    className="w-1/2 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Sailing Dates */}
              <div className="mb-6">
                <h3 className="font-medium mb-2">Sailing Dates</h3>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.sailingDate.start || ""}
                    onChange={(e) =>
                      updateFilters({
                        sailingDate: {
                          ...filters.sailingDate,
                          start: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="date"
                    value={filters.sailingDate.end || ""}
                    onChange={(e) =>
                      updateFilters({
                        sailingDate: {
                          ...filters.sailingDate,
                          end: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Embark Ports - Only show if we have data */}
              {availablePorts.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Departure Port</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availablePorts.map((port) => (
                      <label key={port.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.embarkPort.includes(port.id)}
                          onChange={() => togglePort(port.id)}
                          className="mr-2"
                        />
                        <span className="text-sm">{port.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              <button
                onClick={() => {
                  updateFilters({
                    cruiseLine: [],
                    nights: {},
                    price: {},
                    sailingDate: {},
                    embarkPort: [],
                    sort: "price",
                    sortDirection: "asc",
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear All Filters
              </button>
            </div>
          </aside>

          {/* Cruise Results */}
          <main className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg shadow overflow-hidden animate-pulse"
                  >
                    <div className="h-48 bg-gray-200" />
                    <div className="p-4">
                      <div className="h-4 bg-gray-200 rounded mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : cruises.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">
                  No cruises found matching your criteria. Try adjusting your
                  filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cruises.map((cruise) => (
                  <Link
                    key={cruise.id}
                    href={`/cruise/${cruise.slug || cruise.id}`}
                    className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="relative h-48">
                      {cruise.imageUrl ? (
                        <Image
                          src={cruise.imageUrl}
                          alt={cruise.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <Ship className="h-16 w-16 text-white opacity-50" />
                        </div>
                      )}
                      {cruise.cruiseLineLogo && (
                        <div className="absolute top-2 left-2 bg-white rounded px-2 py-1">
                          <Image
                            src={cruise.cruiseLineLogo}
                            alt={cruise.cruiseLineName}
                            width={60}
                            height={20}
                            className="object-contain"
                          />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {cruise.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {cruise.shipName} • {cruise.cruiseLineName}
                      </p>

                      <div className="space-y-1 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(cruise.sailingDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          <span>{cruise.nights} nights</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {cruise.embarkPortName} → {cruise.disembarkPortName}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-gray-500">From</p>
                            <p className="text-2xl font-bold text-blue-600">
                              $
                              {getCheapestPrice(cruise)?.toLocaleString() ||
                                "N/A"}
                            </p>
                            <p className="text-xs text-gray-500">per person</p>
                          </div>
                          <span className="text-sm text-blue-600 hover:text-blue-700">
                            View Details →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalCount > 20 && (
              <div className="mt-8 flex justify-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">
                    Page {page} of {Math.ceil(totalCount / 20)}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(totalCount / 20)}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
