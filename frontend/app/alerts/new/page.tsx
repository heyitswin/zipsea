"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Navigation from "../../components/Navigation";

interface CruiseLine {
  id: number;
  name: string;
}

export default function NewAlertPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, userId } = useAuth();

  // Form state
  const [alertName, setAlertName] = useState("");
  const [selectedCruiseLines, setSelectedCruiseLines] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [maxBudget, setMaxBudget] = useState("");
  const [selectedCabinTypes, setSelectedCabinTypes] = useState<string[]>([]);
  const [regionId, setRegionId] = useState<number | null>(null);

  // Data
  const [cruiseLines, setCruiseLines] = useState<CruiseLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load cruise lines
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cruise-lines`)
      .then((res) => res.json())
      .then((data) => setCruiseLines(data))
      .catch((err) => console.error("Failed to load cruise lines", err));
  }, []);

  // Pre-populate from URL params
  useEffect(() => {
    const lineParam = searchParams.get("cruiseLines");
    const monthParam = searchParams.get("months");
    const budgetParam = searchParams.get("maxBudget");
    const regionsParam = searchParams.get("regions");

    if (lineParam) {
      const lineIds = lineParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      setSelectedCruiseLines(lineIds);
    }
    if (monthParam) {
      setSelectedMonths(monthParam.split(","));
    }
    if (budgetParam) {
      setMaxBudget(budgetParam);
    }
    if (regionsParam) {
      const regionIds = regionsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (regionIds.length > 0) {
        setRegionId(regionIds[0]); // For now, just use the first region
      }
    }
  }, [searchParams]);

  const handleCruiseLineToggle = (lineId: number) => {
    setSelectedCruiseLines((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId],
    );
  };

  const handleMonthToggle = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month],
    );
  };

  const handleCabinTypeToggle = (cabinType: string) => {
    setSelectedCabinTypes((prev) =>
      prev.includes(cabinType)
        ? prev.filter((t) => t !== cabinType)
        : [...prev, cabinType],
    );
  };

  const generateAlertName = () => {
    const lines =
      selectedCruiseLines.length > 0
        ? cruiseLines
            .filter((l) => selectedCruiseLines.includes(l.id))
            .map((l) => l.name)
            .join(", ")
        : "Any Line";
    const months =
      selectedMonths.length > 0 ? selectedMonths.join(", ") : "Any Month";
    return `${lines} - ${months} under $${maxBudget || "0"}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!alertName.trim()) {
      setError("Please enter an alert name");
      return;
    }
    if (selectedCruiseLines.length === 0) {
      setError("Please select at least one cruise line");
      return;
    }
    if (selectedMonths.length === 0) {
      setError("Please select at least one departure month");
      return;
    }
    if (!maxBudget || parseFloat(maxBudget) <= 0) {
      setError("Please enter a valid budget");
      return;
    }
    if (selectedCabinTypes.length === 0) {
      setError("Please select at least one cabin type");
      return;
    }

    // Check if user is signed in
    if (!isSignedIn) {
      // Redirect to sign in with return URL
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/alerts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getClerkToken()}`,
          },
          body: JSON.stringify({
            name: alertName,
            searchCriteria: {
              cruiseLineId: selectedCruiseLines,
              departureMonth: selectedMonths,
              regionId: regionId || undefined,
            },
            maxBudget: parseFloat(maxBudget),
            cabinTypes: selectedCabinTypes,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to create alert");
      }

      const alert = await response.json();
      router.push(`/alerts/${alert.id}/matches`);
    } catch (err) {
      console.error("Failed to create alert", err);
      setError("Failed to create alert. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getClerkToken = async () => {
    // This would use Clerk's getToken method
    // For now, return empty string - needs proper Clerk integration
    return "";
  };

  // Generate months for next 24 months
  const availableMonths = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    return date.toISOString().slice(0, 7); // YYYY-MM format
  });

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-8 mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Price Alert</h1>
          <p className="text-gray-600">
            Get notified daily when cruises match your criteria and fall below
            your budget
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Alert Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Alert Name</label>
            <input
              type="text"
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              placeholder={generateAlertName()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Give your alert a memorable name (auto-generated if left blank)
            </p>
          </div>

          {/* Cruise Lines */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Cruise Lines *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {cruiseLines.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => handleCruiseLineToggle(line.id)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    selectedCruiseLines.includes(line.id)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                  }`}
                >
                  {line.name}
                </button>
              ))}
            </div>
          </div>

          {/* Departure Months */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Departure Months *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {availableMonths.map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleMonthToggle(month)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedMonths.includes(month)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                  }`}
                >
                  {formatMonth(month)}
                </button>
              ))}
            </div>
          </div>

          {/* Max Budget */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Maximum Budget (per person) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="2000"
                min="0"
                step="50"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              You'll be notified when cruises fall below this price
            </p>
          </div>

          {/* Cabin Types */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Cabin Types *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["interior", "oceanview", "balcony", "suite"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleCabinTypeToggle(type)}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    selectedCabinTypes.includes(type)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                  }`}
                >
                  <div className="font-medium capitalize">{type}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? "Creating Alert..."
                : isSignedIn
                  ? "Create Alert"
                  : "Sign In to Create Alert"}
            </button>

            {!isSignedIn && (
              <p className="text-sm text-gray-500 text-center mt-2">
                You'll be redirected to sign in before creating the alert
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
