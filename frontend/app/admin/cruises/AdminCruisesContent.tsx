"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";

interface Cruise {
  id: string;
  cruise_id: string;
  name: string;
  cruise_line_name: string;
  ship_name: string;
  sailing_date: string;
  nights: number;
  embark_port: string;
  disembark_port: string;
  min_price: number;
  max_price: number;
  region_ids: string;
  port_ids: string;
  created_at: string;
  updated_at: string;
}

export default function AdminCruisesContent() {
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

      const token = await getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/cruises?${params.toString()}`,
        { headers }
      );

      if (!response.ok) throw new Error("Failed to fetch cruises");

      const data = await response.json();
      setCruises(data.data.cruises);
      setTotalPages(Math.ceil(data.data.total / itemsPerPage));

      // Extract unique cruise lines and ships for filters
      const uniqueCruiseLines: string[] = [
        ...new Set(data.data.cruises.map((c: Cruise) => c.cruise_line_name)),
      ]
        .filter(Boolean)
        .sort() as string[];
      const uniqueShips: string[] = [
        ...new Set(data.data.cruises.map((c: Cruise) => c.ship_name)),
      ]
        .filter(Boolean)
        .sort() as string[];
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (!isLoaded) {
    return <div className="p-4">Loading authentication...</div>;
  }

  if (!user?.publicMetadata?.isAdmin) {
    return <div className="p-4">Unauthorized</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Admin - Cruise Management</h1>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search cruises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="px-4 py-2 border rounded-lg"
          />
          <select
            value={filterCruiseLine}
            onChange={(e) => setFilterCruiseLine(e.target.value)}
            className="px-4 py-2 border rounded-lg"
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
            onChange={(e) => setFilterShip(e.target.value)}
            className="px-4 py-2 border rounded-lg"
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
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Search
          </button>
        </div>
      </div>

      {/* Cruises Table */}
      {loading ? (
        <div className="text-center py-8">Loading cruises...</div>
      ) : (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("cruise_id")}
                    >
                      Cruise ID{" "}
                      {sortField === "cruise_id" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("name")}
                    >
                      Name{" "}
                      {sortField === "name" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("cruise_line_name")}
                    >
                      Cruise Line{" "}
                      {sortField === "cruise_line_name" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("ship_name")}
                    >
                      Ship{" "}
                      {sortField === "ship_name" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("sailing_date")}
                    >
                      Sailing Date{" "}
                      {sortField === "sailing_date" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("nights")}
                    >
                      Nights{" "}
                      {sortField === "nights" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("min_price")}
                    >
                      Price Range{" "}
                      {sortField === "min_price" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ports
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cruises.map((cruise) => (
                    <tr key={cruise.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cruise.cruise_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {cruise.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cruise.cruise_line_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cruise.ship_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(cruise.sailing_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cruise.nights}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${cruise.min_price?.toLocaleString() || "N/A"} - $
                        {cruise.max_price?.toLocaleString() || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {cruise.embark_port} → {cruise.disembark_port}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() =>
                            router.push(`/admin/cruises/${cruise.id}`)
                          }
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          View
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex justify-center">
            <nav className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded border disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded border disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
