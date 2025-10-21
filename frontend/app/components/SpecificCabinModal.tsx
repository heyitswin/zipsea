"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Cabin {
  cabinNo: string;
  deck: string;
  deckCode?: string;
  deckId?: number;
  position: string;
  features: string[];
  obstructed: boolean;
  available: boolean;
  resultNo: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

interface DeckPlan {
  name: string;
  deckCode: string;
  deckId: number;
  imageUrl: string;
  description?: string;
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
  const [deckPlans, setDeckPlans] = useState<DeckPlan[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCabinNo, setSelectedCabinNo] = useState<string | null>(null);
  const [deckPlanDimensions, setDeckPlanDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<"cabins" | "deckplans">("cabins");

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
        console.log("🔍 SpecificCabinModal: Received data:", {
          cabinsCount: data.cabins?.length || 0,
          deckPlansCount: data.deckPlans?.length || 0,
          deckPlans: data.deckPlans,
        });

        setCabins(data.cabins || []);
        setDeckPlans(data.deckPlans || []);

        // Auto-select first deck if available
        if (data.deckPlans && data.deckPlans.length > 0) {
          console.log("✅ Auto-selecting first deck:", data.deckPlans[0].name);
          setSelectedDeck(data.deckPlans[0].deckCode || data.deckPlans[0].name);
        } else {
          console.log("⚠️  No deck plans available");
        }
      } catch (err) {
        console.error("Failed to fetch specific cabins:", err);
        setError("Unable to load cabin list. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecificCabins();
  }, [isOpen, sessionId, cruiseId, resultNo, gradeNo, rateCode]);

  const handleCabinClick = (cabin: Cabin) => {
    if (!cabin.available) return;

    setSelectedCabinNo(cabin.cabinNo);

    // Auto-switch to this cabin's deck
    const cabinDeck = cabin.deckCode || cabin.deck;
    if (cabinDeck && cabinDeck !== selectedDeck) {
      setSelectedDeck(cabinDeck);
    }
  };

