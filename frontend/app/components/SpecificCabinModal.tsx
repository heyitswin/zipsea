"use client";

import { useState, useEffect } from "react";

interface Cabin {
  cabinNo: string;
  deck: string;
  position: string;
  features: string[];
  obstructed: boolean;
  available: boolean;
}

interface SpecificCabinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cabinNo: string) => void;
  sessionId: string;
  cruiseId: string;
  resultNo: string;
  gradeNo: string;
  rateCode: string;
  cabinGradeName: string;
}

export default function SpecificCabinModal({
  isOpen,
  onClose,
  onSelect,
  sessionId,
  cruiseId,
  resultNo,
  gradeNo,
  rateCode,
  cabinGradeName,
}: SpecificCabinModalProps) {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCabinNo, setSelectedCabinNo] = useState<string | null>(null);

  // Fetch specific cabins when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchSpecificCabins = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/booking/${sessionId}/specific-cabins?` +
            new URLSearchParams({
              cruiseId,
              resultNo,
              gradeNo,
              rateCode,
            }),
        );

        if (!response.ok) {
          throw new Error("Failed to load available cabins");
        }

        const data = await response.json();
        setCabins(data.cabins || []);
      } catch (err) {
        console.error("Failed to fetch specific cabins:", err);
        setError("Unable to load cabin list. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecificCabins();
  }, [isOpen, sessionId, cruiseId, resultNo, gradeNo, rateCode]);

  const handleSelect = () => {
    if (selectedCabinNo) {
      onSelect(selectedCabinNo);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-2xl font-geograph font-semibold text-gray-900">
                Choose Your Cabin
              </h2>
              <p className="mt-1 text-sm text-gray-500">{cabinGradeName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {isLoading && (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-4 text-gray-600">
                  Loading available cabins...
                </p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 text-blue-600 hover:text-blue-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {!isLoading && !error && cabins.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  No specific cabins available for this category.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Please select the guaranteed cabin option instead.
                </p>
              </div>
            )}

            {!isLoading && !error && cabins.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cabins.map((cabin) => (
                  <div
                    key={cabin.cabinNo}
                    onClick={() =>
                      cabin.available && setSelectedCabinNo(cabin.cabinNo)
                    }
                    className={`
                      border rounded-lg p-4 cursor-pointer transition-all
                      ${
                        !cabin.available
                          ? "opacity-50 cursor-not-allowed bg-gray-50"
                          : selectedCabinNo === cabin.cabinNo
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-geograph font-semibold text-lg">
                            Cabin {cabin.cabinNo}
                          </span>
                          {cabin.obstructed && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                              Obstructed View
                            </span>
                          )}
                          {!cabin.available && (
                            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-4 text-sm text-gray-600">
                          <span>Deck {cabin.deck}</span>
                          <span>•</span>
                          <span>{cabin.position}</span>
                        </div>
                        {cabin.features.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {cabin.features.map((feature, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {cabin.available && (
                        <div className="ml-4">
                          <input
                            type="radio"
                            checked={selectedCabinNo === cabin.cabinNo}
                            onChange={() => setSelectedCabinNo(cabin.cabinNo)}
                            className="h-4 w-4 text-blue-600"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!isLoading && !error && cabins.length > 0 && (
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={!selectedCabinNo}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-geograph font-medium"
              >
                Reserve Selected Cabin
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
