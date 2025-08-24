'use client';
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { fetchShips, Ship, searchCruises, Cruise, fetchLastMinuteDeals, LastMinuteDeals } from "../lib/api";
import { createSlugFromCruise } from "../lib/slug";
import { useAlert } from "../components/GlobalAlertProvider";

export default function Home() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [searchValue, setSearchValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const [ships, setShips] = useState<Ship[]>([]);
  const [filteredShips, setFilteredShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
  
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Last minute deals states
  const [lastMinuteDeals, setLastMinuteDeals] = useState<LastMinuteDeals[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);

  // Load ships on component mount
  useEffect(() => {
    const loadShips = async () => {
      try {
        setIsLoading(true);
        const shipsData = await fetchShips();
        setShips(shipsData);
        setFilteredShips(shipsData);
      } catch (err) {
        console.error('Failed to load ships:', err);
        showAlert('Failed to load ships. Please try again later.');
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
        const deals = await fetchLastMinuteDeals();
        setLastMinuteDeals(deals);
      } catch (err) {
        console.error('Failed to load last minute deals:', err);
        showAlert('Failed to load last minute deals. Please try again later.');
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

  // Handle cruise card clicks for last minute deals
  const handleCruiseClick = (cruise: Cruise) => {
    try {
      // Generate slug for the cruise
      const slug = createSlugFromCruise({
        id: cruise.id,
        shipName: cruise.shipName || cruise.ship_name || selectedShip?.name || 'unknown-ship',
        sailingDate: cruise.departureDate || cruise.departure_date || cruise.sailing_date,
      });
      router.push(`/cruise/${slug}`);
    } catch (error) {
      console.error('Failed to create slug for cruise:', cruise, error);
      // Fallback to basic navigation with cruise ID
      router.push(`/cruise-details?id=${cruise.id}`);
    }
  };

  // Handle search - only navigate when both ship and date are selected
  const handleSearchCruises = async () => {
    if (!selectedShip) {
      showAlert('Please select a ship');
      return;
    }

    if (!selectedDate) {
      showAlert('Please select a departure date');
      return;
    }

    try {
      const searchParams = {
        shipId: selectedShip.id,
        shipName: selectedShip.name,
        departureDate: selectedDate.toISOString().split('T')[0]
      };

      const results = await searchCruises(searchParams);
      
      if (results.length === 1) {
        // Navigate directly to the cruise
        handleCruiseClick(results[0]);
      } else if (results.length === 0) {
        showAlert('No cruises found for your search criteria');
      } else {
        // Navigate to search results page or show selection
        showAlert(`Found ${results.length} cruises. Please refine your search.`);
      }
    } catch (err) {
      console.error('Error searching cruises:', err);
      showAlert('Failed to search cruises. Please try again.');
    }
  };

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-[30px] px-[60px]" style={{ backgroundColor: 'transparent' }}>
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
          
          {/* Navigation Links and Button */}
          <div className="flex items-center gap-8">
            <a 
              href="/why-zipsea" 
              className="flex items-center text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <path d="M6.06934 6.31836C6.46126 6.14636 7.28356 5.90302 8.08594 6.04004C9.17853 6.22685 9.51264 6.66491 9.64844 6.77441C9.77739 6.87847 10.594 7.75839 11.8145 7.09766C11.897 7.05299 12 7.11255 12 7.20996V9.47949C12 9.53181 11.9688 9.57887 11.9219 9.59668L9.50684 10.5137C9.41136 10.5499 9.39926 10.6895 9.48145 10.752C9.50252 10.7679 9.52317 10.7842 9.54297 10.8008C10.0429 11.2194 10.3024 11.4638 10.833 11.4639C11.2557 11.4639 11.5536 11.3538 11.8193 11.208C11.9005 11.1636 12 11.2233 12 11.3193V12.7012C12 12.7522 11.9707 12.7988 11.9248 12.8154C11.6062 12.9306 10.964 13.0773 10.333 12.9521C9.63193 12.813 9.10651 12.4344 8.93164 12.2627C8.68655 12.05 8.0849 11.6332 7.63574 11.6641C7.11178 11.7001 7.00654 11.6684 6.16797 12.0615C6.08928 12.0984 6.00006 12.0386 6 11.9482V9.71973C6 9.66741 6.03125 9.62035 6.07812 9.60254L9.21387 8.41211C9.24017 8.40213 9.24459 8.3647 9.22266 8.34668C8.93261 8.11484 8.16089 7.50289 7.56836 7.52832C7.04679 7.551 6.6588 7.67374 6.17773 7.93555C6.09755 7.97919 6 7.919 6 7.82422V6.42969C6.00014 6.3813 6.02682 6.3371 6.06934 6.31836Z" fill="white"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.25C13.8325 0.25 17.75 4.16751 17.75 9C17.75 13.8325 13.8325 17.75 9 17.75C4.16751 17.75 0.25 13.8325 0.25 9C0.25 4.16751 4.16751 0.25 9 0.25ZM9 1.75C4.99594 1.75 1.75 4.99594 1.75 9C1.75 13.0041 4.99594 16.25 9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75Z" fill="white"/>
              </svg>
              Why Zipsea
            </a>
            <a 
              href="/faqs" 
              className="flex items-center text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 18 19" fill="none" className="mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <path d="M6.8667 7.36535C6.86677 6.97426 6.97435 6.59071 7.17768 6.25663C7.38101 5.92255 7.67226 5.65079 8.01961 5.47106C8.36695 5.29132 8.75702 5.21053 9.14718 5.2375C9.53734 5.26448 9.91258 5.39819 10.2319 5.62401C10.5512 5.84984 10.8023 6.1591 10.9577 6.51798C11.1131 6.87686 11.1669 7.27157 11.1131 7.65895C11.0594 8.04633 10.9002 8.41148 10.6529 8.71449C10.4057 9.0175 10.0799 9.24672 9.71114 9.37708C9.50309 9.45064 9.32297 9.58692 9.19561 9.76713C9.06825 9.94735 8.99992 10.1626 9.00003 10.3833V11.0987" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M9 12.75C8.85166 12.75 8.70666 12.794 8.58332 12.8764C8.45999 12.9588 8.36386 13.0759 8.30709 13.213C8.25032 13.35 8.23547 13.5008 8.26441 13.6463C8.29335 13.7918 8.36478 13.9254 8.46967 14.0303C8.57456 14.1352 8.7082 14.2066 8.85368 14.2356C8.99917 14.2645 9.14997 14.2497 9.28701 14.1929C9.42406 14.1361 9.54119 14.04 9.6236 13.9167C9.70601 13.7933 9.75 13.6483 9.75 13.5C9.75 13.3011 9.67098 13.1103 9.53033 12.9697C9.38968 12.829 9.19891 12.75 9 12.75Z" fill="white"/>
                <path d="M9 17.5C13.4183 17.5 17 13.9183 17 9.5C17 5.08172 13.4183 1.5 9 1.5C4.58172 1.5 1 5.08172 1 9.5C1 13.9183 4.58172 17.5 9 17.5Z" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
              </svg>
              FAQs
            </a>
            <a 
              href="#" 
              className="flex items-center text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <path d="M9.53333 1.25001C8.2027 1.24809 6.89579 1.60231 5.74825 2.27589C4.6007 2.94948 3.65432 3.91789 3.00732 5.08063C2.36032 6.24337 2.03627 7.55808 2.06881 8.88831C2.10135 10.2185 2.48928 11.5158 3.19235 12.6456L1 17.25L5.60373 15.0569C6.58554 15.6676 7.69576 16.0419 8.8469 16.1504C9.99804 16.2589 11.1586 16.0985 12.2372 15.682C13.3158 15.2654 14.283 14.6041 15.0624 13.7501C15.8418 12.896 16.4123 11.8727 16.7288 10.7606C17.0453 9.64851 17.0992 8.47813 16.8863 7.34166C16.6734 6.2052 16.1994 5.13372 15.5018 4.21165C14.8042 3.28958 13.902 2.54212 12.8662 2.02817C11.8305 1.51423 10.6896 1.24785 9.53333 1.25001Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M7.85226 7.4727C7.7214 7.20606 7.51841 6.98144 7.26632 6.82435C7.01424 6.66726 6.72316 6.58398 6.42613 6.58398C6.12911 6.58398 5.83803 6.66726 5.58594 6.82435C5.33386 6.98144 5.13086 7.20606 5 7.4727" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M14.2483 7.4727C14.1174 7.20606 13.9144 6.98144 13.6623 6.82435C13.4102 6.66726 13.1192 6.58398 12.8221 6.58398C12.5251 6.58398 12.234 6.66726 11.9819 6.82435C11.7299 6.98144 11.5269 7.20606 11.396 7.4727" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M6.87061 11.3828C7.62326 12.0691 8.6051 12.4495 9.62367 12.4495C10.6422 12.4495 11.6241 12.0691 12.3767 11.3828" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
              </svg>
              Chat with us
            </a>
            
            {/* Sign up/Log in Button */}
            <button 
              className="px-5 py-3.5 border border-white rounded-full text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'transparent' }}
            >
              Sign up/Log in
            </button>
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
                <svg width="32" height="32" viewBox="0 0 34 27" fill="none" className="mr-4" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path d="M32.8662 25.4355C32.0707 25.4334 31.2888 25.2282 30.5947 24.8395C29.9005 24.4508 29.3171 23.8914 28.8995 23.2142C28.478 23.8924 27.8906 24.4519 27.1926 24.8398C26.4947 25.2278 25.7094 25.4314 24.9109 25.4314C24.1124 25.4314 23.3271 25.2278 22.6292 24.8398C21.9313 24.4519 21.3438 23.8924 20.9223 23.2142C20.5031 23.894 19.9167 24.4551 19.2191 24.844C18.5215 25.2329 17.7359 25.4365 16.9372 25.4355C14.8689 25.4355 11.4533 22.2962 9.31413 20.0961C9.17574 19.9536 8.99997 19.8529 8.80698 19.8057C8.61399 19.7585 8.4116 19.7666 8.22303 19.8292C8.03445 19.8917 7.86733 20.0062 7.74084 20.1594C7.61435 20.3126 7.53361 20.4984 7.50788 20.6954C7.36621 22.0086 6.83213 23.3105 5.25396 23.3105C4.30812 23.2648 3.39767 22.9367 2.64011 22.3686C1.88255 21.8004 1.31265 21.0183 1.00396 20.123" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M18 20.123L22.8875 18.9005C24.0268 18.6152 25.0946 18.097 26.0236 17.3784C26.9526 16.6598 27.7226 15.7566 28.285 14.7255L32.875 6.31055L1 12.6855" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M25.2861 7.8278L18.0002 4.18555L4.18772 6.31055" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M6.31254 11.6236L4.18754 6.31109L1.9662 2.60934C1.86896 2.4482 1.81632 2.26409 1.81369 2.0759C1.81107 1.8877 1.85854 1.7022 1.95125 1.53841C2.04396 1.37461 2.17857 1.23843 2.34127 1.14382C2.50397 1.0492 2.68891 0.999569 2.87712 1H6.31254L11.54 5.18059" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                </svg>
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
                <svg width="32" height="32" viewBox="0 0 33 33" fill="none" className="mr-4" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path d="M29.4667 5.06836H3.03333C1.91035 5.06836 1 5.97868 1 7.10161V29.4674C1 30.5903 1.91035 31.5006 3.03333 31.5006H29.4667C30.5896 31.5006 31.5 30.5903 31.5 29.4674V7.10161C31.5 5.97868 30.5896 5.06836 29.4667 5.06836Z" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M1 13.1992H31.5" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M9.13379 8.11638V1" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M23.3662 8.11638V1" stroke="#0E1B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                </svg>
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
                className="absolute right-2 w-[74px] h-[74px] bg-dark-blue rounded-full flex items-center justify-center hover:bg-dark-blue/90 transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 33 33" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path d="M19.4999 25.5644C25.3213 23.0904 28.0349 16.3656 25.5608 10.5442C23.0868 4.72278 16.362 2.0092 10.5406 4.48324C4.71919 6.95728 2.00561 13.6821 4.47965 19.5035C6.95369 25.3249 13.6785 28.0385 19.4999 25.5644Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  <path d="M23.1172 23.123L31.9998 32.0069" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                </svg>
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
                      <svg width="32" height="32" viewBox="0 0 36 36" fill="none" style={{ shapeRendering: 'geometricPrecision' }} className={isPreviousMonthDisabled() ? 'opacity-50' : ''}>
                        <rect x="35.5" y="35.5" width="35" height="35" rx="9.5" transform="rotate(-180 35.5 35.5)" stroke="#D9D9D9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                        <path d="M15.125 18.125L20 13.25" stroke="#0E1B4D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                        <path d="M15.125 18.125L20 23" stroke="#0E1B4D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                      </svg>
                    </button>
                    <h3 className="font-medium text-[18px] text-dark-blue">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                    >
                      <svg width="32" height="32" viewBox="0 0 36 36" fill="none" style={{ shapeRendering: 'geometricPrecision' }} className="rotate-180">
                        <rect x="35.5" y="35.5" width="35" height="35" rx="9.5" transform="rotate(-180 35.5 35.5)" stroke="#D9D9D9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                        <path d="M15.125 18.125L20 13.25" stroke="#0E1B4D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                        <path d="M15.125 18.125L20 23" stroke="#0E1B4D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                      </svg>
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
            <svg width="48" height="48" viewBox="0 0 55 55" fill="none" className="mr-6" style={{ shapeRendering: 'geometricPrecision' }}>
              <g clipPath="url(#clip0_573_3612)">
                <path d="M38.4687 49.648L35.7206 48.9646L37.3152 42.5522C37.9504 39.989 37.8041 37.2943 36.8953 34.8148C35.9865 32.3354 34.3567 30.1845 32.2156 28.6388C34.8312 28.2759 37.2785 27.1389 39.2428 25.374C41.2071 23.6091 42.5986 21.297 43.2383 18.7349L44.833 12.3226L47.5812 13.006C48.0671 13.1269 48.5811 13.0497 49.0101 12.7916C49.4391 12.5335 49.748 12.1155 49.8689 11.6296C49.9897 11.1437 49.9126 10.6297 49.6544 10.2006C49.3963 9.77159 48.9783 9.46268 48.4924 9.34184L17.3467 1.59625C16.8608 1.47541 16.3468 1.55254 15.9178 1.81068C15.4888 2.06882 15.1799 2.48682 15.059 2.97272C14.9382 3.45863 15.0153 3.97263 15.2735 4.40166C15.5316 4.83069 15.9496 5.1396 16.4355 5.26044L19.1836 5.94388L17.589 12.3562C16.9541 14.9195 17.1005 17.614 18.0092 20.0935C18.918 22.5729 20.5477 24.7238 22.6886 26.2696C20.0729 26.6323 17.6255 27.7692 15.6611 29.5341C13.6968 31.2991 12.3054 33.6113 11.6659 36.1735L10.0712 42.5858L7.32304 41.9024C6.83713 41.7816 6.32313 41.8587 5.8941 42.1168C5.46507 42.375 5.15615 42.793 5.03532 43.2789C4.91448 43.7648 4.99161 44.2788 5.24975 44.7078C5.50789 45.1368 5.92589 45.4458 6.41179 45.5666L37.5575 53.3122C38.0434 53.433 38.5574 53.3559 38.9864 53.0978C39.4154 52.8396 39.7243 52.4216 39.8452 51.9357C39.966 51.4498 39.8889 50.9358 39.6307 50.5068C39.3726 50.0777 38.9546 49.7688 38.4687 49.648ZM22.7864 16.4112C23.0148 16.1494 23.311 15.9556 23.6424 15.8513C23.9738 15.747 24.3276 15.7362 24.6648 15.8201L35.3642 18.4809C35.7012 18.565 36.0085 18.7404 36.2522 18.9878C36.4959 19.2352 36.6667 19.5451 36.7457 19.8833C36.8247 20.2215 36.8088 20.5749 36.6999 20.9047C36.591 21.2345 36.3932 21.5278 36.1284 21.7525C35.0797 22.6448 33.8334 23.2744 32.4929 23.5891C31.1524 23.9039 29.7562 23.8947 28.42 23.5624C27.0837 23.2301 25.8458 22.5842 24.8089 21.6782C23.772 20.7722 22.9659 19.6322 22.4573 18.3526C22.3282 18.0301 22.2906 17.6782 22.3487 17.3356C22.4067 16.9931 22.5582 16.6732 22.7864 16.4112ZM16.9564 37.7421L23.871 33.75C24.5077 33.4096 25.248 33.3176 25.9487 33.4919C26.6493 33.6661 27.2603 34.0942 27.6634 34.6931L31.9012 41.4568C32.1985 41.9225 32.3362 42.4723 32.2936 43.0232C32.251 43.5741 32.0304 44.0962 31.6651 44.5107C31.3276 44.8836 30.8946 45.1571 30.4129 45.3017C29.9312 45.4463 29.4191 45.4564 28.9321 45.3309L17.7764 42.5566C17.2883 42.4411 16.8409 42.1945 16.4825 41.8435C16.1242 41.4924 15.8684 41.0503 15.7428 40.5646C15.6112 40.0262 15.6584 39.4595 15.8773 38.9503C16.0963 38.4411 16.475 38.017 16.9564 37.7421Z" fill="#0E1B4D"/>
              </g>
              <defs>
                <clipPath id="clip0_573_3612">
                  <rect width="45.3097" height="45.3097" fill="white" transform="translate(10.9351) rotate(13.9655)"/>
                </clipPath>
              </defs>
            </svg>
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
                        shipId: deal.ship_id || 0,
                        shipName: deal.ship_name,
                        cruiseLineName: deal.cruise_line_name,
                        departureDate: deal.sailing_date,
                        returnDate: deal.return_date || '',
                        duration: deal.nights,
                        itinerary: [],
                        departurePort: deal.embarkation_port_name || deal.embark_port_name || '',
                        prices: {
                          interior: deal.cheapest_price || deal.cheapest_pricing,
                          oceanView: deal.cheapest_price || deal.cheapest_pricing,
                          balcony: deal.cheapest_price || deal.cheapest_pricing,
                          suite: deal.cheapest_price || deal.cheapest_pricing
                        }
                      } as Cruise;
                      handleCruiseClick(cruiseForNavigation);
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
                            <svg width="64" height="64" viewBox="0 0 34 27" fill="none" style={{ shapeRendering: 'geometricPrecision' }} className="opacity-60">
                              <path d="M32.8662 25.4355C32.0707 25.4334 31.2888 25.2282 30.5947 24.8395C29.9005 24.4508 29.3171 23.8914 28.8995 23.2142C28.478 23.8924 27.8906 24.4519 27.1926 24.8398C26.4947 25.2278 25.7094 25.4314 24.9109 25.4314C24.1124 25.4314 23.3271 25.2278 22.6292 24.8398C21.9313 24.4519 21.3438 23.8924 20.9223 23.2142C20.5031 23.894 19.9167 24.4551 19.2191 24.844C18.5215 25.2329 17.7359 25.4365 16.9372 25.4355C14.8689 25.4355 11.4533 22.2962 9.31413 20.0961C9.17574 19.9536 8.99997 19.8529 8.80698 19.8057C8.61399 19.7585 8.4116 19.7666 8.22303 19.8292C8.03445 19.8917 7.86733 20.0062 7.74084 20.1594C7.61435 20.3126 7.53361 20.4984 7.50788 20.6954C7.36621 22.0086 6.83213 23.3105 5.25396 23.3105C4.30812 23.2648 3.39767 22.9367 2.64011 22.3686C1.88255 21.8004 1.31265 21.0183 1.00396 20.123" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                              <path d="M18 20.123L22.8875 18.9005C24.0268 18.6152 25.0946 18.097 26.0236 17.3784C26.9526 16.6598 27.7226 15.7566 28.285 14.7255L32.875 6.31055L1 12.6855" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                              <path d="M25.2861 7.8278L18.0002 4.18555L4.18772 6.31055" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                              <path d="M6.31254 11.6236L4.18754 6.31109L1.9662 2.60934C1.86896 2.4482 1.81632 2.26409 1.81369 2.0759C1.81107 1.8877 1.85854 1.7022 1.95125 1.53841C2.04396 1.37461 2.17857 1.23843 2.34127 1.14382C2.50397 1.0492 2.68891 0.999569 2.87712 1H6.31254L11.54 5.18059" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                            </svg>
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

      {/* Footer Section */}
      <footer className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex justify-between items-start">
            {/* Left side - Logo and links */}
            <div className="flex flex-col">
              {/* Zipsea Logo */}
              <div className="mb-6">
                <Image
                  src="/images/zipsea-logo.svg"
                  alt="Zipsea"
                  width={110}
                  height={40}
                  className="brightness-0"
                  style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(89%)' }}
                />
              </div>
              
              {/* Terms & Conditions Link */}
              <a 
                href="#" 
                className="font-geograph font-bold mb-3"
                style={{
                  fontSize: '9px',
                  color: '#2f2f2f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}
              >
                TERMS & CONDITIONS
              </a>
              
              {/* Privacy Policy Link */}
              <a 
                href="#" 
                className="font-geograph font-bold"
                style={{
                  fontSize: '9px',
                  color: '#2f2f2f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}
              >
                PRIVACY POLICY
              </a>
            </div>
            
            {/* Right side - Navigation links and social icons */}
            <div className="flex items-center gap-8">
              {/* Navigation Links */}
              <div className="flex items-center gap-8">
                {/* Why Zipsea */}
                <a 
                  href="/why-zipsea" 
                  className="flex items-center font-geograph font-medium hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '16px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 18 18" fill="none" className="mr-3" style={{ shapeRendering: 'geometricPrecision' }}>
                    <path d="M6.06934 6.31836C6.46126 6.14636 7.28356 5.90302 8.08594 6.04004C9.17853 6.22685 9.51264 6.66491 9.64844 6.77441C9.77739 6.87847 10.594 7.75839 11.8145 7.09766C11.897 7.05299 12 7.11255 12 7.20996V9.47949C12 9.53181 11.9688 9.57887 11.9219 9.59668L9.50684 10.5137C9.41136 10.5499 9.39926 10.6895 9.48145 10.752C9.50252 10.7679 9.52317 10.7842 9.54297 10.8008C10.0429 11.2194 10.3024 11.4638 10.833 11.4639C11.2557 11.4639 11.5536 11.3538 11.8193 11.208C11.9005 11.1636 12 11.2233 12 11.3193V12.7012C12 12.7522 11.9707 12.7988 11.9248 12.8154C11.6062 12.9306 10.964 13.0773 10.333 12.9521C9.63193 12.813 9.10651 12.4344 8.93164 12.2627C8.68655 12.05 8.0849 11.6332 7.63574 11.6641C7.11178 11.7001 7.00654 11.6684 6.16797 12.0615C6.08928 12.0984 6.00006 12.0386 6 11.9482V9.71973C6 9.66741 6.03125 9.62035 6.07812 9.60254L9.21387 8.41211C9.24017 8.40213 9.24459 8.3647 9.22266 8.34668C8.93261 8.11484 8.16089 7.50289 7.56836 7.52832C7.04679 7.551 6.6588 7.67374 6.17773 7.93555C6.09755 7.97919 6 7.919 6 7.82422V6.42969C6.00014 6.3813 6.02682 6.3371 6.06934 6.31836Z" fill="#2f2f2f"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M9 0.25C13.8325 0.25 17.75 4.16751 17.75 9C17.75 13.8325 13.8325 17.75 9 17.75C4.16751 17.75 0.25 13.8325 0.25 9C0.25 4.16751 4.16751 0.25 9 0.25ZM9 1.75C4.99594 1.75 1.75 4.99594 1.75 9C1.75 13.0041 4.99594 16.25 9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75Z" fill="#2f2f2f"/>
                  </svg>
                  Why Zipsea
                </a>
                
                {/* FAQs */}
                <a 
                  href="/faqs" 
                  className="flex items-center font-geograph font-medium hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '16px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 18 19" fill="none" className="mr-3" style={{ shapeRendering: 'geometricPrecision' }}>
                    <path d="M6.8667 7.36535C6.86677 6.97426 6.97435 6.59071 7.17768 6.25663C7.38101 5.92255 7.67226 5.65079 8.01961 5.47106C8.36695 5.29132 8.75702 5.21053 9.14718 5.2375C9.53734 5.26448 9.91258 5.39819 10.2319 5.62401C10.5512 5.84984 10.8023 6.1591 10.9577 6.51798C11.1131 6.87686 11.1669 7.27157 11.1131 7.65895C11.0594 8.04633 10.9002 8.41148 10.6529 8.71449C10.4057 9.0175 10.0799 9.24672 9.71114 9.37708C9.50309 9.45064 9.32297 9.58692 9.19561 9.76713C9.06825 9.94735 8.99992 10.1626 9.00003 10.3833V11.0987" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M9 12.75C8.85166 12.75 8.70666 12.794 8.58332 12.8764C8.45999 12.9588 8.36386 13.0759 8.30709 13.213C8.25032 13.35 8.23547 13.5008 8.26441 13.6463C8.29335 13.7918 8.36478 13.9254 8.46967 14.0303C8.57456 14.1352 8.7082 14.2066 8.85368 14.2356C8.99917 14.2645 9.14997 14.2497 9.28701 14.1929C9.42406 14.1361 9.54119 14.04 9.6236 13.9167C9.70601 13.7933 9.75 13.6483 9.75 13.5C9.75 13.3011 9.67098 13.1103 9.53033 12.9697C9.38968 12.829 9.19891 12.75 9 12.75Z" fill="#2f2f2f"/>
                    <path d="M9 17.5C13.4183 17.5 17 13.9183 17 9.5C17 5.08172 13.4183 1.5 9 1.5C4.58172 1.5 1 5.08172 1 9.5C1 13.9183 4.58172 17.5 9 17.5Z" stroke="#2f2f2f" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  </svg>
                  FAQs
                </a>
                
                {/* Chat with us */}
                <a 
                  href="#" 
                  className="flex items-center font-geograph font-medium hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '16px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 18 18" fill="none" className="mr-3" style={{ shapeRendering: 'geometricPrecision' }}>
                    <path d="M9.53333 1.25001C8.2027 1.24809 6.89579 1.60231 5.74825 2.27589C4.6007 2.94948 3.65432 3.91789 3.00732 5.08063C2.36032 6.24337 2.03627 7.55808 2.06881 8.88831C2.10135 10.2185 2.48928 11.5158 3.19235 12.6456L1 17.25L5.60373 15.0569C6.58554 15.6676 7.69576 16.0419 8.8469 16.1504C9.99804 16.2589 11.1586 16.0985 12.2372 15.682C13.3158 15.2654 14.283 14.6041 15.0624 13.7501C15.8418 12.896 16.4123 11.8727 16.7288 10.7606C17.0453 9.64851 17.0992 8.47813 16.8863 7.34166C16.6734 6.2052 16.1994 5.13372 15.5018 4.21165C14.8042 3.28958 13.902 2.54212 12.8662 2.02817C11.8305 1.51423 10.6896 1.24785 9.53333 1.25001Z" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M7.85226 7.4727C7.7214 7.20606 7.51841 6.98144 7.26632 6.82435C7.01424 6.66726 6.72316 6.58398 6.42613 6.58398C6.12911 6.58398 5.83803 6.66726 5.58594 6.82435C5.33386 6.98144 5.13086 7.20606 5 7.4727" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M14.2483 7.4727C14.1174 7.20606 13.9144 6.98144 13.6623 6.82435C13.4102 6.66726 13.1192 6.58398 12.8221 6.58398C12.5251 6.58398 12.234 6.66726 11.9819 6.82435C11.7299 6.98144 11.5269 7.20606 11.396 7.4727" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M6.87061 11.3828C7.62326 12.0691 8.6051 12.4495 9.62367 12.4495C10.6422 12.4495 11.6241 12.0691 12.3767 11.3828" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  </svg>
                  Chat with us
                </a>
              </div>
              
              {/* Social Icons with reduced spacing */}
              <div className="flex items-center gap-4">
                {/* TikTok Icon */}
                <a 
                  href="https://www.tiktok.com/@zipseacruises"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                    <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                    <path d="M29.5162 16.3304C29.3707 16.2552 29.229 16.1727 29.0917 16.0834C28.6925 15.8194 28.3264 15.5084 28.0015 15.1571C27.1884 14.2267 26.8847 13.2829 26.7729 12.6221H26.7774C26.6839 12.0736 26.7226 11.7188 26.7284 11.7188H23.025V26.0389C23.025 26.2312 23.025 26.4212 23.0169 26.609C23.0169 26.6324 23.0147 26.6539 23.0134 26.6791C23.0134 26.6894 23.0134 26.7002 23.0111 26.711C23.0111 26.7137 23.0111 26.7164 23.0111 26.7191C22.9721 27.2329 22.8074 27.7292 22.5315 28.1644C22.2556 28.5996 21.877 28.9604 21.429 29.2149C20.962 29.4806 20.4339 29.6199 19.8967 29.6192C18.1712 29.6192 16.7728 28.2123 16.7728 26.4747C16.7728 24.7371 18.1712 23.3302 19.8967 23.3302C20.2233 23.3299 20.5479 23.3813 20.8584 23.4824L20.8629 19.7117C19.9202 19.5899 18.9624 19.6648 18.0501 19.9317C17.1378 20.1986 16.2906 20.6517 15.5622 21.2624C14.9238 21.817 14.3872 22.4788 13.9764 23.2179C13.8201 23.4874 13.2303 24.5704 13.1588 26.3282C13.1139 27.326 13.4135 28.3596 13.5564 28.7868V28.7958C13.6462 29.0474 13.9944 29.9058 14.5617 30.6295C15.0193 31.21 15.5598 31.72 16.1659 32.1429V32.1339L16.1749 32.1429C17.9677 33.3612 19.9555 33.2812 19.9555 33.2812C20.2996 33.2673 21.4523 33.2812 22.7613 32.6609C24.2132 31.9731 25.0398 30.9485 25.0398 30.9485C25.5678 30.3362 25.9877 29.6385 26.2814 28.8852C26.6165 28.0043 26.7284 26.9477 26.7284 26.5254V18.9283C26.7733 18.9552 27.3717 19.351 27.3717 19.351C27.3717 19.351 28.2337 19.9035 29.5787 20.2633C30.5436 20.5194 31.8436 20.5733 31.8436 20.5733V16.8969C31.3881 16.9463 30.4632 16.8026 29.5162 16.3304Z" fill="white"/>
                  </svg>
                </a>
                
                {/* Instagram Icon */}
                <a 
                  href="https://www.instagram.com/zipseacruises/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                    <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                    <g clipPath="url(#clip0_637_3559)">
                      <path d="M23 13.163C26.204 13.163 26.584 13.175 27.85 13.233C31.102 13.381 32.621 14.924 32.769 18.152C32.827 19.417 32.838 19.797 32.838 23.001C32.838 26.206 32.826 26.585 32.769 27.85C32.62 31.075 31.105 32.621 27.85 32.769C26.584 32.827 26.206 32.839 23 32.839C19.796 32.839 19.416 32.827 18.151 32.769C14.891 32.62 13.38 31.07 13.232 27.849C13.174 26.584 13.162 26.205 13.162 23C13.162 19.796 13.175 19.417 13.232 18.151C13.381 14.924 14.896 13.38 18.151 13.232C19.417 13.175 19.796 13.163 23 13.163ZM23 11C19.741 11 19.333 11.014 18.053 11.072C13.695 11.272 11.273 13.69 11.073 18.052C11.014 19.333 11 19.741 11 23C11 26.259 11.014 26.668 11.072 27.948C11.272 32.306 13.69 34.728 18.052 34.928C19.333 34.986 19.741 35 23 35C26.259 35 26.668 34.986 27.948 34.928C32.302 34.728 34.73 32.31 34.927 27.948C34.986 26.668 35 26.259 35 23C35 19.741 34.986 19.333 34.928 18.053C34.732 13.699 32.311 11.273 27.949 11.073C26.668 11.014 26.259 11 23 11ZM23 16.838C19.597 16.838 16.838 19.597 16.838 23C16.838 26.403 19.597 29.163 23 29.163C26.403 29.163 29.162 26.404 29.162 23C29.162 19.597 26.403 16.838 23 16.838ZM23 27C20.791 27 19 25.21 19 23C19 20.791 20.791 19 23 19C25.209 19 27 20.791 27 23C27 25.21 25.209 27 23 27ZM29.406 15.155C28.61 15.155 27.965 15.8 27.965 16.595C27.965 17.39 28.61 18.035 29.406 18.035C30.201 18.035 30.845 17.39 30.845 16.595C30.845 15.8 30.201 15.155 29.406 15.155Z" fill="white"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_637_3559">
                        <rect width="24" height="24" fill="white" transform="translate(11 11)"/>
                      </clipPath>
                    </defs>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom spacing */}
        <div className="h-[300px]" />
      </footer>
    </>
  );
}