"use client";

import { useState } from "react";
import { createSlugFromCruise } from "../../lib/slug";

interface CruiseData {
  id: string;
  name: string;
  ship_name: string;
  sailing_date: string;
  cruise_line_name?: string;
  nights?: number;
}

export default function AdminCruiseLookup() {
  const [cruiseId, setCruiseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cruiseData, setCruiseData] = useState<CruiseData | null>(null);
  const [generatedSlug, setGeneratedSlug] = useState("");

  const handleLookup = async () => {
    if (!cruiseId.trim()) {
      setError("Please enter a cruise ID");
      return;
    }

    setLoading(true);
    setError("");
    setCruiseData(null);
    setGeneratedSlug("");

    try {
      // First try to get cruise data from the backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cruises?cruiseIds=${cruiseId.trim()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch cruise: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data?.cruises || result.data.cruises.length === 0) {
        setError(`No cruise found with ID: ${cruiseId}`);
        return;
      }

      const cruise = result.data.cruises[0];
      setCruiseData(cruise);

      // Generate the slug
      try {
        const slug = createSlugFromCruise({
          id: cruise.id,
          ship_name: cruise.ship_name,
          sailing_date: cruise.sailing_date,
        });
        setGeneratedSlug(slug);
      } catch (slugError) {
        setError(
          `Found cruise but could not generate slug: ${
            slugError instanceof Error ? slugError.message : "Unknown error"
          }`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch cruise data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLookup();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Cruise URL Lookup
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Enter a cruise ID (codetocruiseid) to get its URL and slug
      </p>

      {/* Input Section */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={cruiseId}
          onChange={(e) => setCruiseId(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter cruise ID (e.g., 2251185)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleLookup}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Looking up..." : "Lookup"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results Section */}
      {cruiseData && generatedSlug && (
        <div className="space-y-4">
          {/* Cruise Info */}
          <div className="p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Cruise Information
            </h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">ID:</span> {cruiseData.id}
              </p>
              <p>
                <span className="font-medium">Name:</span> {cruiseData.name}
              </p>
              <p>
                <span className="font-medium">Ship:</span>{" "}
                {cruiseData.ship_name}
              </p>
              <p>
                <span className="font-medium">Sailing Date:</span>{" "}
                {new Date(cruiseData.sailing_date).toLocaleDateString()}
              </p>
              {cruiseData.cruise_line_name && (
                <p>
                  <span className="font-medium">Cruise Line:</span>{" "}
                  {cruiseData.cruise_line_name}
                </p>
              )}
              {cruiseData.nights && (
                <p>
                  <span className="font-medium">Nights:</span>{" "}
                  {cruiseData.nights}
                </p>
              )}
            </div>
          </div>

          {/* Slug */}
          <div className="p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Slug</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono">
                {generatedSlug}
              </code>
              <button
                onClick={() => copyToClipboard(generatedSlug)}
                className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Full URL */}
          <div className="p-4 bg-green-50 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Full URL
            </h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono break-all">
                https://www.zipsea.com/cruise/{generatedSlug}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(
                    `https://www.zipsea.com/cruise/${generatedSlug}`
                  )
                }
                className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <a
              href={`https://www.zipsea.com/cruise/${generatedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Open in new tab →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
