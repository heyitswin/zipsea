"use client";

import { useState } from "react";

interface Cabin {
  cabinNumber: string;
  deck: string;
  deckNumber: number;
  position: string; // "Forward", "Midship", "Aft"
  side: string; // "Port", "Starboard"
  price: number;
  available: boolean;
}

interface CabinSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCabin: (cabinNumber: string) => void;
  cabinGradeName: string;
  totalPrice: number;
  passengerCount: number;
  cabins: Cabin[];
}

export default function CabinSelectionModal({
  isOpen,
  onClose,
  onSelectCabin,
  cabinGradeName,
  totalPrice,
  passengerCount,
  cabins,
}: CabinSelectionModalProps) {
  const [selectedCabin, setSelectedCabin] = useState<string | null>(null);

  if (!isOpen) return null;

  // Group cabins by deck
  const cabinsByDeck = cabins.reduce((acc, cabin) => {
    const deckKey = `Deck ${cabin.deckNumber}`;
    if (!acc[deckKey]) {
      acc[deckKey] = [];
    }
    acc[deckKey].push(cabin);
    return acc;
  }, {} as Record<string, Cabin[]>);

  // Sort decks by number (descending - higher decks first)
  const sortedDecks = Object.keys(cabinsByDeck).sort((a, b) => {
    const deckA = parseInt(a.replace("Deck ", ""));
    const deckB = parseInt(b.replace("Deck ", ""));
    return deckB - deckA;
  });

  const handleReserve = () => {
    if (selectedCabin) {
      onSelectCabin(selectedCabin);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-purple-obc px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="font-whitney text-[24px] text-dark-blue uppercase">
              Choose Your Cabin
            </h2>
            <p className="font-geograph text-[14px] text-dark-blue mt-1">
              {cabinGradeName} • ${totalPrice.toFixed(0)} total for{" "}
              {passengerCount} {passengerCount === 1 ? "guest" : "guests"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-blue hover:text-gray-700 transition-colors"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cabin List */}
        <div className="overflow-y-auto max-h-[calc(80vh-200px)] px-6 py-4">
          <p className="font-geograph text-[14px] text-gray-600 mb-4">
            Select your preferred deck and cabin number
          </p>

          {sortedDecks.map((deckKey) => (
            <div key={deckKey} className="mb-6">
              <h3 className="font-geograph font-bold text-[16px] text-dark-blue mb-3">
                {deckKey}
              </h3>
              <div className="space-y-2">
                {cabinsByDeck[deckKey]
                  .sort((a, b) => {
                    // Sort by position (Forward, Midship, Aft)
                    const posOrder = { Forward: 0, Midship: 1, Aft: 2 };
                    const posA =
                      posOrder[a.position as keyof typeof posOrder] ?? 3;
                    const posB =
                      posOrder[b.position as keyof typeof posOrder] ?? 3;
                    if (posA !== posB) return posA - posB;
                    // Then by cabin number
                    return a.cabinNumber.localeCompare(b.cabinNumber);
                  })
                  .map((cabin) => (
                    <label
                      key={cabin.cabinNumber}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        !cabin.available
                          ? "bg-gray-100 border-gray-300 cursor-not-allowed opacity-50"
                          : selectedCabin === cabin.cabinNumber
                          ? "bg-purple-obc border-dark-blue cursor-pointer"
                          : "bg-white border-gray-300 hover:border-dark-blue cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center flex-1">
                        <input
                          type="radio"
                          name="cabin"
                          value={cabin.cabinNumber}
                          checked={selectedCabin === cabin.cabinNumber}
                          onChange={(e) => setSelectedCabin(e.target.value)}
                          disabled={!cabin.available}
                          className="mr-3 w-4 h-4"
                        />
                        <div>
                          <div className="font-geograph font-medium text-[14px] text-dark-blue">
                            Cabin {cabin.cabinNumber}
                            {!cabin.available && " - Unavailable"}
                            {selectedCabin === cabin.cabinNumber && " ✓"}
                          </div>
                          <div className="font-geograph text-[12px] text-gray-600">
                            {cabin.position} • {cabin.side} side
                          </div>
                        </div>
                      </div>
                      {cabin.available && (
                        <div className="font-geograph font-bold text-[16px] text-dark-blue ml-4">
                          ${cabin.price.toFixed(0)}
                        </div>
                      )}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-sand px-6 py-4 flex justify-between items-center border-t border-gray-200">
          <button
            onClick={onClose}
            className="font-geograph font-medium text-[16px] px-6 py-3 rounded-full bg-white text-dark-blue border border-gray-300 hover:border-dark-blue transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReserve}
            disabled={!selectedCabin}
            className={`font-geograph font-medium text-[16px] px-6 py-3 rounded-full transition-colors ${
              selectedCabin
                ? "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {selectedCabin
              ? `Reserve Cabin ${selectedCabin}`
              : "Select a Cabin"}
          </button>
        </div>
      </div>
    </div>
  );
}
