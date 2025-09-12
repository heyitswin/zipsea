"use client";

import { useState, useEffect } from "react";
import { useAlert } from "../../components/GlobalAlertProvider";

// Format date properly handling UTC
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "N/A";
  try {
    // Parse the UTC date and format it properly
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return formatted;
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Invalid date";
  }
};

interface QuoteRequest {
  id: string;
  reference_number: string;
  created_at: string;
  cruise_line_name: string;
  ship_name: string;
  sailing_date: string;
  cabin_type: string;
  passenger_count: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  total_price?: number;
  quote_response?: any;
  special_requirements?: string;
}

interface ResponseModalProps {
  quote: QuoteRequest;
  onClose: () => void;
  onSubmit: (quoteId: string, response: any) => Promise<void>;
}

function ResponseModal({ quote, onClose, onSubmit }: ResponseModalProps) {
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<
    Array<{
      cabinCategory: string;
      price: string;
      obc: string;
      description: string;
    }>
  >(
    Array(10)
      .fill(null)
      .map(() => ({
        cabinCategory: "",
        price: "",
        obc: "",
        description: "",
      })),
  );

  const handleSubmit = async () => {
    setLoading(true);
    const validPrices = prices.filter((p) => p.cabinCategory && p.price);
    // Convert to the format expected by backend
    const categories = validPrices.map((p) => {
      const price = parseFloat(p.price || "0");
      // Use provided OBC or calculate as 5% of price
      const obcAmount = p.obc ? parseFloat(p.obc) : Math.round(price * 0.05);
      return {
        category: p.cabinCategory,
        roomName: p.description || "",
        finalPrice: price,
        obcAmount: obcAmount,
      };
    });
    await onSubmit(quote.id, {
      categories,
      notes: `Total options: ${validPrices.length}`,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Respond to Quote Request
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Reference: {quote.reference_number}
              </p>
            </div>
            <button
              onClick={onClose}
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

        {/* Quote Details */}
        <div className="p-6 bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Customer:</p>
              <p className="font-medium">
                {quote.first_name} {quote.last_name}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Contact:</p>
              <p className="font-medium">{quote.email}</p>
              <p className="font-medium">{quote.phone}</p>
            </div>
            <div>
              <p className="text-gray-600">Cruise:</p>
              <p className="font-medium">
                {quote.cruise_line_name} - {quote.ship_name}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Sailing Date:</p>
              <p className="font-medium">{formatDate(quote.sailing_date)}</p>
            </div>
            <div>
              <p className="text-gray-600">Requested Cabin:</p>
              <p className="font-medium">{quote.cabin_type || "Any"}</p>
            </div>
            <div>
              <p className="text-gray-600">Passengers:</p>
              <p className="font-medium">{quote.passenger_count}</p>
            </div>
          </div>
          {quote.special_requirements && (
            <div className="mt-4">
              <p className="text-gray-600 text-sm">Special Requirements:</p>
              <p className="font-medium text-sm mt-1">
                {quote.special_requirements}
              </p>
            </div>
          )}
        </div>

        {/* Pricing Form */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Cabin Pricing Options
          </h3>
          <div className="space-y-3">
            {prices.map((price, index) => (
              <div key={index} className="grid grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Cabin Category"
                  value={price.cabinCategory}
                  onChange={(e) => {
                    const newPrices = [...prices];
                    newPrices[index].cabinCategory = e.target.value;
                    setPrices(newPrices);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={price.price}
                  onChange={(e) => {
                    const newPrices = [...prices];
                    newPrices[index].price = e.target.value;
                    setPrices(newPrices);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="OBC Amount"
                  value={price.obc}
                  onChange={(e) => {
                    const newPrices = [...prices];
                    newPrices[index].obc = e.target.value;
                    setPrices(newPrices);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={price.description}
                  onChange={(e) => {
                    const newPrices = [...prices];
                    newPrices[index].description = e.target.value;
                    setPrices(newPrices);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading || !prices.some((p) => p.cabinCategory && p.price)
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuotes() {
  const { showAlert } = useAlert();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter, currentPage]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const response = await fetch(
        `${backendUrl}/api/v1/admin/quotes?${params}`,
      );
      if (response.ok) {
        const data = await response.json();
        setQuotes(data.quotes || []);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error("Failed to fetch quotes:", response.status);
        showAlert("Failed to load quote requests");
      }
    } catch (error) {
      console.error("Error fetching quotes:", error);
      showAlert("Error loading quote requests");
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (quoteId: string, response: any) => {
    try {
      // Step 1: Update quote in backend
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "https://zipsea-production.onrender.com";
      const res = await fetch(
        `${backendUrl}/api/v1/admin/quotes/${quoteId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        },
      );

      if (!res.ok) {
        showAlert("Failed to update quote response");
        return;
      }

      // Step 2: Find the quote to get customer email and details
      const quote = quotes.find((q) => q.id === quoteId);
      if (!quote || !quote.email) {
        showAlert(
          "Quote updated but email could not be sent - customer email not found",
        );
        fetchQuotes();
        return;
      }

      // Step 3: Send email using the working frontend email service
      try {
        const emailRes = await fetch("/api/send-quote-ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: quote.email,
            referenceNumber: quote.reference_number,
            cruiseName:
              quote.cruise_line_name && quote.ship_name
                ? `${quote.cruise_line_name} - ${quote.ship_name}`
                : "Your Selected Cruise",
            shipName: quote.ship_name || "",
            departureDate: quote.sailing_date,
            returnDate: undefined, // We don't have return date in the admin quotes
            categories: response.categories,
            notes: response.notes,
          }),
        });

        if (emailRes.ok) {
          showAlert("Quote response sent successfully via email!");
        } else {
          showAlert(
            "Quote updated successfully, but email notification failed to send",
          );
        }
      } catch (emailError) {
        console.error("Error sending quote email:", emailError);
        showAlert(
          "Quote updated successfully, but email notification failed to send",
        );
      }

      fetchQuotes();
    } catch (error) {
      console.error("Error sending response:", error);
      showAlert("Error sending quote response");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "responded":
      case "quoted":
        return "bg-blue-100 text-blue-800";
      case "booked":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl text-gray-600">Loading quote requests...</div>
      </div>
    );
  }

  return (
    <>
      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="waiting">Waiting</option>
              <option value="responded">Responded</option>
              <option value="booked">Booked</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            onClick={fetchQuotes}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date/Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cruise Line
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ship Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sailing Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(quote.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {quote.reference_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {quote.cruise_line_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {quote.ship_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(quote.sailing_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      {quote.first_name} {quote.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{quote.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(quote.status)}`}
                    >
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(quote.status === "waiting" ||
                      quote.status === "pending") && (
                      <button
                        onClick={() => setSelectedQuote(quote)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Respond
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Response Modal */}
      {selectedQuote && (
        <ResponseModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onSubmit={handleRespond}
        />
      )}
    </>
  );
} // Deploy trigger Wed Sep  3 19:05:46 EDT 2025
