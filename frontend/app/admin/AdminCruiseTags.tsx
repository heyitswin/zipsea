"use client";

import { useEffect, useState } from "react";
import { useAlert } from "../../components/GlobalAlertProvider";

interface CruiseTag {
  id: number;
  name: string;
  displayName: string;
  description?: string;
}

interface CruiseWithTags {
  cruiseLineId: number;
  cruiseLineName: string;
  shipId: number;
  shipName: string;
  cruiseName: string;
  nights: number;
  sailingCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  earliestSailing: string;
  latestSailing: string;
  regions: string[];
  tags: CruiseTag[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CruiseLine {
  id: number;
  name: string;
}

export default function AdminCruiseTags() {
  const { showAlert } = useAlert();

  const [cruises, setCruises] = useState<CruiseWithTags[]>([]);
  const [availableTags, setAvailableTags] = useState<CruiseTag[]>([]);
  const [cruiseLines, setCruiseLines] = useState<CruiseLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<
    "count" | "price" | "cruiseLine" | "nights"
  >("count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [selectedCruise, setSelectedCruise] = useState<CruiseWithTags | null>(
    null,
  );
  const [showTagModal, setShowTagModal] = useState(false);

  // Filters
  const [filterCruiseLine, setFilterCruiseLine] = useState<string>("");
  const [filterMinNights, setFilterMinNights] = useState<string>("");
  const [filterMaxNights, setFilterMaxNights] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterRegion, setFilterRegion] = useState<string>("");

  useEffect(() => {
    fetchTags();
    fetchCruiseLines();
  }, []);

  useEffect(() => {
    fetchCruises();
  }, [
    sortBy,
    sortOrder,
    currentPage,
    filterCruiseLine,
    filterMinNights,
    filterMaxNights,
    filterMinPrice,
    filterMaxPrice,
    filterRegion,
  ]);

  const fetchTags = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const response = await fetch(
        `${backendUrl}/api/v1/admin/cruise-tags/tags`,
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags || []);
      } else {
        console.error("Failed to fetch tags:", response.status);
        showAlert("Failed to load cruise tags");
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
      showAlert("Error loading cruise tags");
    }
  };

  const fetchCruiseLines = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const response = await fetch(
        `${backendUrl}/api/v1/admin/cruise-tags/cruise-lines`,
      );

      if (response.ok) {
        const data = await response.json();
        setCruiseLines(data.cruiseLines || []);
      }
    } catch (error) {
      console.error("Error fetching cruise lines:", error);
    }
  };

  const fetchCruises = async () => {
    setLoading(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const params = new URLSearchParams({
        sortBy,
        order: sortOrder,
        page: currentPage.toString(),
        limit: "50",
      });

      // Add filters if set
      if (filterCruiseLine) params.append("cruiseLineId", filterCruiseLine);
      if (filterMinNights) params.append("minNights", filterMinNights);
      if (filterMaxNights) params.append("maxNights", filterMaxNights);
      if (filterMinPrice) params.append("minPrice", filterMinPrice);
      if (filterMaxPrice) params.append("maxPrice", filterMaxPrice);
      if (filterRegion) params.append("region", filterRegion);

      const response = await fetch(
        `${backendUrl}/api/v1/admin/cruise-tags/cruises?${params}`,
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCruises(result.data.cruises || []);
          setPagination(
            result.data.pagination || {
              page: 1,
              limit: 50,
              total: 0,
              totalPages: 1,
            },
          );
        }
      } else {
        console.error("Failed to fetch cruises:", response.status);
        showAlert("Failed to load cruises");
      }
    } catch (error) {
      console.error("Error fetching cruises:", error);
      showAlert("Error loading cruises");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (cruise: CruiseWithTags, tagId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const response = await fetch(
        `${backendUrl}/api/v1/admin/cruise-tags/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cruiseLineId: cruise.cruiseLineId,
            cruiseName: cruise.cruiseName,
            shipId: cruise.shipId,
            tagId,
          }),
        },
      );

      if (response.ok) {
        showAlert("Tag added successfully");
        fetchCruises();
        setShowTagModal(false);
        setSelectedCruise(null);
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Failed to add tag");
      }
    } catch (error) {
      console.error("Error adding tag:", error);
      showAlert("Error adding tag");
    }
  };

  const handleRemoveTag = async (cruise: CruiseWithTags, tagId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const response = await fetch(
        `${backendUrl}/api/v1/admin/cruise-tags/remove`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cruiseLineId: cruise.cruiseLineId,
            cruiseName: cruise.cruiseName,
            shipId: cruise.shipId,
            tagId,
          }),
        },
      );

      if (response.ok) {
        showAlert("Tag removed successfully");
        fetchCruises();
      } else {
        showAlert("Failed to remove tag");
      }
    } catch (error) {
      console.error("Error removing tag:", error);
      showAlert("Error removing tag");
    }
  };

  const openTagModal = (cruise: CruiseWithTags) => {
    setSelectedCruise(cruise);
    setShowTagModal(true);
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return `$${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRegionDisplay = (regions: string[] | string | null | undefined) => {
    // Handle non-array cases
    if (!regions) return "Various";
    if (typeof regions === "string") {
      return regions || "Various";
    }
    if (!Array.isArray(regions)) return "Various";

    const filtered = regions.filter(
      (r) => r && typeof r === "string" && r.trim() !== "",
    );
    if (filtered.length === 0) return "Various";
    return filtered.slice(0, 2).join(", ") + (filtered.length > 2 ? "..." : "");
  };

  if (loading && cruises.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl text-gray-600">Loading cruise tags...</div>
      </div>
    );
  }

  return (
    <>
      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cruise Line
            </label>
            <select
              value={filterCruiseLine}
              onChange={(e) => {
                setFilterCruiseLine(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Lines</option>
              {cruiseLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Min Nights
            </label>
            <input
              type="number"
              value={filterMinNights}
              onChange={(e) => {
                setFilterMinNights(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g., 7"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max Nights
            </label>
            <input
              type="number"
              value={filterMaxNights}
              onChange={(e) => {
                setFilterMaxNights(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g., 14"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Min Price
            </label>
            <input
              type="number"
              value={filterMinPrice}
              onChange={(e) => {
                setFilterMinPrice(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g., 500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max Price
            </label>
            <input
              type="number"
              value={filterMaxPrice}
              onChange={(e) => {
                setFilterMaxPrice(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g., 5000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Region
            </label>
            <input
              type="text"
              value={filterRegion}
              onChange={(e) => {
                setFilterRegion(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g., Caribbean"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sort and Actions Row */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="count">Sailing Count</option>
                <option value="cruiseLine">Cruise Line</option>
                <option value="nights">Duration (Nights)</option>
                <option value="price">Average Price</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">
                Order:
              </label>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as "asc" | "desc");
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            {(filterCruiseLine ||
              filterMinNights ||
              filterMaxNights ||
              filterMinPrice ||
              filterMaxPrice ||
              filterRegion) && (
              <button
                onClick={() => {
                  setFilterCruiseLine("");
                  setFilterMinNights("");
                  setFilterMaxNights("");
                  setFilterMinPrice("");
                  setFilterMaxPrice("");
                  setFilterRegion("");
                  setCurrentPage(1);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Clear Filters
              </button>
            )}
          </div>

          <button
            onClick={fetchCruises}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {cruises.length} of {pagination.total.toLocaleString()}{" "}
            unique cruises
          </p>
        </div>
      </div>

      {/* Cruises Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Cruise Tags Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage tags for cruise categories. Tags can be assigned to multiple
            cruises and cruises can have multiple tags.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cruise Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cruise Line
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ship
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sailings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Region
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cruises.map((cruise, idx) => (
                <tr
                  key={`${cruise.cruiseLineId}-${cruise.cruiseName}-${cruise.shipId}-${idx}`}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {cruise.cruiseName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {cruise.cruiseLineName}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {cruise.shipName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {cruise.nights} nights
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {cruise.sailingCount} sailings
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatPrice(cruise.minPrice)} -{" "}
                      {formatPrice(cruise.maxPrice)}
                    </div>
                    {cruise.avgPrice && (
                      <div className="text-xs text-gray-500">
                        Avg: {formatPrice(cruise.avgPrice)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {getRegionDisplay(cruise.regions)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {cruise.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag.displayName}
                          <button
                            onClick={() => handleRemoveTag(cruise, tag.id)}
                            className="ml-1 hover:text-blue-900"
                            title="Remove tag"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {cruise.tags.length === 0 && (
                        <span className="text-xs text-gray-400">No tags</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openTagModal(cruise)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      Add Tag
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Tag Selection Modal */}
      {showTagModal && selectedCruise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Add Tag
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedCruise.cruiseName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setSelectedCruise(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
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
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Select a tag to add to this cruise:
              </p>
              <div className="space-y-2">
                {availableTags
                  .filter(
                    (tag) => !selectedCruise.tags.find((t) => t.id === tag.id),
                  )
                  .map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(selectedCruise, tag.id)}
                      className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        {tag.displayName}
                      </div>
                      {tag.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {tag.description}
                        </div>
                      )}
                    </button>
                  ))}
                {availableTags.filter(
                  (tag) => !selectedCruise.tags.find((t) => t.id === tag.id),
                ).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    All available tags have been added
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
