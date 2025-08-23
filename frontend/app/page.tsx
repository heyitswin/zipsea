'use client';
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { fetchShips, Ship, searchCruises, Cruise, fetchLastMinuteDeals, LastMinuteDeals } from "../lib/api";
import { createSlugFromCruise } from "../lib/slug";

export default function Home() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const [ships, setShips] = useState<Ship[]>([]);
  const [filteredShips, setFilteredShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Date picker states
  const [dateValue, setDateValue] = useState("");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);
  const [isDateDropdownClosing, setIsDateDropdownClosing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  
  // Cruise search states
  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Last minute deals states
  const [lastMinuteDeals, setLastMinuteDeals] = useState<LastMinuteDeals[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [dealsError, setDealsError] = useState<string | null>(null);

  // Load ships on component mount
  useEffect(() => {
    const loadShips = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const shipsData = await fetchShips();
        setShips(shipsData);
        setFilteredShips(shipsData);
      } catch (err) {
        console.error('Failed to load ships:', err);
        setError('Failed to load ships. Please try again later.');
        // Fallback to empty array
        setShips([]);
        setFilteredShips([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadShips();
  }, []);

  // Load last minute deals on component mount
  useEffect(() => {
    const loadLastMinuteDeals = async () => {
      try {
        setIsLoadingDeals(true);
        setDealsError(null);
        const deals = await fetchLastMinuteDeals();
        setLastMinuteDeals(deals);
      } catch (err) {
        console.error('Failed to load last minute deals:', err);
        setDealsError('Failed to load last minute deals. Please try again later.');
        setLastMinuteDeals([]);
      } finally {
        setIsLoadingDeals(false);
      }
    };

    loadLastMinuteDeals();
  }, []);

  // Filter ships based on search input
  useEffect(() => {
    if (!searchValue.trim()) {
      setFilteredShips(ships);
      setHighlightedIndex(-1);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = ships.filter(ship => {
      const shipName = ship.name.toLowerCase();
      const cruiseLineName = ship.cruiseLineName.toLowerCase();
      
      // Search in ship name or cruise line name
      return shipName.includes(searchLower) || cruiseLineName.includes(searchLower);
    });
    
    // Sort by relevance (exact matches first, then starts with, then contains)
    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // Exact match
      if (aName === searchLower) return -1;
      if (bName === searchLower) return 1;
      
      // Starts with
      if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
      if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;
      
      // Alphabetical for equal relevance
      return aName.localeCompare(bName);
    });
    
    setFilteredShips(filtered);
    setHighlightedIndex(-1);
  }, [searchValue, ships]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle ship dropdown
      if (
        dropdownRef.current &&
        inputRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node) &&
        isDropdownOpen && // Only trigger if dropdown is actually open
        !isDropdownClosing // Don't trigger if already closing
      ) {
        // Start fade-out animation
        setIsDropdownClosing(true);
        // Close dropdown after animation completes
        setTimeout(() => {
          setIsDropdownOpen(false);
          setIsDropdownClosing(false);
        }, 150); // Match the CSS animation duration
      }
      
      // Handle date dropdown
      if (
        dateDropdownRef.current &&
        dateInputRef.current &&
        !dateDropdownRef.current.contains(event.target as Node) &&
        !dateInputRef.current.contains(event.target as Node) &&
        isDateDropdownOpen && // Only trigger if dropdown is actually open
        !isDateDropdownClosing // Don't trigger if already closing
      ) {
        // Start fade-out animation
        setIsDateDropdownClosing(true);
        // Close dropdown after animation completes
        setTimeout(() => {
          setIsDateDropdownOpen(false);
          setIsDateDropdownClosing(false);
        }, 150); // Match the CSS animation duration
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen, isDropdownClosing, isDateDropdownOpen, isDateDropdownClosing]); // Add dependencies to ensure proper behavior

  const handleInputFocus = () => {
    setIsInputFocused(true);
    setIsDropdownOpen(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || filteredShips.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredShips.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredShips.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredShips.length) {
          handleShipSelect(filteredShips[highlightedIndex]);
        }
        break;
      case 'Escape':
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
    setSearchValue(ship.name);
    setSelectedShip(ship); // Store the selected ship
    setIsDropdownClosing(true);
    // Close dropdown after animation completes
    setTimeout(() => {
      setIsDropdownOpen(false);
      setIsDropdownClosing(false);
    }, 150);
    inputRef.current?.blur();
  };

  // Date picker handlers
  const handleDateInputFocus = () => {
    setIsDateInputFocused(true);
    setIsDateDropdownOpen(true);
    // Always set to current month when first opening
    setCurrentMonth(new Date());
  };

  const handleDateInputBlur = () => {
    setIsDateInputFocused(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    setDateValue(formattedDate);
    setIsDateDropdownClosing(true);
    // Close dropdown after animation completes
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
    
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      const prevMonth = prev.getMonth() - 1;
      const prevYear = prev.getFullYear();
      
      // Don't allow navigation to months before current month/year
      if (prevYear < currentYear || (prevYear === currentYear && prevMonth < currentMonthIndex)) {
        return prev; // Return current state without changing
      }
      
      newDate.setMonth(prevMonth);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
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

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  // Handle cruise card clicks
  const handleCruiseClick = (cruise: Cruise) => {
    try {
      // Generate slug for the cruise
      const slug = createSlugFromCruise({
        id: cruise.id,
        shipName: cruise.ship_name || selectedShip?.name || 'unknown-ship',
        sailingDate: cruise.departure_date || cruise.sailing_date || cruise.departureDate,
      });
      router.push(`/cruise/${slug}`);
    } catch (error) {
      console.error('Failed to create slug for cruise:', cruise, error);
      // Fallback to basic navigation with cruise ID
      router.push(`/cruise-details?id=${cruise.id}`);
    }
  };

  // Search for cruises
  const handleSearchCruises = async () => {
    if (!selectedShip) {
      setSearchError('Please select a ship');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCruises([]);

    try {
      const searchParams = {
        shipId: selectedShip.id,
        shipName: selectedShip.name,
        ...(selectedDate && { departureDate: selectedDate.toISOString().split('T')[0] })
      };

      const results = await searchCruises(searchParams);
      
      // If exactly one cruise found with both ship and date, navigate directly
      if (results.length === 1 && selectedDate) {
        handleCruiseClick(results[0]);
        return;
      } else if (results.length === 0) {
        setSearchError('No cruises found for your search criteria');
      } else {
        setCruises(results);
      }
    } catch (err) {
      console.error('Error searching cruises:', err);
      setSearchError('Failed to search cruises. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-light-blue py-[30px] px-[60px]">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="w-[110px]">
            <Image
              src="/images/zipsea-logo.svg"
              alt="Zipsea"
              width={110}
              height={40}
              className="brightness-0 invert"
              priority
            />
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <a 
              href="#" 
              className="text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              About us
            </a>
            <a 
              href="#" 
              className="text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              FAQ
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[720px] bg-light-blue pt-[100px] overflow-visible z-20">
        {/* Floating Swimmers - Behind all content */}
        <div className="absolute inset-0 z-0">
          {/* Swimmer 1 */}
          <div className="absolute swimmer-float-1" style={{ 
            top: '15%', 
            left: '8%',
            width: 'auto',
            height: 'auto'
          }}>
            <Image
              src="/images/swimmer-1.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{ 
                width: '140px',
                height: 'auto'
              }}
            />
          </div>

          {/* Swimmer 2 */}
          <div className="absolute swimmer-float-2" style={{ 
            top: '60%', 
            right: '12%',
            width: 'auto',
            height: 'auto'
          }}>
            <Image
              src="/images/swimmer-2.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{ 
                width: '140px',
                height: 'auto'
              }}
            />
          </div>

          {/* Swimmer 3 */}
          <div className="absolute swimmer-float-3" style={{ 
            bottom: '20%', 
            left: '20%',
            width: 'auto',
            height: 'auto'
          }}>
            <Image
              src="/images/swimmer-3.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{ 
                width: '140px',
                height: 'auto'
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-[calc(720px-100px)] px-4 -mt-[80px]">
          {/* Main Heading */}
          <h1 className="text-sunshine text-[72px] font-whitney uppercase text-center leading-none tracking-tight mb-10">
            The most onboard credit<br />
            Simple as that
          </h1>

          {/* Subheading */}
          <p className="text-white text-[18px] font-medium font-geograph tracking-tight text-center w-full max-w-[900px] mb-5">
            We pass on the absolute maximum onboard credit allowed by the cruise lines - every single booking
          </p>

          {/* Search Input Container - Now relative for dropdown positioning */}
          <div className="w-full max-w-[900px] relative z-30">
            {/* Search Pill */}
            <div className="h-[90px] bg-white rounded-full flex items-center overflow-hidden p-2 relative" style={{ boxShadow: '0 0 0 5px rgba(255, 255, 255, 0.3)' }}>
              {/* Select Ship Input */}
              <div className="flex-1 flex items-center px-6 h-full">
                <Image
                  src="/images/ship.svg"
                  alt="Ship"
                  width={32}
                  height={32}
                  className="mr-4"
                  style={{ filter: 'brightness(0) saturate(100%) invert(7%) sepia(23%) saturate(3985%) hue-rotate(199deg) brightness(94%) contrast(96%)' }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={isInputFocused && !searchValue ? "" : "Select Ship"}
                  value={searchValue}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="flex-1 text-[24px] font-geograph text-dark-blue placeholder-dark-blue tracking-tight outline-none bg-transparent"
                />
              </div>

              {/* Separator */}
              <div className="w-[1px] h-[calc(100%-16px)] bg-gray-separator" />

              {/* Departure Date Input */}
              <div className="flex-1 flex items-center px-6 h-full">
                <Image
                  src="/images/calendar.svg"
                  alt="Calendar"
                  width={32}
                  height={32}
                  className="mr-4"
                  style={{ filter: 'brightness(0) saturate(100%) invert(7%) sepia(23%) saturate(3985%) hue-rotate(199deg) brightness(94%) contrast(96%)' }}
                />
                <input
                  ref={dateInputRef}
                  type="text"
                  placeholder={isDateInputFocused && !dateValue ? "" : "Departure Date"}
                  value={dateValue}
                  onFocus={handleDateInputFocus}
                  onBlur={handleDateInputBlur}
                  readOnly
                  className="flex-1 text-[24px] font-geograph text-dark-blue placeholder-dark-blue tracking-tight outline-none bg-transparent cursor-pointer"
                />
              </div>

              {/* Search Button */}
              <button 
                onClick={handleSearchCruises}
                disabled={isSearching}
                className="absolute right-2 w-[74px] h-[74px] bg-dark-blue rounded-full flex items-center justify-center hover:bg-dark-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Image
                  src="/images/search.svg"
                  alt="Search"
                  width={32}
                  height={32}
                  className="brightness-0 invert"
                />
              </button>
            </div>

            {/* Ship Dropdown - Now outside the overflow-hidden container */}
            {isDropdownOpen && (
              <div 
                ref={dropdownRef}
                className={`absolute left-[10px] mt-[12px] bg-white rounded-[10px] z-[10000] ${
                  isDropdownClosing ? 'dropdown-fade-out' : 'dropdown-fade-in'
                }`}
                style={{ 
                  boxShadow: '0px 1px 14px rgba(0, 0, 0, 0.25)',
                  top: '90px', // Position below the search pill
                  width: 'calc(50% - 10px)', // Half width, accounting for left margin
                  position: 'absolute'
                }}
              >
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar rounded-[10px]">
                  {isLoading ? (
                    <div className="px-6 py-3 font-geograph text-[18px] text-gray-500 font-normal">
                      Loading ships...
                    </div>
                  ) : error ? (
                    <div className="px-6 py-3 font-geograph text-[18px] text-red-500 font-normal">
                      {error}
                    </div>
                  ) : filteredShips.length > 0 ? (
                    filteredShips.map((ship, index) => (
                      <div
                        key={`${ship.id}-${index}`}
                        onClick={() => handleShipSelect(ship)}
                        className={`px-6 py-3 cursor-pointer font-geograph text-dark-blue dropdown-item-hover ${
                          index === highlightedIndex 
                            ? 'bg-light-blue bg-opacity-20' 
                            : 'hover:bg-light-blue hover:bg-opacity-10'
                        }`}
                        style={{ letterSpacing: '-0.02em' }}
                      >
                        <div className="font-normal text-[18px]">{ship.name}</div>
                        <div className="font-normal text-[14px] text-gray-500 mt-0.5">{ship.cruiseLineName}</div>
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

            {/* Date Picker Dropdown */}
            {isDateDropdownOpen && (
              <div 
                ref={dateDropdownRef}
                className={`absolute mt-[12px] bg-white rounded-[10px] z-[10000] ${
                  isDateDropdownClosing ? 'dropdown-fade-out' : 'dropdown-fade-in'
                }`}
                style={{ 
                  boxShadow: '0px 1px 14px rgba(0, 0, 0, 0.25)',
                  top: '90px', // Position below the search pill
                  left: 'calc(50% + 5px)', // Position on the right side
                  width: 'calc(50% - 15px)', // Half width, accounting for margins
                  position: 'absolute'
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
                          ? 'cursor-not-allowed opacity-30' 
                          : 'hover:bg-gray-100 cursor-pointer'
                      }`}
                    >
                      <Image
                        src="/images/arrow-nav.svg"
                        alt="Previous"
                        width={32}
                        height={32}
                        className={isPreviousMonthDisabled() ? 'opacity-50' : ''}
                      />
                    </button>
                    <h3 className="font-medium text-[18px] text-dark-blue">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    >
                      <Image
                        src="/images/arrow-nav.svg"
                        alt="Next"
                        width={32}
                        height={32}
                        className="rotate-180"
                      />
                    </button>
                  </div>

                  {/* Days of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
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

                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                      const isPast = isDateInPast(date);
                      const isSelected = selectedDate && 
                        date.getDate() === selectedDate.getDate() &&
                        date.getMonth() === selectedDate.getMonth() &&
                        date.getFullYear() === selectedDate.getFullYear();

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(date)}
                          className={`w-[51px] h-[51px] flex items-center justify-center text-[16px] rounded-full transition-all ${
                            isPast 
                              ? 'text-gray-400 font-normal cursor-not-allowed' 
                              : 'text-dark-blue font-medium hover:bg-light-blue hover:bg-opacity-20 cursor-pointer'
                          } ${
                            isSelected ? 'bg-light-blue text-white' : ''
                          }`}
                          disabled={isPast}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </section>

      {/* Separator Image */}
      <div 
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-1.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />

      {/* Search Results Section */}
      {(isSearching || searchError || cruises.length > 0) && (
        <section className="bg-white py-16 px-8">
          <div className="max-w-7xl mx-auto">
            {/* Loading State */}
            {isSearching && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-light-blue"></div>
                <p className="mt-4 text-gray-600 font-geograph">Searching for cruises...</p>
              </div>
            )}

            {/* Error State */}
            {searchError && !isSearching && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                {searchError}
              </div>
            )}

            {/* Results */}
            {!isSearching && cruises.length > 0 && (
              <>
                <h2 className="text-3xl font-medium font-geograph text-dark-blue mb-8">
                  Found {cruises.length} cruise{cruises.length !== 1 ? 's' : ''}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cruises.map((cruise) => (
                    <div 
                      key={cruise.id} 
                      onClick={() => handleCruiseClick(cruise)}
                      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer transform hover:scale-[1.02]"
                    >
                      <h3 className="text-xl font-medium text-dark-blue mb-2">
                        {cruise.ship_name || 'Unknown Ship'}
                      </h3>
                      
                      <div className="space-y-2 text-sm text-gray-600 font-geograph">
                        <p>
                          <span className="font-medium">Departure:</span>{' '}
                          {cruise.departure_date ? new Date(cruise.departure_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : 'N/A'}
                        </p>
                        
                        {cruise.return_date && (
                          <p>
                            <span className="font-medium">Return:</span>{' '}
                            {new Date(cruise.return_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        )}
                        
                        {cruise.duration && (
                          <p><span className="font-medium">Duration:</span> {cruise.duration}</p>
                        )}
                        
                        {cruise.departure_port && (
                          <p><span className="font-medium">From:</span> {cruise.departure_port}</p>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium text-gray-700 mb-2">Starting from:</p>
                        {cruise.interior_cheapest_price ? (
                          <p className="text-2xl font-bold text-light-blue">
                            ${cruise.interior_cheapest_price.toLocaleString()}
                          </p>
                        ) : cruise.oceanview_cheapest_price ? (
                          <p className="text-2xl font-bold text-light-blue">
                            ${cruise.oceanview_cheapest_price.toLocaleString()}
                          </p>
                        ) : cruise.balcony_cheapest_price ? (
                          <p className="text-2xl font-bold text-light-blue">
                            ${cruise.balcony_cheapest_price.toLocaleString()}
                          </p>
                        ) : cruise.suite_cheapest_price ? (
                          <p className="text-2xl font-bold text-light-blue">
                            ${cruise.suite_cheapest_price.toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-gray-500">Contact for pricing</p>
                        )}
                      </div>

                      {/* Onboard Credit */}
                      {cruise.onboard_credit && (
                        <div className="mt-3 p-3 bg-sunshine/20 rounded-lg">
                          <p className="text-sm font-medium text-dark-blue">
                            ${cruise.onboard_credit} Onboard Credit!
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* OBC Section */}
      <section className="bg-dark-blue py-[124px] relative">
        <div className="max-w-4xl mx-auto px-8 text-center">
          {/* Headline */}
          <h2 className="text-white text-[52px] font-whitney leading-none tracking-tight mb-[100px]">
            WHAT'S ONBOARD CREDIT (OBC)?
          </h2>
          
          {/* First Body Text */}
          <p className="text-purple-obc text-[32px] font-geograph leading-[1.5] tracking-tight mb-[60px]">
            Think of OBC as cruise cash.<br /><br />
            When you book, the cruise line gives you money to spend onboard — like a gift card just for your vacation.
          </p>
          
          {/* Image */}
          <div className="mb-[60px]">
            <Image
              src="/images/what-you-can-buy.png"
              alt="What you can buy with onboard credit"
              width={1236}
              height={860}
              className="h-auto mx-auto w-full max-w-[618px]"
            />
          </div>
          
          {/* Second Body Text */}
          <p className="text-purple-obc text-[32px] font-geograph leading-[1.5] tracking-tight mb-16">
            Most travel agents keep as much of the commission as possible and only pass along a little OBC. Cruise lines also set a cap on how much agents can give back.
          </p>
          
          {/* Bottom Line Image */}
          <div className="mx-auto relative z-10" style={{ marginBottom: '-300px' }}>
            <Image
              src="/images/bottom-line.png"
              alt="The bottom line"
              width={1305}
              height={734}
              className="h-auto mx-auto w-full max-w-[650px]"
            />
          </div>
        </div>
      </section>

      {/* Separator Image 2 */}
      <div 
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-2.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />

      {/* Last Minute Deals Section */}
      <section className="bg-sand py-[100px] relative pt-[200px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Headline with Hourglass Icon */}
          <div className="flex items-center justify-center mb-[80px]">
            <Image
              src="/images/hourglass.svg"
              alt="Hourglass"
              width={48}
              height={48}
              className="mr-6"
            />
            <h2 className="text-dark-blue text-[52px] font-whitney font-black leading-none tracking-tight">
              LAST MINUTE DEALS
            </h2>
          </div>
          
          {/* Loading State */}
          {isLoadingDeals && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-dark-blue"></div>
              <p className="mt-4 text-gray-600 font-geograph">Loading last minute deals...</p>
            </div>
          )}

          {/* Error State */}
          {dealsError && !isLoadingDeals && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center">
              {dealsError}
            </div>
          )}

          {/* Cruise Grid - 3x2 on desktop */}
          {!isLoadingDeals && lastMinuteDeals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lastMinuteDeals.slice(0, 6).map((deal) => {
                // Calculate OBC as 8% of cheapest pricing, rounded down to nearest $10
                const obc = Math.floor((deal.cheapest_pricing * 0.08) / 10) * 10;
                
                // Calculate return date from sailing_date + nights
                const sailingDate = new Date(deal.sailing_date);
                const returnDate = new Date(sailingDate);
                returnDate.setDate(sailingDate.getDate() + deal.nights);
                
                // Format date range as "Oct 5 - Oct 12"
                const dateRange = `${sailingDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })} - ${returnDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}`;
                
                // Truncate cruise name to max 27 characters
                const truncatedName = deal.name.length > 27 ? deal.name.substring(0, 27) + '...' : deal.name;
                
                return (
                  <div 
                    key={deal.id} 
                    className="cursor-pointer"
                    onClick={() => {
                      // Handle cruise click - convert to expected format
                      const cruiseForNavigation = {
                        id: deal.id,
                        ship_name: deal.ship_name,
                        departure_date: deal.sailing_date,
                        sailing_date: deal.sailing_date,
                      };
                      handleCruiseClick(cruiseForNavigation as Cruise);
                    }}
                  >
                    {/* Featured Image with Date Range Badge */}
                    <div className="relative">
                      <div className="h-[180px] bg-gray-200 relative overflow-hidden rounded-[18px]">
                        {deal.ship_image ? (
                          <Image
                            src={deal.ship_image}
                            alt={deal.ship_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-light-blue to-dark-blue flex items-center justify-center">
                            <Image
                              src="/images/ship.svg"
                              alt="Ship"
                              width={64}
                              height={64}
                              className="brightness-0 invert opacity-60"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Date Range Badge - Moved to top-right */}
                      <div 
                        className="absolute top-3 right-3 bg-white px-1 py-0.5 rounded-[3px]"
                        style={{
                          fontSize: '13px',
                          fontFamily: 'Geograph',
                          fontWeight: 'bold',
                          color: '#3a3c3e',
                          letterSpacing: '-0.02em',
                          paddingLeft: '6px', // Added 2px more padding (was 4px)
                          paddingRight: '6px', // Added 2px more padding (was 4px)
                          paddingTop: '2px',
                          paddingBottom: '2px'
                        }}
                      >
                        {dateRange}
                      </div>
                    </div>
                    
                    {/* Card Content - Two Column Layout */}
                    <div className="mt-4">
                      <div className="flex justify-between items-start">
                        {/* Left Side - Cruise Details */}
                        <div className="flex-1 pr-4">
                          {/* Cruise Name - Truncated */}
                          <h3 
                            className="font-geograph font-medium"
                            style={{
                              fontSize: '18px',
                              color: '#0E1B4D',
                              letterSpacing: '-0.02em',
                              marginBottom: '14px', // Reduced from 16px (mb-4) to 14px
                              lineHeight: '1.1',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {truncatedName}
                          </h3>
                          
                          {/* Duration and Port */}
                          <p 
                            className="font-geograph font-medium mb-1"
                            style={{
                              fontSize: '13px',
                              color: '#2f2f2f',
                              letterSpacing: '-0.02em'
                            }}
                          >
                            {deal.nights} nights • {deal.embark_port_name}
                          </p>
                          
                          {/* Cruise Line */}
                          <p 
                            className="font-geograph"
                            style={{
                              fontSize: '13px',
                              color: '#2f2f2f',
                              letterSpacing: '-0.02em',
                              fontWeight: 'normal'
                            }}
                          >
                            {deal.cruise_line_name || 'Cruise Line'}
                          </p>
                        </div>
                        
                        {/* Right Side - Pricing */}
                        <div className="flex flex-col items-end min-w-0">
                          {/* "STARTING FROM" label */}
                          <p 
                            className="font-geograph font-bold"
                            style={{
                              fontSize: '9px',
                              color: '#474747',
                              letterSpacing: '0.1em',
                              marginBottom: '0.25px' // Reduced from 0.5px to half again
                            }}
                          >
                            STARTING FROM
                          </p>
                          
                          {/* Price */}
                          <p 
                            className="font-geograph font-medium"
                            style={{
                              fontSize: '22px',
                              letterSpacing: '-0.02em',
                              marginBottom: '4px' // Reduced space between price and OBC badge by half
                            }}
                          >
                            ${Math.floor(deal.cheapest_pricing).toLocaleString()}
                          </p>
                          
                          {/* OBC Badge */}
                          {obc > 0 && (
                            <div 
                              className="rounded-[3px]"
                              style={{
                                backgroundColor: '#1b8f57',
                                fontSize: '13px',
                                fontFamily: 'Geograph',
                                fontWeight: '500', // Changed to medium (500)
                                color: 'white',
                                letterSpacing: '-0.02em',
                                paddingLeft: '7px', // Added 2px more padding (was 5px)
                                paddingRight: '7px', // Added 2px more padding (was 5px)
                                paddingTop: '3px', // Increased from 1px to 3px
                                paddingBottom: '3px', // Increased from 1px to 3px
                                whiteSpace: 'nowrap' // Prevent text wrapping
                              }}
                            >
                              +${obc} onboard credit
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Separator Image 3 */}
      <div 
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />
    </>
  );
}