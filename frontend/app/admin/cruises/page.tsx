"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";

interface Cruise {
  id: string;
  cruise_id: string;
  name: string;
  ship_name: string;
  cruise_line_name: string;
  nights: number;
  sailing_date: string;
  embark_port_name: string;
  disembark_port_name: string;
  cheapest_price: number;
  interior_price: number;
  oceanview_price: number;
  balcony_price: number;
  suite_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminCruises() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Cruise>("sailing_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCruiseLine, setFilterCruiseLine] = useState("");
  const [filterShip, setFilterShip] = useState("");
  const [cruiseLines, setCruiseLines] = useState<string[]>([]);
  const [ships, setShips] = useState<string[]>([]);
  const itemsPerPage = 50;

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
      return;
    }

    if (user && !user.publicMetadata?.isAdmin) {
      router.push("/");
      return;
    }

    if (user?.publicMetadata?.isAdmin) {
      fetchCruises();
    }
  }, [user, isLoaded, router, currentPage, sortField, sortDirection]);

  const fetchCruises = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortField,
        sortDirection,
      });

      if (searchTerm) params.append("search", searchTerm);
      if (filterCruiseLine) params.append("cruiseLine", filterCruiseLine);
      if (filterShip) params.append("ship", filterShip);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/cruises?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch cruises");

      const data = await response.json();
      setCruises(data.data.cruises);
      setTotalPages(Math.ceil(data.data.total / itemsPerPage));

      // Extract unique cruise lines and ships for filters
      const uniqueCruiseLines = [
        ...new Set(data.data.cruises.map((c: Cruise) => c.cruise_line_name)),
      ]
        .filter(Boolean)
        .sort();
      const uniqueShips = [
        ...new Set(data.data.cruises.map((c: Cruise) => c.ship_name)),
      ]
        .filter(Boolean)
        .sort();
      setCruiseLines(uniqueCruiseLines);
      setShips(uniqueShips);
    } catch (error) {
      console.error("Error fetching cruises:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Cruise) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchCruises();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return `$${price.toFixed(2)}`;
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user?.publicMetadata?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Cruise Management
            </h1>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={filterCruiseLine}
                onChange={(e) => {
                  setFilterCruiseLine(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Cruise Lines</option>
                {cruiseLines.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>

              <select
                value={filterShip}
                onChange={(e) => {
                  setFilterShip(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Ships</option>
                {ships.map((ship) => (
                  <option key={ship} value={ship}>
                    {ship}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Search
              </button>

              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterCruiseLine("");
                  setFilterShip("");
                  setCurrentPage(1);
                  fetchCruises();
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort("cruise_id")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    ID{" "}
                    {sortField === "cruise_id" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Name{" "}
                    {sortField === "name" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("cruise_line_name")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Cruise Line{" "}
                    {sortField === "cruise_line_name" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("ship_name")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Ship{" "}
                    {sortField === "ship_name" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("sailing_date")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Sailing Date{" "}
                    {sortField === "sailing_date" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("nights")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Nights{" "}
                    {sortField === "nights" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("cheapest_price")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Price{" "}
                    {sortField === "cheapest_price" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cruises.map((cruise) => (
                  <tr key={cruise.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cruise.cruise_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={cruise.name}>
                        {cruise.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cruise.cruise_line_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cruise.ship_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(cruise.sailing_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cruise.nights}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(cruise.cheapest_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          cruise.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {cruise.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
