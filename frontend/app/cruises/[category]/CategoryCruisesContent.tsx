"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  // State management
  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("soonest");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Track requests to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pre-set filters based on category
  const categoryFilters = useMemo(() => {
    const filters: any = {};

    if (category.filters.regionId) {
      filters.regionId = Array.isArray(category.filters.regionId)
        ? category.filters.regionId.join(",")
        : category.filters.regionId.toString();
    }

    if (category.filters.cruiseLineId) {
      filters.cruiseLineId = Array.isArray(category.filters.cruiseLineId)
        ? category.filters.cruiseLineId.join(",")
        : category.filters.cruiseLineId.toString();
    }

    if (category.filters.departurePortId) {
      filters.departurePortId = Array.isArray(category.filters.departurePortId)
        ? category.filters.departurePortId.join(",")
        : category.filters.departurePortId.toString();
    }

    if (category.filters.minNights !== undefined) {
      filters.minNights = category.filters.minNights;
    }

    if (category.filters.maxNights !== undefined) {
      filters.maxNights = category.filters.maxNights;
    }

    if (category.filters.maxPrice !== undefined) {
      filters.maxPrice = category.filters.maxPrice;
    }

    // Special handling for last-minute cruises (departing within 60 days)
    if (category.slug === "last-minute") {
      const today = new Date();
      const sixtyDaysFromNow = new Date(
        today.getTime() + 60 * 24 * 60 * 60 * 1000,
      );
      filters.endDate = sixtyDaysFromNow.toISOString().split("T")[0];
    }

    return filters;
  }, [category]);

  // Additional user filters from URL params
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>(
    {},
  );

  // Stats for display
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);

  // Initialize filters from URL on mount
  useEffect(() => {
    const monthsParam = searchParams.get("months");
    const pageParam = searchParams.get("page");
    const sortParam = searchParams.get("sort");
    const minPriceParam = searchParams.get("minPrice");
    const maxPriceParam = searchParams.get("maxPrice");

    if (monthsParam) {
      setSelectedMonths(monthsParam.split(","));
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

    const newPriceRange: { min?: number; max?: number } = {};
    if (minPriceParam) {
      const min = parseFloat(minPriceParam);
      if (!isNaN(min)) newPriceRange.min = min;
    }
    if (maxPriceParam) {
      const max = parseFloat(maxPriceParam);
      if (!isNaN(max)) newPriceRange.max = max;
    }
    if (Object.keys(newPriceRange).length > 0) {
      setPriceRange(newPriceRange);
    }
  }, [searchParams]);

  // Fetch cruises with category filters
  const fetchCruises = useCallback(async () => {
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
      Object.entries(categoryFilters).forEach(([key, value]) => {
        params.append(key, value.toString());
      });

      // Add user filters
      if (selectedMonths.length > 0) {
        params.append("departureMonth", selectedMonths.join(","));
      }

      if (priceRange.min !== undefined) {
        params.append("minPrice", priceRange.min.toString());
      }

      if (priceRange.max !== undefined && !category.filters.maxPrice) {
        // Only apply user's max price if category doesn't have one
        params.append("maxPrice", priceRange.max.toString());
      }

      params.append("page", page.toString());
      params.append("limit", "20");
      params.append("sortBy", sortBy === "soonest" ? "date" : sortBy);
      params.append("sortOrder", sortBy === "price-high" ? "desc" : "asc");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/search/comprehensive?${params.toString()}`,
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

      setCruises(data.results || []);
      setTotalCount(data.total || 0);

      // Calculate lowest price from results
      if (data.results && data.results.length > 0) {
        const prices = data.results
          .map((c: Cruise) => parseFloat(c.cheapestPrice || "0"))
          .filter((p: number) => p > 0);
        if (prices.length > 0) {
          setLowestPrice(Math.min(...prices));
        }
      }

      setLoading(false);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error fetching cruises:", err);
        setError(true);
        setLoading(false);
      }
    }
  }, [categoryFilters, selectedMonths, priceRange, page, sortBy]);

  // Fetch cruises when dependencies change
  useEffect(() => {
    fetchCruises();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchCruises]);

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

  // Update URL when filters change
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();

    if (selectedMonths.length > 0) {
      params.set("months", selectedMonths.join(","));
    }
    if (priceRange.min) {
      params.set("minPrice", priceRange.min.toString());
    }
    if (priceRange.max && !category.filters.maxPrice) {
      params.set("maxPrice", priceRange.max.toString());
    }
    if (page > 1) {
      params.set("page", page.toString());
    }
    if (sortBy !== "soonest") {
      params.set("sort", sortBy);
    }

    const queryString = params.toString();
    router.push(
      `/cruises/${category.slug}${queryString ? `?${queryString}` : ""}`,
      {
        scroll: false,
      },
    );
  }, [selectedMonths, priceRange, page, sortBy, category, router]);

  useEffect(() => {
    updateURL();
  }, [updateURL]);

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* SEO Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 to-white pt-20 pb-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumbs */}
          <nav className="text-sm mb-4">
            <ol className="flex items-center space-x-2 text-gray-600">
              <li>
                <a href="/" className="hover:text-blue-600">
                  Home
                </a>
              </li>
              <li>/</li>
              <li>
                <a href="/cruises" className="hover:text-blue-600">
                  Cruises
                </a>
              </li>
              <li>/</li>
              <li className="text-gray-900 font-medium">{category.name}</li>
            </ol>
          </nav>

          {/* Hero Content */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {category.h1}
          </h1>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
            <span className="font-medium">
              {totalCount.toLocaleString()} {category.name} cruises available
            </span>
            {lowestPrice && (
              <span className="font-medium">Starting from ${lowestPrice}</span>
            )}
          </div>

          {/* SEO Description */}
          <div className="prose prose-blue max-w-none mb-6">
            <p className="text-gray-700 leading-relaxed">
              {category.description}
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Sorting Bar */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {cruises.length} of {totalCount} results
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm">
                  Sort:{" "}
                  {sortBy === "soonest"
                    ? "Soonest"
                    : sortBy === "price"
                      ? "Price (Low to High)"
                      : "Price (High to Low)"}
                </span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                  <button
                    onClick={() => {
                      setSortBy("soonest");
                      setIsSortDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Soonest
                  </button>
                  <button
                    onClick={() => {
                      setSortBy("price");
                      setIsSortDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Price (Low to High)
                  </button>
                  <button
                    onClick={() => {
                      setSortBy("price-high");
                      setIsSortDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Price (High to Low)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">
              Failed to load cruises. Please try again.
            </p>
          </div>
        ) : cruises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              No cruises found matching your criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Cruise Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {cruises.map((cruise) => {
                const price = getPrice(cruise);
                const cruiseSlug = createSlugFromCruise({
                  id: cruise.id,
                  shipName: cruise.ship?.name || "unknown",
                  sailingDate: cruise.sailingDate,
                });

                return (
                  <div
                    key={cruise.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/cruise/${cruiseSlug}`)}
                  >
                    {/* Cruise Image */}
                    <div className="relative h-48">
                      <Image
                        src={
                          cruise.ship?.defaultShipImage2k ||
                          cruise.ship?.defaultShipImage ||
                          cruise.shipImage ||
                          "/images/cruise-placeholder.jpg"
                        }
                        alt={cruise.ship?.name || "Cruise ship"}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Cruise Details */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1">
                        {cruise.ship?.name || cruise.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {cruise.cruiseLine?.name}
                      </p>
                      <p className="text-sm mb-2">
                        {cruise.nights} Nights • {cruise.embarkPortName}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        {new Date(cruise.sailingDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </p>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-gray-500">From</p>
                          <p className="text-xl font-bold text-blue-600">
                            ${price.toFixed(0)}
                          </p>
                        </div>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          View Deal
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <div className="flex gap-2">
                  {page > 1 && (
                    <button
                      onClick={() => setPage(page - 1)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Previous
                    </button>
                  )}

                  {/* Page Numbers */}
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
                        className={`px-4 py-2 rounded-lg ${
                          pageNum === page
                            ? "bg-blue-600 text-white"
                            : "border hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {page < totalPages && (
                    <button
                      onClick={() => setPage(page + 1)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* SEO Content Section */}
      {!loading && !error && (
        <div className="bg-gray-50 py-12 mt-8">
          <div className="container mx-auto px-4">
            {/* FAQs */}
            {category.faqItems && category.faqItems.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">
                  Frequently Asked Questions about {category.title}
                </h2>
                <div className="space-y-4">
                  {category.faqItems.map((faq, index) => (
                    <div key={index} className="bg-white p-6 rounded-lg">
                      <h3 className="font-semibold mb-2">{faq.question}</h3>
                      <p className="text-gray-700">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Why Book With Us */}
            <div className="bg-white p-6 rounded-lg">
              <h2 className="text-2xl font-bold mb-4">
                Why Book Your {category.name} Cruise with Zipsea?
              </h2>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Maximum onboard credit on every booking - more spending money
                  for your vacation
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Compare prices across all major cruise lines in one place
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Real-time pricing and availability direct from cruise lines
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Expert cruise consultants available to help you plan
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
