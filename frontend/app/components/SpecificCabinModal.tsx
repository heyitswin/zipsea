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
  accessible?: boolean;
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
  isReserving?: boolean;
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
  isReserving = false,
}: SpecificCabinModalProps) {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [deckPlans, setDeckPlans] = useState<DeckPlan[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [previousDeck, setPreviousDeck] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCabinNo, setSelectedCabinNo] = useState<string | null>(null);
  const [deckPlanDimensions, setDeckPlanDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<"cabins" | "deckplans">("cabins");
  const [showAccessibleOnly, setShowAccessibleOnly] = useState(false);

  // Reset deck plan dimensions only when deck actually changes (not when set to same deck)
  useEffect(() => {
    if (selectedDeck !== previousDeck) {
      setDeckPlanDimensions(null);
      setPreviousDeck(selectedDeck);
    }
  }, [selectedDeck, previousDeck]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

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

    // Auto-switch to this cabin's deck - find matching deck plan
    const matchingDeckPlan = deckPlans.find(
      (d) =>
        d.deckCode === cabin.deckCode ||
        d.deckCode === cabin.deck ||
        d.name === cabin.deck ||
        d.name === cabin.deckCode,
    );

    if (matchingDeckPlan) {
      const targetDeck = matchingDeckPlan.deckCode || matchingDeckPlan.name;
      console.log(
        "🔄 Switching deck to:",
        targetDeck,
        "from cabin:",
        cabin.cabinNo,
        "Current deck:",
        selectedDeck,
      );
      setSelectedDeck(targetDeck);
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

  // Filter cabins based on accessible checkbox
  const filteredCabins = showAccessibleOnly
    ? cabins.filter((c) => c.accessible)
    : cabins;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Full screen on mobile, centered on desktop */}
      <div className="flex min-h-full items-center justify-center md:p-4">
        <div className="relative w-full h-full md:h-[90vh] md:max-w-7xl bg-white md:rounded-xl shadow-xl flex flex-col">
          {/* Header - Fixed on mobile and desktop */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 md:p-6 border-b flex-shrink-0 bg-white">
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

          {/* Mobile Tabs - Fixed on mobile */}
          {deckPlans.length > 0 && (
            <div className="md:hidden sticky top-[73px] z-10 flex border-b flex-shrink-0 bg-white">
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
              {/* Cabin List - Hidden on mobile unless active tab - LEFT on desktop */}
              <div
                className={`${deckPlans.length > 0 ? "lg:w-1/2" : "w-full"} p-4 md:p-6 lg:border-r border-gray-200 overflow-y-auto ${mobileTab === "cabins" || deckPlans.length === 0 ? "flex-1" : "hidden lg:block"}`}
              >
                <h3 className="font-geograph font-semibold text-lg mb-3">
                  Available Cabins ({filteredCabins.length})
                </h3>

                {/* Accessible Filter Checkbox */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAccessibleOnly}
                      onChange={(e) => setShowAccessibleOnly(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="font-geograph text-sm text-gray-700 flex items-center gap-1">
                      <span className="text-base">♿</span>
                      Show accessible cabins only
                    </span>
                  </label>
                </div>

                <div className="space-y-3">
                  {filteredCabins.map((cabin) => (
                    <div
                      key={cabin.cabinNo}
                      onClick={() => handleCabinClick(cabin)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedCabinNo === cabin.cabinNo
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-geograph font-semibold text-base flex items-center gap-2">
                          Cabin {cabin.cabinNo}
                          {cabin.accessible && (
                            <span
                              className="text-blue-600"
                              title="Accessible cabin"
                            >
                              ♿
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          Deck {cabin.deck}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-1">
                        {cabin.position}
                      </div>

                      {cabin.features && cabin.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cabin.features.map((feature, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      )}

                      {cabin.obstructed && (
                        <div className="mt-2 text-xs text-orange-600 font-medium">
                          ⚠️ Obstructed View
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Deck Plans - Hidden on mobile unless active tab - RIGHT on desktop */}
              {deckPlans.length > 0 && (
                <div
                  className={`lg:w-1/2 p-4 md:p-6 overflow-y-auto ${mobileTab === "deckplans" ? "flex-1" : "hidden lg:block"}`}
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

                          {/* White overlay when cabin is selected */}
                          {selectedCabinNo && (
                            <div className="absolute top-0 left-0 w-full h-full bg-white opacity-50 pointer-events-none" />
                          )}

                          {/* Draw rectangles for selected cabin */}
                          {deckPlanDimensions && (
                            <svg
                              className="absolute top-0 left-0 w-full h-full pointer-events-none"
                              viewBox={`0 0 ${deckPlanDimensions.width} ${deckPlanDimensions.height}`}
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <defs>
                                <filter id="glow">
                                  <feGaussianBlur
                                    stdDeviation="3"
                                    result="coloredBlur"
                                  />
                                  <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                  </feMerge>
                                </filter>
                              </defs>
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
                                    fill="rgba(59, 130, 246, 0.5)"
                                    stroke="#2563eb"
                                    strokeWidth={6}
                                    filter="url(#glow)"
                                    className="transition-all"
                                    style={{
                                      animation:
                                        "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                                    }}
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
            </div>
          )}

          {/* Footer - Fixed on mobile and desktop */}
          {!isLoading && !error && cabins.length > 0 && (
            <div className="sticky bottom-0 z-10 flex items-center justify-between p-4 md:p-6 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-geograph"
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={!selectedCabinNo || isReserving}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-geograph font-medium flex items-center gap-2"
              >
                {isReserving && (
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                )}
                {isReserving ? "Creating Booking..." : "Reserve Selected Cabin"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