  const handleSelect = () => {
    if (selectedCabinNo) {
      const selectedCabin = cabins.find((c) => c.cabinNo === selectedCabinNo);
      if (selectedCabin && selectedCabin.resultNo) {
        onSelect(selectedCabin.resultNo);
      } else {
        console.error(
          "Selected cabin not found or missing resultNo:",
          selectedCabinNo,
        );
        onSelect(selectedCabinNo);
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentDeck = deckPlans.find(
    (d) => d.deckCode === selectedDeck || d.name === selectedDeck,
  );

  const cabinsOnSelectedDeck = cabins.filter(
    (c) => c.deckCode === selectedDeck || c.deck === selectedDeck,
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Full screen on mobile, centered on desktop */}
      <div className="flex min-h-full items-center justify-center md:p-4">
        <div className="relative w-full h-full md:h-auto md:max-w-7xl bg-white md:rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b flex-shrink-0">
            <div>
              <h2 className="text-xl md:text-2xl font-geograph font-semibold text-gray-900">
                Choose Your Cabin
              </h2>
              <p className="mt-1 text-sm text-gray-500">{cabinGradeName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <Image
                src="/images/close-white.svg"
                alt="Close"
                width={24}
                height={24}
                className="invert"
              />
            </button>
          </div>

          {/* Mobile Tabs */}
          {deckPlans.length > 0 && (
            <div className="md:hidden flex border-b flex-shrink-0">
              <button
                onClick={() => setMobileTab("cabins")}
                className={`flex-1 py-3 px-4 font-geograph font-medium text-sm transition-colors ${
                  mobileTab === "cabins"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                Cabins ({cabins.length})
              </button>
              <button
                onClick={() => setMobileTab("deckplans")}
                className={`flex-1 py-3 px-4 font-geograph font-medium text-sm transition-colors ${
                  mobileTab === "deckplans"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                Deck Plans
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12 px-6">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Loading available cabins...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12 px-6">
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* No Cabins State */}
          {!isLoading && !error && cabins.length === 0 && (
            <div className="text-center py-12 px-6">
              <p className="text-gray-600">
                No specific cabins available for this category.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Please select the guaranteed cabin option instead.
              </p>
            </div>
          )}

          {/* Main Content - Tabbed on Mobile, Side by Side on Desktop */}
          {!isLoading && !error && cabins.length > 0 && (
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Deck Plans - Hidden on mobile unless active tab */}
              {deckPlans.length > 0 && (
                <div
                  className={`lg:w-1/2 p-4 md:p-6 lg:border-r border-gray-200 overflow-y-auto ${mobileTab === "deckplans" ? "flex-1" : "hidden lg:block"}`}
                >
                  <h3 className="font-geograph font-semibold text-lg mb-3">
                    Deck Plans
                  </h3>

                  {/* Deck Selector */}
                  {deckPlans.length > 1 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Deck
                      </label>
                      <select
                        value={selectedDeck || ""}
                        onChange={(e) => setSelectedDeck(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {deckPlans.map((deck) => (
                          <option
                            key={deck.deckId}
                            value={deck.deckCode || deck.name}
                          >
                            {deck.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Deck Plan Image with Cabin Highlighting */}
                  {selectedDeck && currentDeck?.imageUrl && (
                    <>
                      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                        <div className="relative">
                          <img
                            src={currentDeck.imageUrl}
                            alt={currentDeck.name}
                            className="w-full h-auto"
                            onLoad={(e) => {
                              const img = e.target as HTMLImageElement;
                              setDeckPlanDimensions({
                                width: img.naturalWidth,
                                height: img.naturalHeight,
                              });
                            }}
                          />

                          {/* Draw rectangles for selected cabin */}
                          {deckPlanDimensions && (
                            <svg
                              className="absolute top-0 left-0 w-full h-full pointer-events-none"
                              viewBox={`0 0 ${deckPlanDimensions.width} ${deckPlanDimensions.height}`}
                              preserveAspectRatio="xMidYMid meet"
                            >
                              {cabinsOnSelectedDeck.map((cabin) => {
                                if (
                                  !cabin.x1 ||
                                  !cabin.y1 ||
                                  !cabin.x2 ||
                                  !cabin.y2
                                )
                                  return null;

                                const isSelected =
                                  selectedCabinNo === cabin.cabinNo;

                                // Only show selected cabin
                                if (!isSelected) return null;

                                return (
                                  <rect
                                    key={cabin.cabinNo}
                                    x={cabin.x1}
                                    y={cabin.y1}
                                    width={cabin.x2 - cabin.x1}
                                    height={cabin.y2 - cabin.y1}
                                    fill="rgba(59, 130, 246, 0.3)"
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    className="transition-all"
                                  />
                                );
                              })}
                            </svg>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        {selectedCabinNo
                          ? `Cabin ${selectedCabinNo} is highlighted with a blue stroke on the deck plan.`
                          : `Select a cabin from the list to see its location highlighted.`}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Cabin List - Hidden on mobile unless active tab */}
              <div
                className={`${deckPlans.length > 0 ? "lg:w-1/2" : "w-full"} p-4 md:p-6 overflow-y-auto ${mobileTab === "cabins" || deckPlans.length === 0 ? "flex-1" : "hidden lg:block"}`}
              >
                <h3 className="font-geograph font-semibold text-lg mb-3">
                  Available Cabins ({cabins.length})
                </h3>

                <div className="space-y-3">
                  {cabins.map((cabin) => (
                    <div
                      key={cabin.cabinNo}
                      onClick={() => handleCabinClick(cabin)}
                      className={`
                        border rounded-lg p-4 cursor-pointer transition-all
                        ${
                          !cabin.available
                            ? "opacity-50 cursor-not-allowed bg-gray-50"
                            : selectedCabinNo === cabin.cabinNo
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
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
                              onChange={() => handleCabinClick(cabin)}
                              className="h-4 w-4 text-blue-600"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {!isLoading && !error && cabins.length > 0 && (
            <div className="flex items-center justify-end gap-3 p-4 md:p-6 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-geograph"
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
