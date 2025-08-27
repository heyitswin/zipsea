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
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC' // Use UTC to avoid timezone conversion issues
      }).toUpperCase();
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
    <div className="min-h-screen pt-[60px] md:pt-[80px]">

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
      <div className="bg-purple-obc py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left Side Content */}
            <div>
              {/* Cruise Name */}
              <h1 className="font-whitney text-[52px] text-dark-blue mb-4" style={{ letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                {cruise.name || `${ship?.name || 'Unknown Ship'} Cruise`}
              </h1>
              
              {/* Cruise Line | Ship Name */}
              <div className="text-dark-blue text-[24px] font-geograph font-medium mb-12" style={{ letterSpacing: '-0.02em' }}>
                {cruiseLine?.name || 'Unknown Cruise Line'} | {ship?.name || 'Unknown Ship'}
              </div>
              
              {/* Information Grid - 2x2 Layout */}
              <div className="grid grid-cols-2 gap-8">
                {/* Depart */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    DEPART
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
                    {formatDate(cruise.sailingDate)}
                  </div>
                </div>
                
                {/* Return */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    RETURN
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
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
                  <div className="text-[24px] font-whitney text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
                    {embarkPort?.name || 'N/A'}
                  </div>
                </div>
                
                {/* Nights */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    NIGHTS
                  </div>
                  <div className="text-[24px] font-whitney text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
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
                  className="w-full max-w-md h-auto rounded-[10px] object-cover"
                  style={{ maxHeight: '400px' }}
                />
              ) : (
                <div className="w-full max-w-md h-64 bg-gray-200 rounded-[10px] flex items-center justify-center text-gray-500">
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
          
          {/* Navigation Breadcrumbs */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="bg-gray-200 text-gray-600 px-4 py-2 rounded-md mr-4 hover:bg-gray-300 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-light-blue text-white px-4 py-2 rounded-md hover:bg-light-blue/90 transition-colors"
            >
              Back to Search
            </button>
          </div>
          
          {/* Description Section */}
          {ship?.shortDescription && (
            <div className="mb-12">
              <p className="font-geograph text-[24px] leading-[1.5] text-dark-blue" style={{ letterSpacing: '-0.02em' }}>
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

      {/* Pricing Section - Updated to use new data structure */}
      {pricing && (
        <div className="bg-sand py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '600', 
                color: '#2d3748',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.5rem'
              }}>
                Starting Prices (Per Person)
              </h2>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1.5rem' 
              }}>
                <div style={{ 
                  backgroundColor: '#f7fafc', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
                    Interior
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' }}>
                    {formatPrice(pricing.interiorPrice)}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#f7fafc', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
                    Oceanview
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' }}>
                    {formatPrice(pricing.oceanviewPrice)}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#f7fafc', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
                    Balcony
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' }}>
                    {formatPrice(pricing.balconyPrice)}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#f7fafc', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
                    Suite
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2d3748' }}>
                    {formatPrice(pricing.suitePrice)}
                  </div>
                </div>
              </div>
              
              <div style={{ 
                marginTop: '1.5rem', 
                fontSize: '0.875rem', 
                color: '#718096',
                textAlign: 'center'
              }}>
                Prices shown are per person based on double occupancy and subject to availability. 
                Currency: {pricing.currency}. Last updated: {formatDateShort(pricing.lastUpdated)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Itinerary Section */}
      {cruiseData?.itinerary && cruiseData.itinerary.length > 0 && (
        <div className="bg-sand py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '600', 
                color: '#2d3748',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.5rem'
              }}>
                {cruiseData.itinerary.length}-Day Itinerary
              </h2>
              
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {cruiseData.itinerary.map((day, index) => (
                  <div key={index} style={{ 
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '1.5rem',
                    backgroundColor: day.portName === 'At Sea' ? '#f0f9ff' : '#f7fafc',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${day.portName === 'At Sea' ? '#0ea5e9' : '#4299e1'}`,
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ 
                      minWidth: '60px',
                      backgroundColor: day.portName === 'At Sea' ? '#0ea5e9' : '#4299e1',
                      color: 'white',
                      borderRadius: '50%',
                      width: '50px',
                      height: '50px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '1.1rem',
                      marginRight: '1.5rem',
                      flexShrink: 0
                    }}>
                      {day.dayNumber}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2d3748', marginBottom: '0.5rem' }}>
                        {day.portName}
                      </div>
                      {(day.arrivalTime || day.departureTime) && (
                        <div style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '0.75rem' }}>
                          {day.arrivalTime && `Arrive: ${day.arrivalTime}`}
                          {day.arrivalTime && day.departureTime && ' | '}
                          {day.departureTime && `Depart: ${day.departureTime}`}
                        </div>
                      )}
                      {day.description && (
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: '#4a5568', 
                          marginTop: '0.75rem',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-line'
                        }}>
                          {day.description}
                        </div>
                      )}
                      {day.overnight && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#9f7aea', 
                          marginTop: '0.5rem',
                          fontWeight: '600'
                        }}>
                          OVERNIGHT STAY
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Ship Details */}
      {ship && (Object.keys(ship).length > 2 || ship.tonnage || ship.starRating) && (
        <div className="bg-sand py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '600', 
                color: '#2d3748',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.5rem'
              }}>
                Ship Specifications
              </h2>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1.5rem' 
              }}>
                {ship.starRating && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                      Star Rating
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748', display: 'flex', alignItems: 'center' }}>
                      {Array.from({ length: ship.starRating }, (_, i) => (
                        <span key={i} style={{ color: '#f6ad55', marginRight: '2px' }}>★</span>
                      ))}
                      <span style={{ marginLeft: '0.5rem' }}>{ship.starRating} Stars</span>
                    </div>
                  </div>
                )}

                {ship.tonnage && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                      Gross Tonnage
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748' }}>
                      {ship.tonnage.toLocaleString()} GT
                    </div>
                  </div>
                )}
                
                {ship.length && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                      Length
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748' }}>
                      {ship.length} ft
                    </div>
                  </div>
                )}

                {ship.raw?.launched && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                      Launched
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748' }}>
                      {new Date(ship.raw.launched).getFullYear()}
                    </div>
                  </div>
                )}

                {ship.raw?.totalCabins && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                      Total Cabins
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748' }}>
                      {ship.raw.totalCabins.toLocaleString()}
                    </div>
                  </div>
                )}

                {ship.raw?.occupancy && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                      Guest Capacity
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748' }}>
                      {ship.raw.occupancy.toLocaleString()} guests
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Cabin Categories Section */}
      {cruiseData?.cabinCategories && cruiseData.cabinCategories.length > 0 && (
        <div className="bg-sand py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '600', 
                color: '#2d3748',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.5rem'
              }}>
                Cabin Categories ({cruiseData.cabinCategories.length} options)
              </h2>
              
              {/* Group cabins by category */}
              {(() => {
                const cabinGroups = cruiseData.cabinCategories.reduce((groups, cabin) => {
                  const category = cabin.category || 'Other';
                  if (!groups[category]) groups[category] = [];
                  groups[category].push(cabin);
                  return groups;
                }, {} as Record<string, typeof cruiseData.cabinCategories>);

                const categoryOrder = ['interior', 'oceanview', 'balcony', 'suite'];
                const sortedCategories = Object.keys(cabinGroups).sort((a, b) => {
                  const aIndex = categoryOrder.indexOf(a.toLowerCase());
                  const bIndex = categoryOrder.indexOf(b.toLowerCase());
                  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                  if (aIndex === -1) return 1;
                  if (bIndex === -1) return -1;
                  return aIndex - bIndex;
                });

                return sortedCategories.map(category => (
                  <div key={category} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ 
                      fontSize: '1.3rem', 
                      fontWeight: '600', 
                      color: '#2d3748', 
                      marginBottom: '1rem',
                      textTransform: 'capitalize'
                    }}>
                      {category} Cabins ({cabinGroups[category].length})
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '1.5rem'
                    }}>
                      {cabinGroups[category].slice(0, 6).map((cabin, index) => (
                        <div key={index} style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: '#fafafa'
                        }}>
                          {cabin.imageUrl && (
                            <img 
                              src={cabin.imageUrlHd || cabin.imageUrl}
                              alt={cabin.name}
                              style={{
                                width: '100%',
                                height: '150px',
                                objectFit: 'cover'
                              }}
                            />
                          )}
                          <div style={{ padding: '1rem' }}>
                            <h4 style={{ 
                              fontSize: '1rem', 
                              fontWeight: '600', 
                              color: '#2d3748',
                              marginBottom: '0.5rem',
                              lineHeight: '1.3'
                            }}>
                              {cabin.name}
                            </h4>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#718096',
                              marginBottom: '0.5rem',
                              display: 'flex',
                              gap: '1rem'
                            }}>
                              <span>Code: {cabin.cabinCode}</span>
                              <span>Occupancy: {cabin.minOccupancy}-{cabin.maxOccupancy}</span>
                            </div>
                            {cabin.description && (
                              <p style={{
                                fontSize: '0.875rem',
                                color: '#4a5568',
                                lineHeight: '1.4',
                                whiteSpace: 'pre-line',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {cabin.description.length > 150 
                                  ? cabin.description.substring(0, 150) + '...'
                                  : cabin.description
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {cabinGroups[category].length > 6 && (
                      <div style={{ 
                        color: '#718096', 
                        fontSize: '0.875rem', 
                        marginTop: '1rem',
                        textAlign: 'center'
                      }}>
                        Showing 6 of {cabinGroups[category].length} {category} cabins
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Ports & Regions - if available */}
      {(cruiseData?.ports?.length || cruiseData?.regions?.length) && (
        <div className="bg-sand py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '600', 
                color: '#2d3748',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.5rem'
              }}>
                Destinations
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {cruiseData?.regions && cruiseData.regions.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#2d3748', marginBottom: '1rem' }}>
                      Regions
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {cruiseData.regions.map((region, index) => (
                        <span key={index} style={{
                          backgroundColor: '#ebf8ff',
                          color: '#2b6cb0',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          {region.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {cruiseData?.ports && cruiseData.ports.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#2d3748', marginBottom: '1rem' }}>
                      Ports of Call
                    </h3>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {cruiseData.ports.slice(0, 10).map((port, index) => (
                        <div key={index} style={{
                          padding: '0.5rem',
                          backgroundColor: '#f7fafc',
                          borderRadius: '6px',
                          fontSize: '0.875rem'
                        }}>
                          <span style={{ fontWeight: '600', color: '#2d3748' }}>{port.name}</span>
                          {port.country && (
                            <span style={{ color: '#718096', marginLeft: '0.5rem' }}>
                              ({port.country})
                            </span>
                          )}
                        </div>
                      ))}
                      {cruiseData.ports.length > 10 && (
                        <div style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                          ...and {cruiseData.ports.length - 10} more ports
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Information */}
      <div className="bg-sand py-16">
        <div className="max-w-7xl mx-auto px-6">
          {cruiseData && (
            <details style={{ 
              marginTop: '2rem',
              backgroundColor: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <summary style={{ 
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '1rem'
              }}>
                Debug Information (Click to expand)
              </summary>
              <pre style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '0.75rem',
                border: '1px solid #e2e8f0',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify({ 
                  slug, 
                  isUsingFallback,
                  cruiseId: cruise?.id,
                  hasComprehensiveData: !!cruiseData,
                  hasPricing: !!pricing,
                  hasItinerary: !!cruiseData?.itinerary?.length,
                  hasCabinCategories: !!cruiseData?.cabinCategories?.length,
                  hasShipImage: !!ship?.defaultShipImage,
                  hasCruiseLineLogo: !!cruiseLine?.raw?.logo,
                  meta: cruiseData?.meta || 'No meta'
                }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}