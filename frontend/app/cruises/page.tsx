"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, ChevronDown, Calendar, DollarSign, Moon, Ship, MapPin, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
  sailingDate: { from?: string; to?: string };
  embarkPort: string[];
  sort: "price" | "date" | "nights" | "recommended";
  sortDirection: "asc" | "desc";
}

export default function CruisesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Available filter options
  const [availableCruiseLines, setAvailableCruiseLines] = useState<Array<{id: string, name: string}>>([]);
  const [availablePorts, setAvailablePorts] = useState<Array<{id: string, name: string}>>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    cruiseLine: [],
    nights: {},
    price: {},
    sailingDate: {},
    embarkPort: [],
    sort: "recommended",
    sortDirection: "asc"
  });

  // Fetch filter options
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch cruises when filters change
  useEffect(() => {
    fetchCruises();
  }, [filters, page]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/search/filters`);
      if (response.ok) {
        const data = await response.json();
        setAvailableCruiseLines(data.cruiseLines || []);
        setAvailablePorts(data.ports || []);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchCruises = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "20");

      if (filters.cruiseLine.length > 0) {
        params.append("cruiseLines", filters.cruiseLine.join(","));
      }
      if (filters.nights.min) params.append("minNights", filters.nights.min.toString());
      if (filters.nights.max) params.append("maxNights", filters.nights.max.toString());
      if (filters.price.min) params.append("minPrice", filters.price.min.toString());
      if (filters.price.max) params.append("maxPrice", filters.price.max.toString());
      if (filters.sailingDate.from) params.append("dateFrom", filters.sailingDate.from);
      if (filters.sailingDate.to) params.append("dateTo", filters.sailingDate.to);
      if (filters.embarkPort.length > 0) {
        params.append("embarkPorts", filters.embarkPort.join(","));
      }
      params.append("sortBy", filters.sort);
      params.append("sortOrder", filters.sortDirection);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/search-optimized/cruises?${params.toString()}`
      );

      if (!response.ok) throw new Error("Failed to fetch cruises");

      const data = await response.json();
      setCruises(data.cruises || []);
      setTotalCount(data.total || 0);
    } catch (error) {
      console.error("Error fetching cruises:", error);
      setCruises([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatPrice = (price?: number) => {
    if (!price) return "Call for Price";
    return `$${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">All Cruises</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 lg:hidden"
            >
              <Filter className="h-5 w-5" />
              Filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-64 flex-shrink-0`}>
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={`${filters.sort}-${filters.sortDirection}`}
                  onChange={(e) => {
                    const [sort, direction] = e.target.value.split("-") as [FilterState["sort"], "asc" | "desc"];
                    handleFilterChange("sort", sort);
                    handleFilterChange("sortDirection", direction);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="recommended-asc">Recommended</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="date-asc">Date: Soonest First</option>
                  <option value="date-desc">Date: Latest First</option>
                  <option value="nights-asc">Duration: Shortest First</option>
                  <option value="nights-desc">Duration: Longest First</option>
                </select>
              </div>

              {/* Nights Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Nights</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    min="1"
                    max="30"
                    value={filters.nights.min || ""}
                    onChange={(e) => handleFilterChange("nights", { ...filters.nights, min: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    min="1"
                    max="30"
                    value={filters.nights.max || ""}
                    onChange={(e) => handleFilterChange("nights", { ...filters.nights, max: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    min="0"
                    step="100"
                    value={filters.price.min || ""}
                    onChange={(e) => handleFilterChange("price", { ...filters.price, min: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    min="0"
                    step="100"
                    value={filters.price.max || ""}
                    onChange={(e) => handleFilterChange("price", { ...filters.price, max: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Sailing Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sailing Date</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.sailingDate.from || ""}
                    onChange={(e) => handleFilterChange("sailingDate", { ...filters.sailingDate, from: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={filters.sailingDate.to || ""}
                    onChange={(e) => handleFilterChange("sailingDate", { ...filters.sailingDate, to: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Cruise Lines */}
              {availableCruiseLines.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cruise Line</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableCruiseLines.map((line) => (
                      <label key={line.id} className="flex items-center">
                        <input
                          type="checkbox"
                          value={line.id}
                          checked={filters.cruiseLine.includes(line.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleFilterChange("cruiseLine", [...filters.cruiseLine, line.id]);
                            } else {
                              handleFilterChange("cruiseLine", filters.cruiseLine.filter(id => id !== line.id));
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{line.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              <button
                onClick={() => {
                  setFilters({
                    cruiseLine: [],
                    nights: {},
                    price: {},
                    sailingDate: {},
                    embarkPort: [],
                    sort: "recommended",
                    sortDirection: "asc"
                  });
                  setPage(1);
                }}
                className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-gray-700">
                {loading ? "Loading..." : `${totalCount} cruises found`}
              </p>
            </div>

            {loading ? (
              <div className="grid gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                    <div className="h-32 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : cruises.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">No cruises found matching your criteria.</p>
                <button
                  onClick={() => {
                    setFilters({
                      cruiseLine: [],
                      nights: {},
                      price: {},
                      sailingDate: {},
                      embarkPort: [],
                      sort: "recommended",
                      sortDirection: "asc"
                    });
                    setPage(1);
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {cruises.map((cruise) => (
                  <Link
                    key={cruise.id}
                    href={`/cruise/${cruise.slug || cruise.id}`}
                    className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                  >
                    <div className="p-4 flex gap-4">
                      {/* Cruise Image */}
                      <div className="w-48 h-32 bg-gray-200 rounded-lg flex-shrink-0 relative overflow-hidden">
                        {cruise.imageUrl ? (
                          <Image
                            src={cruise.imageUrl}
                            alt={cruise.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Ship className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Cruise Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {cruise.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {cruise.cruiseLineName} • {cruise.shipName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">From</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {formatPrice(cruise.cheapestPrice || cruise.interiorPrice)}
                            </p>
                            <p className="text-xs text-gray-500">per person</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(cruise.sailingDate)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Moon className="h-4 w-4" />
                            {cruise.nights} Nights
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {cruise.embarkPortName} → {cruise.disembarkPortName}
                          </div>
                        </div>

                        {/* Cabin Prices */}
                        <div className="mt-3 flex gap-4 text-xs">
                          {cruise.interiorPrice && (
                            <div>
                              <span className="text-gray-500">Interior: </span>
                              <span className="font-semibold">{formatPrice(cruise.interiorPrice)}</span>
                            </div>
                          )}
                          {cruise.oceanviewPrice && (
                            <div>
                              <span className="text-gray-500">Ocean View: </span>
                              <span className="font-semibold">{formatPrice(cruise.oceanviewPrice)}</span>
                            </div>
                          )}
                          {cruise.balconyPrice && (
                            <div>
                              <span className="text-gray-500">Balcony: </span>
                              <span className="font-semibold">{formatPrice(cruise.balconyPrice)}</span>
                            </div>
                          )}
                          {cruise.suitePrice && (
                            <div>
                              <span className="text-gray-500">Suite: </span>
                              <span className="font-semibold">{formatPrice(cruise.suitePrice)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalCount > 20 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Page {page} of {Math.ceil(totalCount / 20)}
                </span>
                <button
                  onClick={() => setPage(Math.min(Math.ceil(totalCount / 20), page + 1))}
                  disabled={page >= Math.ceil(totalCount / 20)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
