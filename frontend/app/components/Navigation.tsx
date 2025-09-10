"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  fetchShips,
  Ship,
  fetchAvailableSailingDates,
  AvailableSailingDate,
  searchCruises,
} from "../../lib/api";
import { useAlert } from "../../components/GlobalAlertProvider";
import { useUser } from "../hooks/useClerkHooks";
import { useAdmin } from "../hooks/useAdmin";
import { SignOutButton } from "@clerk/nextjs";
import LoginSignupModal from "./LoginSignupModal";
import { createSlugFromCruise } from "../../lib/slug";
import { trackSearch } from "../../lib/analytics";
import SearchResultsModal from "./SearchResultsModal";

interface NavigationProps {
  showMinimizedSearch?: boolean;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  selectedShip?: Ship | null;
  onShipSelect?: (ship: Ship) => void;
  dateValue?: string;
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date | null;
  onSearchClick?: () => void;
}

export default function Navigation({
  showMinimizedSearch = false,
  searchValue = "",
  onSearchValueChange,
  selectedShip = null,
  onShipSelect,
  dateValue = "",
  onDateSelect,
  selectedDate = null,
  onSearchClick,
}: NavigationProps) {
  const { showAlert } = useAlert();
  const pathname = usePathname();
  const router = useRouter();
  const isCruiseDetailPage = pathname?.startsWith("/cruise/") || false;
  const [ships, setShips] = useState<Ship[]>([]);
  const [filteredShips, setFilteredShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Mobile menu states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Search state
  const [isSearching, setIsSearching] = useState(false);

  // Dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Date picker states
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isDateDropdownClosing, setIsDateDropdownClosing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // User authentication states
  const { isSignedIn, user, isLoaded } = useUser();
  const { isAdmin } = useAdmin();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Internal states for when no callbacks are provided
  const [internalSearchValue, setInternalSearchValue] = useState("");
  const [internalSelectedShip, setInternalSelectedShip] = useState<Ship | null>(
    null,
  );
  const [internalDateValue, setInternalDateValue] = useState("");
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | null>(
    null,
  );

  // Available sailing dates states
  const [availableSailingDates, setAvailableSailingDates] = useState<
    AvailableSailingDate[]
  >([]);
  const [isLoadingSailingDates, setIsLoadingSailingDates] = useState(false);

  // Search results modal states
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [searchModalParams, setSearchModalParams] = useState<{
    shipId: number;
    shipName: string;
    cruiseLineName: string;
    date: Date;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Handle scroll for navigation transition
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load available sailing dates for a ship
  const loadAvailableSailingDates = async (shipId: number) => {
    setIsLoadingSailingDates(true);
    const dates = await fetchAvailableSailingDates(shipId);
    setAvailableSailingDates(dates);
    setIsLoadingSailingDates(false);
  };

  // Load ships on component mount
  useEffect(() => {
    const loadShips = async () => {
      try {
        setIsLoading(true);
        const shipsData = await fetchShips();
        setShips(shipsData);
        setFilteredShips(shipsData);
      } catch (err) {
        console.error("Failed to load ships:", err);
        showAlert("Failed to load ships. Please try again later.");
        setShips([]);
        setFilteredShips([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadShips();
  }, [showAlert]);

  // Filter ships based on search input
  useEffect(() => {
    const currentSearchValue = getCurrentSearchValue();
    if (!currentSearchValue.trim()) {
      setFilteredShips(ships);
      setHighlightedIndex(-1);
      return;
    }

    const searchLower = currentSearchValue.toLowerCase();
    const filtered = ships.filter((ship) => {
      const shipName = ship.name.toLowerCase();
      const cruiseLineName = ship.cruiseLineName.toLowerCase();

      // Search in ship name or cruise line name
      return (
        shipName.includes(searchLower) || cruiseLineName.includes(searchLower)
      );
    });

    // Sort by relevance (exact matches first, then starts with, then contains)
    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Exact match
      if (aName === searchLower) return -1;
      if (bName === searchLower) return 1;

      // Starts with
      if (aName.startsWith(searchLower) && !bName.startsWith(searchLower))
        return -1;
      if (bName.startsWith(searchLower) && !aName.startsWith(searchLower))
        return 1;

      // Alphabetical for equal relevance
      return aName.localeCompare(bName);
    });

    setFilteredShips(filtered);
    setHighlightedIndex(-1);
  }, [searchValue, internalSearchValue, ships]);

  // Helper functions to get current values (props or internal state)
  const getCurrentSearchValue = () => searchValue || internalSearchValue;
  const getCurrentSelectedShip = () => selectedShip || internalSelectedShip;
  const getCurrentDateValue = () => dateValue || internalDateValue;
  const getCurrentSelectedDate = () => selectedDate || internalSelectedDate;

  // Helper function to format user display name
  const getUserDisplayName = () => {
    if (!user) return "";

    const firstName = user.firstName || "";
    const lastName = user.lastName || "";

    if (firstName && lastName) {
      return `${firstName} ${lastName.charAt(0)}.`;
    } else if (firstName) {
      return firstName;
    } else if (user.primaryEmailAddress?.emailAddress) {
      return user.primaryEmailAddress.emailAddress.split("@")[0];
    }

    return "User";
  };

  // Helper function to get user avatar
  const getUserAvatarSrc = () => {
    return user?.imageUrl || null;
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle ship dropdown
      if (
        dropdownRef.current &&
        inputRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node) &&
        isDropdownOpen &&
        !isDropdownClosing
      ) {
        setIsDropdownClosing(true);
        setTimeout(() => {
          setIsDropdownOpen(false);
          setIsDropdownClosing(false);
        }, 150);
      }

      // Handle date dropdown
      if (
        dateDropdownRef.current &&
        dateInputRef.current &&
        !dateDropdownRef.current.contains(event.target as Node) &&
        !dateInputRef.current.contains(event.target as Node) &&
        isDateDropdownOpen &&
        !isDateDropdownClosing
      ) {
        setIsDateDropdownClosing(true);
        setTimeout(() => {
          setIsDateDropdownOpen(false);
          setIsDateDropdownClosing(false);
        }, 150);
      }

      // Handle user dropdown
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node) &&
        isUserDropdownOpen
      ) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [
    isDropdownOpen,
    isDropdownClosing,
    isDateDropdownOpen,
    isDateDropdownClosing,
    isUserDropdownOpen,
  ]);

  // Search input handlers
  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (onSearchValueChange) {
      onSearchValueChange(value);
    } else {
      // If no callback provided, update internal state
      setInternalSearchValue(value);
    }
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || filteredShips.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredShips.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredShips.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredShips.length) {
          handleShipSelect(filteredShips[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsDropdownClosing(true);
        setTimeout(() => {
          setIsDropdownOpen(false);
          setIsDropdownClosing(false);
        }, 150);
        break;
    }
  };

  const handleShipSelect = (ship: Ship) => {
    if (onShipSelect) {
      onShipSelect(ship);
    } else {
      // If no callback provided, update internal state
      setInternalSearchValue(ship.name);
      setInternalSelectedShip(ship);
    }
    setIsDropdownClosing(true);
    setTimeout(() => {
      setIsDropdownOpen(false);
      setIsDropdownClosing(false);
    }, 150);
    inputRef.current?.blur();

    // Load available sailing dates for the selected ship
    loadAvailableSailingDates(ship.id);
  };

  // Date picker handlers
  const handleDateInputFocus = () => {
    setIsDateDropdownOpen(true);
    setCurrentMonth(new Date());
  };

  const handleDateSelect = (date: Date) => {
    if (onDateSelect) {
      onDateSelect(date);
    } else {
      // If no callback provided, update internal state
      setInternalSelectedDate(date);
      const formattedDate = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setInternalDateValue(formattedDate);
    }
    setIsDateDropdownClosing(true);
    setTimeout(() => {
      setIsDateDropdownOpen(false);
      setIsDateDropdownClosing(false);
    }, 150);
    dateInputRef.current?.blur();
  };

  const handlePreviousMonth = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();

    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      const prevMonth = prev.getMonth() - 1;
      const prevYear = prev.getFullYear();

      if (
        prevYear < currentYear ||
        (prevYear === currentYear && prevMonth < currentMonthIndex)
      ) {
        return prev;
      }

      newDate.setMonth(prevMonth);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  // Calendar utilities
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isPreviousMonthDisabled = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();

    const displayYear = currentMonth.getFullYear();
    const displayMonthIndex = currentMonth.getMonth();

    return displayYear <= currentYear && displayMonthIndex <= currentMonthIndex;
  };

  const isDateInPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Check if a date has available sailings for the selected ship
  const hasAvailableSailing = (date: Date) => {
    const currentShip = getCurrentSelectedShip();
    if (!currentShip || availableSailingDates.length === 0) {
      return true; // If no ship selected or no data, don't restrict
    }

    const dateString = date.toISOString().split("T")[0];
    return availableSailingDates.some((sailingDate) => {
      return sailingDate.sailingDates.some((sailing) => {
        const sailingDateOnly = sailing.split("T")[0];
        return sailingDateOnly === dateString;
      });
    });
  };

  // Check if a date should be highlighted (has sailings)
  const isHighlightedDate = (date: Date) => {
    const currentShip = getCurrentSelectedShip();
    if (!currentShip || availableSailingDates.length === 0) {
      return false; // Don't highlight if no ship selected
    }
    return hasAvailableSailing(date) && !isDateInPast(date);
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
    const days = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  // Default search handler when no callback is provided
  const handleSearch = async () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      const currentShip = getCurrentSelectedShip();
      const currentDate = getCurrentSelectedDate();

      if (!currentShip) {
        showAlert("Please select a ship");
        return;
      }

      if (!currentDate) {
        showAlert("Please select a departure date");
        return;
      }

      // Start searching
      setIsSearching(true);

      try {
        const searchParams = {
          shipId: currentShip.id,
          shipName: currentShip.name,
          departureDate: currentDate.toISOString().split("T")[0],
        };

        const results = await searchCruises(searchParams);

        // Track search event
        trackSearch({
          destination: currentShip.name,
          departurePort: undefined,
          cruiseLine: currentShip.cruiseLineName,
          dateRange: currentDate.toISOString().split("T")[0],
          resultsCount: results.length,
        });

        // Handle results
        if (results.length === 0) {
          showAlert(
            "No cruises found for the selected ship and date. Try different dates or ships.",
          );
        } else if (results.length === 1) {
          // Navigate directly to the cruise detail page
          const cruise = results[0];
          const slug = createSlugFromCruise(cruise);
          router.push(`/cruise/${slug}`);
        } else {
          // Show search results in modal
          setSearchModalParams({
            shipId: currentShip.id,
            shipName: currentShip.name,
            cruiseLineName: currentShip.cruiseLineName || "",
            date: currentDate,
          });
          setIsSearchResultsOpen(true);
        }
      } catch (error) {
        console.error("Search error:", error);
        showAlert("Failed to search cruises. Please try again.");
      } finally {
        setIsSearching(false);
      }
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 py-[12px] md:py-[20px] px-[28px] transition-all duration-300 ease-in-out h-[64px] md:h-auto ${
          isScrolled ? "bg-white shadow-lg" : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between h-[40px] md:h-[44px]">
          {/* Logo and Search Bar Container */}
          <div className="flex items-center">
            {/* Logo - Responsive sizing */}
            <div className="w-[83px] md:w-[110px]">
              <a href="/">
                <Image
                  src={
                    isScrolled || (isCruiseDetailPage && !isScrolled)
                      ? "/images/zipsea-logo-blue.svg"
                      : "/images/zipsea-logo.svg"
                  }
                  alt="Zipsea"
                  width={110}
                  height={40}
                  className={`${isScrolled || (isCruiseDetailPage && !isScrolled) ? "" : "brightness-0 invert"} w-[83px] md:w-[110px] h-auto`}
                  priority
                />
              </a>
            </div>

            {/* Browse Cruises Link - Admin only, Hidden on mobile */}
            {isAdmin && (
              <a
                href="/cruises"
                className={`hidden md:block ml-8 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isScrolled || isCruiseDetailPage
                    ? "text-dark-blue hover:bg-blue-50"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Browse Cruises
              </a>
            )}

            {/* Minimized Search Bar - Show when scrolled on all pages (Hidden on Mobile) */}
            {isScrolled && (
              <div className="hidden md:block ml-[28px] w-[600px] transition-all duration-300 ease-in-out">
                <div className="h-[48px] bg-white rounded-full flex items-center overflow-hidden border border-gray-separator relative">
                  {/* Select Ship Input */}
                  <div className="flex-1 flex items-center px-4 h-full">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 34 27"
                      fill="none"
                      className="mr-3"
                      style={{ shapeRendering: "geometricPrecision" }}
                    >
                      <path
                        d="M32.8662 25.4355C32.0707 25.4334 31.2888 25.2282 30.5947 24.8395C29.9005 24.4508 29.3171 23.8914 28.8995 23.2142C28.478 23.8924 27.8906 24.4519 27.1926 24.8398C26.4947 25.2278 25.7094 25.4314 24.9109 25.4314C24.1124 25.4314 23.3271 25.2278 22.6292 24.8398C21.9313 24.4519 21.3438 23.8924 20.9223 23.2142C20.5031 23.894 19.9167 24.4551 19.2191 24.844C18.5215 25.2329 17.7359 25.4365 16.9372 25.4355C14.8689 25.4355 11.4533 22.2962 9.31413 20.0961C9.17574 19.9536 8.99997 19.8529 8.80698 19.8057C8.61399 19.7585 8.4116 19.7666 8.22303 19.8292C8.03445 19.8917 7.86733 20.0062 7.74084 20.1594C7.61435 20.3126 7.53361 20.4984 7.50788 20.6954C7.36621 22.0086 6.83213 23.3105 5.25396 23.3105C4.30812 23.2648 3.39767 22.9367 2.64011 22.3686C1.88255 21.8004 1.31265 21.0183 1.00396 20.123"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M18 20.123L22.8875 18.9005C24.0268 18.6152 25.0946 18.097 26.0236 17.3784C26.9526 16.6598 27.7226 15.7566 28.285 14.7255L32.875 6.31055L1 12.6855"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M25.2861 7.8278L18.0002 4.18555L4.18772 6.31055"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M6.31254 11.6236L4.18754 6.31109L1.9662 2.60934C1.86896 2.4482 1.81632 2.26409 1.81369 2.0759C1.81107 1.8877 1.85854 1.7022 1.95125 1.53841C2.04396 1.37461 2.17857 1.23843 2.34127 1.14382C2.50397 1.0492 2.68891 0.999569 2.87712 1H6.31254L11.54 5.18059"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Select Ship"
                      value={getCurrentSearchValue()}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onKeyDown={handleKeyDown}
                      className="flex-1 text-[18px] font-geograph text-dark-blue placeholder-dark-blue tracking-tight outline-none bg-transparent"
                      style={{ letterSpacing: "-0.02em", color: "#2F2F2F" }}
                    />
                  </div>

                  {/* Separator */}
                  <div className="w-[1px] h-[calc(100%-12px)] bg-gray-separator mx-2" />

                  {/* Departure Date Input */}
                  <div className="flex-1 flex items-center px-4 h-full">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 33 33"
                      fill="none"
                      className="mr-3"
                      style={{ shapeRendering: "geometricPrecision" }}
                    >
                      <path
                        d="M29.4667 5.06836H3.03333C1.91035 5.06836 1 5.97868 1 7.10161V29.4674C1 30.5903 1.91035 31.5006 3.03333 31.5006H29.4667C30.5896 31.5006 31.5 30.5903 31.5 29.4674V7.10161C31.5 5.97868 30.5896 5.06836 29.4667 5.06836Z"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M1 13.1992H31.5"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M9.13379 8.11638V1"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d="M23.3662 8.11638V1"
                        stroke="#2F2F2F"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <input
                      ref={dateInputRef}
                      type="text"
                      placeholder="Departure Date"
                      value={getCurrentDateValue()}
                      onFocus={handleDateInputFocus}
                      readOnly
                      className="flex-1 text-[18px] font-geograph text-dark-blue placeholder-dark-blue tracking-tight outline-none bg-transparent cursor-pointer"
                      style={{ letterSpacing: "-0.02em", color: "#2F2F2F" }}
                    />
                  </div>

                  {/* Search Button */}
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="absolute right-1.5 w-[40px] h-[40px] bg-dark-blue rounded-full flex items-center justify-center hover:bg-dark-blue/90 transition-colors disabled:opacity-80"
                  >
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 33 33"
                        fill="none"
                        style={{ shapeRendering: "geometricPrecision" }}
                      >
                        <path
                          d="M19.4999 25.5644C25.3213 23.0904 28.0349 16.3656 25.5608 10.5442C23.0868 4.72278 16.362 2.0092 10.5406 4.48324C4.71919 6.95728 2.00561 13.6821 4.47965 19.5035C6.95369 25.3249 13.6785 28.0385 19.4999 25.5644Z"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d="M23.1172 23.123L31.9998 32.0069"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hamburger Menu Button (Mobile Only) */}
          <button
            className="md:hidden flex flex-col items-center justify-center w-6 h-6 space-y-1"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`block w-6 h-0.5 transition-all duration-300 ${
                isScrolled || (isCruiseDetailPage && !isScrolled)
                  ? "bg-[#0E1B4D]"
                  : "bg-white"
              } ${isMobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block w-6 h-0.5 transition-all duration-300 ${
                isScrolled || (isCruiseDetailPage && !isScrolled)
                  ? "bg-[#0E1B4D]"
                  : "bg-white"
              } ${isMobileMenuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-6 h-0.5 transition-all duration-300 ${
                isScrolled || (isCruiseDetailPage && !isScrolled)
                  ? "bg-[#0E1B4D]"
                  : "bg-white"
              } ${isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>

          {/* Navigation Links and Button (Desktop Only) */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="/why-zipsea"
              className={`text-[16px] font-medium font-geograph hover:opacity-80 transition-all duration-300 ${
                isScrolled || (isCruiseDetailPage && !isScrolled)
                  ? "text-[#0E1B4D]"
                  : "text-white"
              }`}
            >
              Why Zipsea
            </a>
            <a
              href="/faqs"
              className={`text-[16px] font-medium font-geograph hover:opacity-80 transition-all duration-300 ${
                isScrolled || (isCruiseDetailPage && !isScrolled)
                  ? "text-[#0E1B4D]"
                  : "text-white"
              }`}
            >
              FAQs
            </a>

            {/* User Authentication Area */}
            {isLoaded && (
              <>
                {isSignedIn && user ? (
                  // User Menu
                  <div className="relative" ref={userDropdownRef}>
                    <button
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="flex items-center gap-3 hover:opacity-80 transition-all duration-300"
                    >
                      {/* User Avatar */}
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                        {getUserAvatarSrc() ? (
                          <img
                            src={getUserAvatarSrc()!}
                            alt={getUserDisplayName()}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center text-[12px] font-medium ${
                              isScrolled || (isCruiseDetailPage && !isScrolled)
                                ? "text-[#0E1B4D]"
                                : "text-white"
                            }`}
                          >
                            {getUserDisplayName().charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* User Display Name */}
                      <span
                        className={`text-[16px] font-medium font-geograph ${
                          isScrolled || (isCruiseDetailPage && !isScrolled)
                            ? "text-[#0E1B4D]"
                            : "text-white"
                        }`}
                      >
                        {getUserDisplayName()}
                      </span>
                    </button>

                    {/* User Dropdown Menu */}
                    {isUserDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[10000]">
                        {isAdmin && (
                          <a
                            href="/admin"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 font-geograph"
                          >
                            Admin Dashboard
                          </a>
                        )}
                        <SignOutButton redirectUrl="/">
                          <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 font-geograph">
                            Log out
                          </button>
                        </SignOutButton>
                      </div>
                    )}
                  </div>
                ) : (
                  // Sign up/Log in Button
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className={`px-4 py-1.5 border rounded-full text-[16px] font-medium font-geograph hover:opacity-80 transition-all duration-300 ${
                      isScrolled || (isCruiseDetailPage && !isScrolled)
                        ? "border-[#0E1B4D] text-[#0E1B4D] bg-transparent"
                        : "border-white text-white bg-transparent"
                    }`}
                  >
                    Sign up/Log in
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Ship Dropdown for Minimized Search */}
      {isScrolled && isDropdownOpen && (
        <div
          ref={dropdownRef}
          className={`fixed bg-white rounded-[10px] z-[10000] ${
            isDropdownClosing ? "dropdown-fade-out" : "dropdown-fade-in"
          }`}
          style={{
            boxShadow: "0px 1px 14px rgba(0, 0, 0, 0.25)",
            top: "64px",
            left: "166px",
            width: "300px",
            position: "fixed",
          }}
        >
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar rounded-[10px]">
            {isLoading ? (
              <div className="px-6 py-3 font-geograph text-[18px] text-gray-500 font-normal">
                Loading ships...
              </div>
            ) : filteredShips.length > 0 ? (
              filteredShips.map((ship, index) => (
                <div
                  key={`${ship.id}-${index}`}
                  onClick={() => handleShipSelect(ship)}
                  className={`px-6 py-3 cursor-pointer font-geograph text-dark-blue dropdown-item-hover ${
                    index === highlightedIndex
                      ? "bg-light-blue bg-opacity-20"
                      : "hover:bg-light-blue hover:bg-opacity-10"
                  }`}
                  style={{ letterSpacing: "-0.02em" }}
                >
                  <div className="font-normal text-[18px]">{ship.name}</div>
                  <div className="font-normal text-[14px] text-gray-500 mt-0.5">
                    {ship.cruiseLineName}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-3 font-geograph text-[18px] text-gray-500 font-normal">
                No ships found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date Picker Dropdown for Minimized Search */}
      {isScrolled && isDateDropdownOpen && (
        <div
          ref={dateDropdownRef}
          className={`fixed bg-white rounded-[10px] z-[10000] ${
            isDateDropdownClosing ? "dropdown-fade-out" : "dropdown-fade-in"
          }`}
          style={{
            boxShadow: "0px 1px 14px rgba(0, 0, 0, 0.25)",
            top: "64px",
            left: "466px",
            position: "fixed",
          }}
        >
          <div className="p-4 font-geograph">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePreviousMonth}
                disabled={isPreviousMonthDisabled()}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                  isPreviousMonthDisabled()
                    ? "cursor-not-allowed opacity-30"
                    : "hover:bg-gray-100 cursor-pointer"
                }`}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 36 36"
                  fill="none"
                  style={{ shapeRendering: "geometricPrecision" }}
                  className={isPreviousMonthDisabled() ? "opacity-50" : ""}
                >
                  <rect
                    x="35.5"
                    y="35.5"
                    width="35"
                    height="35"
                    rx="9.5"
                    transform="rotate(-180 35.5 35.5)"
                    stroke="#D9D9D9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M15.125 18.125L20 13.25"
                    stroke="#0E1B4D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M15.125 18.125L20 23"
                    stroke="#0E1B4D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </button>
              <h3 className="font-medium text-[18px] text-dark-blue">
                {currentMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <button
                onClick={handleNextMonth}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 36 36"
                  fill="none"
                  style={{ shapeRendering: "geometricPrecision" }}
                  className="rotate-180"
                >
                  <rect
                    x="35.5"
                    y="35.5"
                    width="35"
                    height="35"
                    rx="9.5"
                    transform="rotate(-180 35.5 35.5)"
                    stroke="#D9D9D9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M15.125 18.125L20 13.25"
                    stroke="#0E1B4D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M15.125 18.125L20 23"
                    stroke="#0E1B4D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </button>
            </div>

            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <div
                  key={index}
                  className="w-[51px] h-12 flex items-center justify-center text-[14px] font-medium text-gray-600"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendarDays().map((day, index) => {
                if (day === null) {
                  return <div key={index} className="h-[51px]" />;
                }

                const date = new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  day,
                );
                const isPast = isDateInPast(date);
                const hasAvailable = hasAvailableSailing(date);
                const isHighlighted = isHighlightedDate(date);
                const currentSelectedDate = getCurrentSelectedDate();
                const isSelected =
                  currentSelectedDate &&
                  date.getDate() === currentSelectedDate.getDate() &&
                  date.getMonth() === currentSelectedDate.getMonth() &&
                  date.getFullYear() === currentSelectedDate.getFullYear();

                const isDisabled =
                  isPast ||
                  (!!getCurrentSelectedShip() &&
                    availableSailingDates.length > 0 &&
                    !hasAvailable);

                return (
                  <button
                    key={index}
                    onClick={() => !isDisabled && handleDateSelect(date)}
                    className={`w-[51px] h-[51px] flex items-center justify-center text-[16px] rounded-full transition-all ${
                      isDisabled
                        ? "text-gray-400 font-normal cursor-not-allowed opacity-50"
                        : "text-dark-blue font-medium hover:bg-light-blue hover:bg-opacity-20 cursor-pointer"
                    } ${isSelected ? "bg-light-blue text-white" : ""} ${
                      isHighlighted && !isSelected && !isDisabled
                        ? "ring-2 ring-green-500 ring-offset-1"
                        : ""
                    }`}
                    disabled={isDisabled}
                    title={
                      getCurrentSelectedShip() && !hasAvailable && !isPast
                        ? "No sailings available on this date"
                        : ""
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Modal */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[10001] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Menu Content */}
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between p-6 border-b border-gray-separator">
              <Image
                src="/images/zipsea-logo-blue.svg"
                alt="Zipsea"
                width={110}
                height={40}
                className="w-[83px] h-auto"
                priority
              />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2"
                aria-label="Close menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18"
                    stroke="#0E1B4D"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 6L18 18"
                    stroke="#0E1B4D"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 flex flex-col justify-center px-8 space-y-8">
              <a
                href="/why-zipsea"
                className="text-dark-blue text-[24px] font-medium font-geograph py-4 border-b border-gray-separator"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Why Zipsea
              </a>
              <a
                href="/faqs"
                className="text-dark-blue text-[24px] font-medium font-geograph py-4 border-b border-gray-separator"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                FAQs
              </a>

              {/* User Authentication Area - Mobile */}
              {isLoaded && (
                <>
                  {isSignedIn && user ? (
                    <div className="mt-8 space-y-4">
                      {/* User Info */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                          {getUserAvatarSrc() ? (
                            <img
                              src={getUserAvatarSrc()!}
                              alt={getUserDisplayName()}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[14px] font-medium text-dark-blue">
                              {getUserDisplayName().charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-dark-blue text-[16px] font-medium font-geograph">
                          {getUserDisplayName()}
                        </span>
                      </div>

                      {/* Admin Dashboard Button */}
                      {isAdmin && (
                        <a
                          href="/admin"
                          className="block w-full px-6 py-3 border border-gray-separator text-dark-blue bg-transparent rounded-full text-[18px] font-medium font-geograph hover:opacity-80 transition-opacity text-center"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Admin Dashboard
                        </a>
                      )}

                      {/* Logout Button */}
                      <SignOutButton redirectUrl="/">
                        <button
                          className="w-full px-6 py-3 border border-gray-separator text-dark-blue bg-transparent rounded-full text-[18px] font-medium font-geograph hover:opacity-80 transition-opacity"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Log out
                        </button>
                      </SignOutButton>
                    </div>
                  ) : (
                    <button
                      className="mt-8 px-6 py-3 border border-gray-separator text-dark-blue bg-transparent rounded-full text-[18px] font-medium font-geograph hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsLoginModalOpen(true);
                      }}
                    >
                      Sign up/Log in
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login/Signup Modal */}
      <LoginSignupModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          // Optionally refresh or handle success
        }}
      />

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={isSearchResultsOpen}
        onClose={() => setIsSearchResultsOpen(false)}
        searchParams={searchModalParams}
      />
    </>
  );
}
