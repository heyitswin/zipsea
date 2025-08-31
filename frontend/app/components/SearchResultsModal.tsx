'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { searchCruises, Cruise } from '../../lib/api';
import { createSlugFromCruise } from '../../lib/slug';
import { trackSearch } from '../../lib/analytics';
import { useAlert } from '../../components/GlobalAlertProvider';

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchParams: {
    shipId: number;
    shipName: string;
    cruiseLineName: string;
    date: Date;
  } | null;
}

export default function SearchResultsModal({ isOpen, onClose, searchParams }: SearchResultsModalProps) {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Cruise[]>([]);

  useEffect(() => {
    if (isOpen && searchParams) {
      performSearch();
    }
  }, [isOpen, searchParams]);

  const performSearch = async () => {
    if (!searchParams) return;
    
    setIsSearching(true);
    try {
      const apiParams = {
        shipId: searchParams.shipId,
        shipName: searchParams.shipName,
        departureDate: searchParams.date.toISOString().split('T')[0]
      };
      
      const searchResults = await searchCruises(apiParams);
      
      // Track search event
      trackSearch({
        destination: searchParams.shipName,
        departurePort: undefined,
        cruiseLine: searchParams.cruiseLineName,
        dateRange: searchParams.date.toISOString().split('T')[0],
        resultsCount: searchResults.length
      });
      
      // Handle results
      if (searchResults.length === 0) {
        showAlert('No cruises found for the selected ship and date. Try different dates or ships.');
        onClose();
      } else if (searchResults.length === 1) {
        // Navigate directly to the cruise detail page
        const cruise = searchResults[0];
        const slug = createSlugFromCruise(cruise);
        router.push(`/cruise/${slug}`);
        onClose();
      } else {
        // Show multiple results
        setResults(searchResults);
      }
    } catch (error) {
      console.error('Search error:', error);
      showAlert('Failed to search cruises. Please try again.');
      onClose();
    } finally {
      setIsSearching(false);
    }
  };

  const handleCruiseClick = (cruise: Cruise) => {
    const slug = createSlugFromCruise(cruise);
    router.push(`/cruise/${slug}`);
    onClose();
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Call for price';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl max-w-4xl w-[90%] max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-dark-blue text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Search Results</h2>
            {searchParams && (
              <p className="text-pink-300 mt-1">
                {searchParams.shipName} • {formatDate(searchParams.date.toISOString())}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-pink-300 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-blue"></div>
              <p className="mt-4 text-gray-600">Searching for cruises...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Found {results.length} cruise{results.length !== 1 ? 's' : ''} matching your search
              </p>
              {results.map((cruise, index) => (
                <div
                  key={`${cruise.id}-${index}`}
                  onClick={() => handleCruiseClick(cruise)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer hover:border-dark-blue"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-dark-blue">
                        {cruise.name || `${cruise.ship_name} - ${cruise.duration}`}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {cruise.ship_name} • {cruise.cruise_line}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Departure:</span> {formatDate(cruise.departure_date)}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Duration:</span> {cruise.duration}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Ports:</span> {cruise.departure_port} → {cruise.arrival_port}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500 mb-1">From</p>
                      <p className="text-2xl font-bold text-dark-blue">
                        {formatPrice(
                          cruise.interior_cheapest_price ||
                          cruise.oceanview_cheapest_price ||
                          cruise.balcony_cheapest_price ||
                          cruise.suite_cheapest_price
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">per person</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No results to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}