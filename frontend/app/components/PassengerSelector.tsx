"use client";

import { useState, useRef, useEffect } from "react";

interface PassengerCount {
  adults: number;
  children: number;
  childAges: number[];
}

interface PassengerSelectorProps {
  value: PassengerCount;
  onChange: (value: PassengerCount) => void;
  className?: string;
}

export default function PassengerSelector({
  value,
  onChange,
  className = "",
}: PassengerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const updateAdults = (newCount: number) => {
    // Min 1, max 4 adults (cabin occupancy limit)
    const maxAdults = Math.min(4, 4 - value.children); // Ensure total doesn't exceed 4
    const adults = Math.max(1, Math.min(maxAdults, newCount));
    onChange({ ...value, adults });
  };

  const updateChildren = (newCount: number) => {
    // Min 0, max children depends on adults (total max 4)
    const maxChildren = 4 - value.adults;
    const children = Math.max(0, Math.min(maxChildren, newCount));

    // Adjust childAges array
    let childAges = [...value.childAges];
    if (children > childAges.length) {
      // Add default ages for new children (default to 8 years old)
      while (childAges.length < children) {
        childAges.push(8);
      }
    } else if (children < childAges.length) {
      // Remove extra ages
      childAges = childAges.slice(0, children);
    }

    onChange({ ...value, children, childAges });
  };

  const updateChildAge = (index: number, age: number) => {
    const childAges = [...value.childAges];
    // Min 0, max 17 years
    childAges[index] = Math.max(0, Math.min(17, age));
    onChange({ ...value, childAges });
  };

  const totalPassengers = value.adults + value.children;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-blue-500 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-gray-600"
          >
            <path
              d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="9"
              cy="7"
              r="4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="text-sm text-gray-600 font-medium">Passengers</div>
            <div className="text-base font-semibold text-gray-900">
              {totalPassengers} {totalPassengers === 1 ? "Guest" : "Guests"}
              {value.children > 0 && (
                <span className="text-sm text-gray-600 ml-1">
                  ({value.adults} {value.adults === 1 ? "adult" : "adults"},{" "}
                  {value.children} {value.children === 1 ? "child" : "children"}
                  )
                </span>
              )}
            </div>
          </div>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className={`text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-6 z-50">
          {/* Adults Counter */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-gray-900">Adults</div>
              <div className="text-sm text-gray-600">Ages 18+</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateAdults(value.adults - 1)}
                disabled={value.adults <= 1}
                className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 10H15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <span className="w-8 text-center font-semibold text-lg">
                {value.adults}
              </span>
              <button
                type="button"
                onClick={() => updateAdults(value.adults + 1)}
                disabled={value.adults + value.children >= 4}
                className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 5V15M5 10H15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Children Counter */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-gray-900">Children</div>
              <div className="text-sm text-gray-600">Ages 0-17</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateChildren(value.children - 1)}
                disabled={value.children <= 0}
                className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 10H15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <span className="w-8 text-center font-semibold text-lg">
                {value.children}
              </span>
              <button
                type="button"
                onClick={() => updateChildren(value.children + 1)}
                disabled={value.adults + value.children >= 4}
                className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 5V15M5 10H15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Child Ages */}
          {value.children > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">
                Child Ages (at time of cruise)
              </div>
              <div className="grid grid-cols-2 gap-3">
                {value.childAges.map((age, index) => (
                  <div key={index}>
                    <label className="text-xs text-gray-600 mb-1 block">
                      Child {index + 1}
                    </label>
                    <select
                      value={age}
                      onChange={(e) =>
                        updateChildAge(index, parseInt(e.target.value))
                      }
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      {Array.from({ length: 18 }, (_, i) => i).map(
                        (ageOption) => (
                          <option key={ageOption} value={ageOption}>
                            {ageOption} {ageOption === 0 ? "year" : "years"}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Child ages are required for accurate pricing
              </div>
            </div>
          )}

          {/* Done Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
