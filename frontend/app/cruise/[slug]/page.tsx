'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCruiseBySlug, getComprehensiveCruiseData, getCruiseDetailsById, ComprehensiveCruiseData, Cruise } from '../../../lib/api';
import { parseCruiseSlug } from '../../../lib/slug';
import { useAlert } from '../../../components/GlobalAlertProvider';

interface CruiseDetailPageProps {}

export default function CruiseDetailPage({}: CruiseDetailPageProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { showAlert } = useAlert();
  
  const [cruiseData, setCruiseData] = useState<ComprehensiveCruiseData | null>(null);
  const [fallbackData, setFallbackData] = useState<Cruise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  useEffect(() => {
    const loadCruiseData = async () => {
      if (!slug) return;

      try {
        setIsLoading(true);
        setError(null);
        // Parse the slug to get cruise ID
        const parsedSlug = parseCruiseSlug(slug);
        
        if (parsedSlug?.cruiseId) {
          // Try comprehensive endpoint first (most reliable)
          try {
            const comprehensiveData = await getComprehensiveCruiseData(parsedSlug.cruiseId);
            if (comprehensiveData) {
              setCruiseData(comprehensiveData);
              setIsUsingFallback(false);
              return;
            }
          } catch (err) {
            console.log('Comprehensive endpoint failed, trying alternatives:', err);
          }

          // Try slug endpoint as backup (in case it works for some cruises)
          try {
            const data = await getCruiseBySlug(slug);
            if (data) {
              setCruiseData(data);
              setIsUsingFallback(false);
              return;
            }
          } catch (err) {
            console.log('Slug endpoint failed:', err);
          }

          // Final fallback - try to get basic cruise data
          try {
            const basicData = await getCruiseDetailsById(parsedSlug.cruiseId);
            if (basicData) {
              setFallbackData(basicData);
              setIsUsingFallback(true);
              return;
            }
          } catch (err) {
            console.log('All fallback methods failed:', err);
          }
        }

        // If all methods fail
        showAlert('Cruise not found');
        setError('Cruise not found');
      } catch (err) {
        console.error('Failed to load cruise data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load cruise data';
        showAlert(errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadCruiseData();
  }, [slug]);

  const formatPrice = (price: string | number | undefined) => {
    if (!price) return 'N/A';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      // Parse the UTC date and format it properly
      const date = new Date(dateString);
      const formatted = date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC' // Use UTC to avoid timezone conversion issues
      }).toUpperCase();
      // Remove the second comma and convert SEP to SEPT
      return formatted.replace(/,\s*(\d+),/g, ' $1').replace(/SEP /g, 'SEPT ');
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return dateString;
    }
  };

  const calculateReturnDate = (sailingDate: string | undefined, nights: number | undefined) => {
    if (!sailingDate || !nights) return null;
    try {
      const departure = new Date(sailingDate);
      const returnDate = new Date(departure);
      returnDate.setUTCDate(departure.getUTCDate() + nights);
      return returnDate.toISOString();
    } catch {
      return null;
    }
  };

  // Helper function to get cabin image based on cabin type
  const getCabinImage = (cabinType: string) => {
    if (!cruiseData?.cabinCategories) return null;
    
    const normalizedType = cabinType.toLowerCase();
    let targetCategory = '';
    
    // Map cabin types to categories
    if (normalizedType.includes('interior') || normalizedType.includes('inside')) {
      targetCategory = 'interior';
    } else if (normalizedType.includes('oceanview') || normalizedType.includes('outside')) {
      targetCategory = 'oceanview';
    } else if (normalizedType.includes('balcony')) {
      targetCategory = 'balcony';
    } else if (normalizedType.includes('suite')) {
      targetCategory = 'suite';
    }
    
    // Find matching cabin category
    const cabinCategory = cruiseData.cabinCategories.find(cabin => 
      cabin.category.toLowerCase().includes(targetCategory) ||
      cabin.name.toLowerCase().includes(targetCategory)
    );
    
    return cabinCategory ? (cabinCategory.imageUrlHd || cabinCategory.imageUrl) : null;
  };

  if (isLoading) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '1.5rem',
          color: '#4a5568',
          marginTop: '4rem'
        }}>
          Loading cruise details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: '#fed7d7',
          color: '#9b2c2c',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          marginTop: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Cruise Not Found</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            We couldn't find the cruise you're looking for. The cruise may no longer be available or the link may be incorrect.
          </p>
          <button
            onClick={() => router.push('/')}
            style={{
              backgroundColor: '#4299e1',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  // Use comprehensive data if available, otherwise use fallback
  const cruise = cruiseData?.cruise || (fallbackData as any);
  const ship = cruiseData?.ship || { 
    name: fallbackData?.shipName,
    defaultShipImage: undefined,
    defaultShipImage2k: undefined,
    defaultShipImageHd: undefined,
    shortDescription: undefined,
    tonnage: undefined,
    starRating: undefined,
    capacity: undefined,
    yearBuilt: undefined,
    length: undefined,
    raw: undefined
  };
  const cruiseLine = cruiseData?.cruiseLine || { 
    name: fallbackData?.cruiseLineName,
    raw: undefined
  };
  const embarkPort = cruiseData?.embarkPort || { name: fallbackData?.departurePort };
  const disembarkPort = cruiseData?.disembarkPort || { name: fallbackData?.departurePort };
  const pricing = cruiseData?.cheapestPricing;

  if (!cruise) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{ color: '#e53e3e', fontSize: '1.5rem' }}>
          No cruise data available
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      {/* Warning for fallback data */}
      {isUsingFallback && (
        <div className="bg-sand py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div style={{
              backgroundColor: '#fef5e7',
              color: '#975a16',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '2rem',
              border: '1px solid #f6e05e'
            }}>
              <strong>Limited Data:</strong> We're showing basic information for this cruise. Some detailed information may not be available.
            </div>
          </div>
        </div>
      )}

      {/* Hero Section with New Branded Design */}
      <div className="bg-purple-obc py-12 px-6 -mt-[60px] md:-mt-[80px] pt-[200px] md:pb-[100px]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left Side Content */}
            <div>
              {/* Cruise Name */}
              <h1 className="font-whitney text-[32px] md:text-[52px] text-dark-blue mb-4 uppercase" style={{ letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                {cruise.name || `${ship?.name || 'Unknown Ship'} Cruise`}
              </h1>
              
              {/* Cruise Line | Ship Name */}
              <div className="text-dark-blue text-[18px] font-geograph font-medium mb-12" style={{ letterSpacing: '-0.02em' }}>
                {cruiseLine?.name || 'Unknown Cruise Line'} | {ship?.name || 'Unknown Ship'}
              </div>
              
              {/* Information Grid - 2x2 Layout */}
              <div className="grid grid-cols-2 gap-8">
                {/* Depart */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    DEPART
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]" style={{ letterSpacing: '-0.02em' }}>
                    {formatDate(cruise.sailingDate)}
                  </div>
                </div>
                
                {/* Return */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    RETURN
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]" style={{ letterSpacing: '-0.02em' }}>
                    {(() => {
                      const returnDateFromDb = cruise.returnDate;
                      const calculatedReturnDate = calculateReturnDate(cruise.sailingDate, cruise.nights);
                      const displayDate = returnDateFromDb || calculatedReturnDate;
                      return formatDate(displayDate);
                    })()}
                  </div>
                </div>
                
                {/* Departure Port */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    DEPARTURE PORT
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]" style={{ letterSpacing: '-0.02em' }}>
                    {embarkPort?.name || 'N/A'}
                  </div>
                </div>
                
                {/* Nights */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    NIGHTS
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]" style={{ letterSpacing: '-0.02em' }}>
                    {cruise.nights} NIGHTS
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Side - Ship Image */}
            <div className="flex justify-center">
              {ship?.defaultShipImage ? (
                <img 
                  src={ship.defaultShipImage2k || ship.defaultShipImage}
                  alt={`${ship.name} - Ship`}
                  className="w-full max-w-md rounded-[10px] object-cover"
                  style={{ height: '400px', aspectRatio: '4/3' }}
                />
              ) : (
                <div className="w-full max-w-md bg-gray-200 rounded-[10px] flex items-center justify-center text-gray-500"
                     style={{ height: '400px', aspectRatio: '4/3' }}>
                  No Ship Image Available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Section Separator */}
      <div className="w-full">
        <img 
          src="/images/separator-4.png" 
          alt="Section Separator" 
          className="w-full h-auto block"
        />
      </div>

      {/* Body Section - Updated background and styling */}
      <div className="bg-sand py-16">
        <div className="max-w-7xl mx-auto px-6">
          
          
          {/* Description Section */}
          {ship?.shortDescription && (
            <div>
              <p className="font-geograph text-[20px] md:text-[24px] leading-[1.5] text-dark-blue" style={{ letterSpacing: '-0.02em' }}>
                {ship.shortDescription}
              </p>
            </div>
          )}
          
          {/* Additional cruise details can be added here */}
          {cruise.voyageCode && (
            <div className="mb-8">
              <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                VOYAGE CODE
              </div>
              <div className="text-[20px] font-geograph text-dark-blue" style={{ letterSpacing: '-0.02em' }}>
                {cruise.voyageCode}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Choose Your Room Section */}
      {pricing && (
        <div className="bg-sand">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-6">
              <h2 className="font-whitney font-black text-[32px] text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
                CHOOSE YOUR ROOM
              </h2>
              <p className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5]" style={{ letterSpacing: '-0.02em' }}>
                Prices shown are per person based on double occupancy and subject to availability
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Interior Cabin Card */}
              <div className="bg-white rounded-t-lg rounded-b-none md:rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Cabin Image */}
                  <div className="md:w-48 md:h-auto flex-shrink-0" style={{ height: '128px' }}>
                    {(() => {
                      const interiorImage = getCabinImage('interior');
                      return interiorImage ? (
                        <img 
                          src={interiorImage} 
                          alt="Interior Cabin" 
                          className="w-full h-full object-cover md:rounded-l-lg rounded-t-lg md:rounded-t-none"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 md:rounded-l-lg rounded-t-lg md:rounded-t-none flex items-center justify-center text-gray-500">
                          <span className="text-sm">Interior Cabin</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Content - Mobile Responsive Layout */}
                  <div className="flex-grow flex flex-col p-5">
                    <div className="flex-grow mb-4">
                      <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-2">
                        Inside Cabin
                      </h3>
                      <p className="font-geograph text-[14px] text-gray-600 leading-relaxed">
                        Comfortable interior stateroom with twin beds that can convert to queen
                      </p>
                    </div>
                    
                    {/* Price and Button Layout - Mobile: side by side at bottom, Desktop: right aligned */}
                    <div className="flex flex-row md:flex-row items-end md:items-center justify-between md:justify-end gap-4">
                      <div className="text-left md:text-right">
                        <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                          STARTING FROM
                        </div>
                        <div className="font-geograph font-bold text-[24px] text-dark-blue">
                          {formatPrice(pricing.interiorPrice)}
                        </div>
                        <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                          +$50 onboard credit
                        </div>
                      </div>
                      <button className="bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-4 py-3 rounded-full hover:bg-[#2f7ddd]/90 transition-colors flex-shrink-0">
                        Get quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Outside Cabin Card */}
              <div className="bg-white rounded-t-lg rounded-b-none md:rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Cabin Image */}
                  <div className="md:w-48 md:h-auto flex-shrink-0" style={{ height: '128px' }}>
                    {(() => {
                      const oceanviewImage = getCabinImage('oceanview');
                      return oceanviewImage ? (
                        <img 
                          src={oceanviewImage} 
                          alt="Outside Cabin" 
                          className="w-full h-full object-cover md:rounded-l-lg rounded-t-lg md:rounded-t-none"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 md:rounded-l-lg rounded-t-lg md:rounded-t-none flex items-center justify-center text-gray-500">
                          <span className="text-sm">Outside Cabin</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Content - Mobile Responsive Layout */}
                  <div className="flex-grow flex flex-col p-5">
                    <div className="flex-grow mb-4">
                      <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-2">
                        Outside Cabin
                      </h3>
                      <p className="font-geograph text-[14px] text-gray-600 leading-relaxed">
                        Ocean view stateroom with window and twin beds that can convert to queen
                      </p>
                    </div>
                    
                    {/* Price and Button Layout - Mobile: side by side at bottom, Desktop: right aligned */}
                    <div className="flex flex-row md:flex-row items-end md:items-center justify-between md:justify-end gap-4">
                      <div className="text-left md:text-right">
                        <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                          STARTING FROM
                        </div>
                        <div className="font-geograph font-bold text-[24px] text-dark-blue">
                          {formatPrice(pricing.oceanviewPrice)}
                        </div>
                        <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                          +$75 onboard credit
                        </div>
                      </div>
                      <button className="bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-4 py-3 rounded-full hover:bg-[#2f7ddd]/90 transition-colors flex-shrink-0">
                        Get quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Balcony Cabin Card */}
              <div className="bg-white rounded-t-lg rounded-b-none md:rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Cabin Image */}
                  <div className="md:w-48 md:h-auto flex-shrink-0" style={{ height: '128px' }}>
                    {(() => {
                      const balconyImage = getCabinImage('balcony');
                      return balconyImage ? (
                        <img 
                          src={balconyImage} 
                          alt="Balcony Cabin" 
                          className="w-full h-full object-cover md:rounded-l-lg rounded-t-lg md:rounded-t-none"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 md:rounded-l-lg rounded-t-lg md:rounded-t-none flex items-center justify-center text-gray-500">
                          <span className="text-sm">Balcony Cabin</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Content - Mobile Responsive Layout */}
                  <div className="flex-grow flex flex-col p-5">
                    <div className="flex-grow mb-4">
                      <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-2">
                        Balcony Cabin
                      </h3>
                      <p className="font-geograph text-[14px] text-gray-600 leading-relaxed">
                        Private balcony stateroom with sliding glass door and ocean views
                      </p>
                    </div>
                    
                    {/* Price and Button Layout - Mobile: side by side at bottom, Desktop: right aligned */}
                    <div className="flex flex-row md:flex-row items-end md:items-center justify-between md:justify-end gap-4">
                      <div className="text-left md:text-right">
                        <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                          STARTING FROM
                        </div>
                        <div className="font-geograph font-bold text-[24px] text-dark-blue">
                          {formatPrice(pricing.balconyPrice)}
                        </div>
                        <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                          +$100 onboard credit
                        </div>
                      </div>
                      <button className="bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-4 py-3 rounded-full hover:bg-[#2f7ddd]/90 transition-colors flex-shrink-0">
                        Get quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Suite Cabin Card */}
              <div className="bg-white rounded-t-lg rounded-b-none md:rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Cabin Image */}
                  <div className="md:w-48 md:h-auto flex-shrink-0" style={{ height: '128px' }}>
                    {(() => {
                      const suiteImage = getCabinImage('suite');
                      return suiteImage ? (
                        <img 
                          src={suiteImage} 
                          alt="Suite Cabin" 
                          className="w-full h-full object-cover md:rounded-l-lg rounded-t-lg md:rounded-t-none"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 md:rounded-l-lg rounded-t-lg md:rounded-t-none flex items-center justify-center text-gray-500">
                          <span className="text-sm">Suite Cabin</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Content - Mobile Responsive Layout */}
                  <div className="flex-grow flex flex-col p-5">
                    <div className="flex-grow mb-4">
                      <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-2">
                        Suite Cabin
                      </h3>
                      <p className="font-geograph text-[14px] text-gray-600 leading-relaxed">
                        Spacious suite with separate living area, private balcony, and premium amenities
                      </p>
                    </div>
                    
                    {/* Price and Button Layout - Mobile: side by side at bottom, Desktop: right aligned */}
                    <div className="flex flex-row md:flex-row items-end md:items-center justify-between md:justify-end gap-4">
                      <div className="text-left md:text-right">
                        <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                          STARTING FROM
                        </div>
                        <div className="font-geograph font-bold text-[24px] text-dark-blue">
                          {formatPrice(pricing.suitePrice)}
                        </div>
                        <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                          +$150 onboard credit
                        </div>
                      </div>
                      <button className="bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-4 py-3 rounded-full hover:bg-[#2f7ddd]/90 transition-colors flex-shrink-0">
                        Get quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Itinerary Section */}
      {cruiseData?.itinerary && cruiseData.itinerary.length > 0 && (
        <div className="bg-sand py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-6">
              <h2 className="font-whitney font-black text-[32px] text-dark-blue uppercase mb-4" style={{ letterSpacing: '-0.02em' }}>
                ITINERARY
              </h2>
            </div>
            
            {/* Accordion Itinerary */}
            <div className="space-y-3 md:space-y-4">
              {cruiseData.itinerary.map((day, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
                >
                  {/* Question Button */}
                  <button
                    onClick={() => toggleAccordion(index)}
                    className="w-full px-6 md:px-8 py-4 md:py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 
                      className="font-geograph font-medium pr-6 md:pr-8 text-[16px] md:text-[20px]"
                      style={{
                        color: '#0E1B4D',
                        letterSpacing: '-0.02em',
                        lineHeight: '1.3'
                      }}
                    >
                      DAY {day.dayNumber} - {day.portName}
                    </h3>
                    <div 
                      className={`w-6 h-6 flex items-center justify-center transition-transform duration-300 ${
                        openAccordion === index ? 'rotate-180' : ''
                      }`}
                    >
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none"
                        className="text-dark-blue"
                      >
                        <path 
                          d="M6 9L12 15L18 9" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Answer Panel */}
                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      openAccordion === index 
                        ? 'max-h-96 opacity-100' 
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-6 md:px-8 pb-4 md:pb-6 pt-2">
                      {(day.arrivalTime || day.departureTime) && (
                        <div className="font-geograph text-[14px] md:text-[16px] text-gray-600 mb-3">
                          {day.arrivalTime && `Arrive: ${day.arrivalTime}`}
                          {day.arrivalTime && day.departureTime && ' | '}
                          {day.departureTime && `Depart: ${day.departureTime}`}
                        </div>
                      )}
                      {day.description && (
                        <p 
                          className="font-geograph text-[14px] md:text-[18px]"
                          style={{
                            color: '#0E1B4D',
                            letterSpacing: '-0.02em',
                            lineHeight: '1.6'
                          }}
                        >
                          {day.description}
                        </p>
                      )}
                      {day.overnight && (
                        <div className="mt-3">
                          <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                            OVERNIGHT STAY
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Separator */}
      <div className="w-full">
        <img 
          src="/images/separator-3.png" 
          alt="Section Separator" 
          className="w-full h-auto block"
        />
      </div>
    </div>
  );
}