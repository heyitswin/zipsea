'use client';

import { useState } from 'react';
import { useUser } from '../hooks/useClerkHooks';
import LoginSignupModal from './LoginSignupModal';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cruiseData?: {
    id?: string;
    name?: string;
    cruiseLineName?: string;
    shipName?: string;
    sailingDate?: string;
    nights?: number;
  };
  cabinType?: string;
  cabinPrice?: string | number;
}

interface PassengerData {
  adults: number;
  children: number;
}

interface DiscountData {
  payInFull: boolean;
  age55Plus: boolean;
  military: boolean;
  stateOfResidence: string;
  loyaltyNumber: string;
  travelInsurance: boolean;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

export default function QuoteModal({ isOpen, onClose, cruiseData, cabinType, cabinPrice }: QuoteModalProps) {
  const { isSignedIn, user } = useUser();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passengers, setPassengers] = useState<PassengerData>({
    adults: 2,
    children: 0
  });
  
  const [discounts, setDiscounts] = useState<DiscountData>({
    payInFull: false,
    age55Plus: false,
    military: false,
    stateOfResidence: '',
    loyaltyNumber: '',
    travelInsurance: false
  });

  if (!isOpen) return null;

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePassengerChange = (type: 'adults' | 'children', increment: boolean) => {
    setPassengers(prev => {
      const currentValue = prev[type];
      let newValue: number;
      
      if (increment) {
        newValue = currentValue + 1;
      } else {
        newValue = Math.max(type === 'adults' ? 1 : 0, currentValue - 1);
      }
      
      return {
        ...prev,
        [type]: newValue
      };
    });
  };

  const handleDiscountChange = (field: keyof DiscountData, value: boolean | string) => {
    setDiscounts(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGetFinalQuotes = async () => {
    if (!isSignedIn) {
      setShowLoginModal(true);
      return;
    }

    // User is logged in, send confirmation email
    try {
      const response = await fetch('/api/send-quote-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user?.emailAddresses[0]?.emailAddress,
          cruiseData,
          passengers,
          discounts,
          cabinType,
          cabinPrice,
        }),
      });

      if (response.ok) {
        alert('Quote request submitted! We\'ll email you as soon as your quote is ready.');
        onClose();
      } else {
        alert('There was an error submitting your quote request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting quote request:', error);
      alert('There was an error submitting your quote request. Please try again.');
    }
  };

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

  return (
    <>
      {/* Main Quote Modal */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        onClick={handleBackgroundClick}
      >
        <div 
          className="bg-white w-full max-w-[760px] rounded-[10px] max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8">
            {/* Header */}
            <div className="mb-8">
              <h2 className="font-whitney font-black text-[32px] text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
                PASSENGERS
              </h2>
            </div>

            {/* Passenger Input Section */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Adults */}
              <div>
                <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                  ADULTS
                </label>
                <div className="flex items-center border border-[#d9d9d9] rounded-[10px] p-3">
                  <button 
                    onClick={() => handlePassengerChange('adults', false)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                  >
                    <img src="/images/minus.svg" alt="Decrease" className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center font-geograph text-[16px]">
                    {passengers.adults}
                  </span>
                  <button 
                    onClick={() => handlePassengerChange('adults', true)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                  >
                    <img src="/images/plus.svg" alt="Increase" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div>
                <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                  CHILDREN
                </label>
                <div className="flex items-center border border-[#d9d9d9] rounded-[10px] p-3">
                  <button 
                    onClick={() => handlePassengerChange('children', false)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                  >
                    <img src="/images/minus.svg" alt="Decrease" className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center font-geograph text-[16px]">
                    {passengers.children}
                  </span>
                  <button 
                    onClick={() => handlePassengerChange('children', true)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                  >
                    <img src="/images/plus.svg" alt="Increase" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Travel Insurance Checkbox */}
            <div className="mb-8">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={discounts.travelInsurance}
                  onChange={(e) => handleDiscountChange('travelInsurance', e.target.checked)}
                  className="mr-3 w-4 h-4"
                />
                <span className="font-geograph text-[16px] text-[#474747]">
                  I'm interested in travel insurance for this cruise
                </span>
              </label>
            </div>

            {/* Discount Qualifiers Section */}
            <div className="mb-8">
              <h3 className="font-whitney font-black text-[32px] text-dark-blue uppercase mb-2" style={{ letterSpacing: '-0.02em' }}>
                DISCOUNT QUALIFIERS
              </h3>
              <p className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5] mb-6" style={{ letterSpacing: '-0.02em' }}>
                All optional, but might help you get more discounts off your cruise
              </p>

              <div className="space-y-4">
                {/* Pay in Full Checkbox */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discounts.payInFull}
                    onChange={(e) => handleDiscountChange('payInFull', e.target.checked)}
                    className="mr-3 w-4 h-4"
                  />
                  <span className="font-geograph text-[16px] text-[#474747]">
                    I want to pay in full/non-refundable
                  </span>
                </label>

                {/* 55+ Checkbox */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discounts.age55Plus}
                    onChange={(e) => handleDiscountChange('age55Plus', e.target.checked)}
                    className="mr-3 w-4 h-4"
                  />
                  <span className="font-geograph text-[16px] text-[#474747]">
                    I am 55 or older
                  </span>
                </label>

                {/* Military Checkbox */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discounts.military}
                    onChange={(e) => handleDiscountChange('military', e.target.checked)}
                    className="mr-3 w-4 h-4"
                  />
                  <span className="font-geograph text-[16px] text-[#474747]">
                    I am an active/retired military member or veteran
                  </span>
                </label>

                {/* State of Residence Dropdown */}
                <div>
                  <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                    State of Residence
                  </label>
                  <select
                    value={discounts.stateOfResidence}
                    onChange={(e) => handleDiscountChange('stateOfResidence', e.target.value)}
                    className="w-full border border-[#d9d9d9] rounded-[10px] p-3 font-geograph text-[16px]"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                {/* Loyalty Number Input */}
                <div>
                  <label className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-3 block">
                    Loyalty Number
                  </label>
                  <input
                    type="text"
                    value={discounts.loyaltyNumber}
                    onChange={(e) => handleDiscountChange('loyaltyNumber', e.target.value)}
                    placeholder="Enter your loyalty number (optional)"
                    className="w-full border border-[#d9d9d9] rounded-[10px] p-3 font-geograph text-[16px]"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleGetFinalQuotes}
              className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors"
            >
              Get final quotes
            </button>

            {/* Cruise Summary (Optional) */}
            {cruiseData && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-geograph font-bold text-[14px] text-[#474747] tracking-[0.1em] uppercase mb-2">
                  CRUISE DETAILS
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Cruise:</strong> {cruiseData.name}</p>
                  <p><strong>Cabin Type:</strong> {cabinType}</p>
                  <p><strong>Price:</strong> {formatPrice(cabinPrice)}</p>
                  <p><strong>Adults:</strong> {passengers.adults}, <strong>Children:</strong> {passengers.children}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login/Signup Modal */}
      {showLoginModal && (
        <LoginSignupModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            handleGetFinalQuotes(); // Retry after successful login
          }}
        />
      )}
    </>
  );
}