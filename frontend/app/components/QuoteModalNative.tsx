'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useAlert } from '../../components/GlobalAlertProvider';
import { trackQuoteProgress, trackQuoteSubmit } from '../../lib/analytics';

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

export default function QuoteModalNative({ isOpen, onClose, cruiseData, cabinType, cabinPrice }: QuoteModalProps) {
  const { isSignedIn, user, isLoaded } = useUser();
  const { showAlert } = useAlert();
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

  // Define submitQuote using useCallback to avoid re-creation
  const submitQuote = useCallback(async (data: any) => {
    try {
      // Ensure we have user email
      if (!data.userEmail && user?.emailAddresses?.[0]?.emailAddress) {
        data.userEmail = user.emailAddresses[0].emailAddress;
      }

      const response = await fetch('/api/send-quote-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Quote submission result:', result);
        
        // Track successful submission
        const activeDiscounts = Object.entries(data.discounts || {})
          .filter(([key, value]) => value && key !== 'stateOfResidence' && key !== 'loyaltyNumber')
          .map(([key]) => key);
        
        if (data.discounts?.stateOfResidence) activeDiscounts.push('stateOfResidence');
        if (data.discounts?.loyaltyNumber) activeDiscounts.push('loyaltyNumber');
        
        trackQuoteSubmit({
          cruiseId: data.cruiseData?.id || '',
          cabinType: data.cabinType || '',
          adults: data.passengers?.adults || 2,
          children: data.passengers?.children || 0,
          hasDiscounts: activeDiscounts.length > 0,
          discountTypes: activeDiscounts,
          travelInsurance: data.discounts?.travelInsurance || false,
          estimatedPrice: typeof data.cabinPrice === 'string' ? parseFloat(data.cabinPrice) : data.cabinPrice
        });
        
        // Show success message with details about what worked
        let message = 'Quote request submitted! We\'ll email you as soon as your quote is ready.';
        if (result.details && (!result.details.emailSent || !result.details.slackSent)) {
          message += ' (Some notifications may be delayed)';
        }
        showAlert(message);
        onClose();
        
        // Clear the pending quote from sessionStorage
        sessionStorage.removeItem('pendingQuote');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Quote submission failed:', errorData);
        showAlert('There was an error submitting your quote request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting quote request:', error);
      showAlert('There was an error submitting your quote request. Please try again.');
    }
  }, [user, showAlert, onClose]);

  // Check if we have pending quote data in sessionStorage after login
  useEffect(() => {
    if (isLoaded && isSignedIn && user && typeof window !== 'undefined') {
      const pendingQuote = sessionStorage.getItem('pendingQuote');
      if (pendingQuote) {
        try {
          const quoteData = JSON.parse(pendingQuote);
          // Update email with the signed-in user's email
          quoteData.userEmail = user.emailAddresses[0]?.emailAddress;
          
          console.log('Processing pending quote after sign-in:', quoteData);
          
          // Submit the pending quote - use a timeout to ensure modal is properly mounted
          setTimeout(() => {
            submitQuote(quoteData);
          }, 100);
        } catch (error) {
          console.error('Error processing pending quote:', error);
          sessionStorage.removeItem('pendingQuote');
        }
      }
    }
  }, [isLoaded, isSignedIn, user, submitQuote]);
  
  // Additional effect to handle pending quotes when the modal opens
  useEffect(() => {
    if (isOpen && isLoaded && isSignedIn && user && typeof window !== 'undefined') {
      const pendingQuote = sessionStorage.getItem('pendingQuote');
      if (pendingQuote) {
        try {
          const quoteData = JSON.parse(pendingQuote);
          // Update email with the signed-in user's email
          quoteData.userEmail = user.emailAddresses[0]?.emailAddress;
          
          console.log('Processing pending quote when modal opens:', quoteData);
          
          // Submit the pending quote immediately when modal is open
          submitQuote(quoteData);
        } catch (error) {
          console.error('Error processing pending quote when modal opens:', error);
          sessionStorage.removeItem('pendingQuote');
        }
      }
    }
  }, [isOpen, isLoaded, isSignedIn, user, submitQuote]);

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
      
      trackQuoteProgress('passenger_selection', {
        passenger_type: type,
        count: newValue,
        action: increment ? 'increase' : 'decrease'
      });
      
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
    
    trackQuoteProgress('discount_selection', {
      discount_type: field,
      value: value
    });
  };

  const handleGetFinalQuotes = async () => {
    const quoteData = {
      userEmail: user?.emailAddresses?.[0]?.emailAddress,
      cruiseData,
      passengers,
      discounts,
      cabinType,
      cabinPrice,
      travelInsurance: discounts.travelInsurance,
    };

    if (!isSignedIn) {
      // Save quote data to sessionStorage - it will be submitted after sign-in
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingQuote', JSON.stringify(quoteData));
        // Save current URL to redirect back after sign-in
        sessionStorage.setItem('redirectAfterSignIn', window.location.pathname + window.location.search);
        console.log('Saving pending quote and current URL for after sign-in');
      }
      // The SignInButton will handle showing the modal
      return;
    }

    // User is logged in, submit the quote
    await submitQuote(quoteData);
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
                <span className="flex-1 text-center font-geograph text-[32px]">
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
                <span className="flex-1 text-center font-geograph text-[32px]">
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
            <div className="border border-[#d9d9d9] rounded-[10px] p-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative mr-3">
                  <input
                    type="checkbox"
                    checked={discounts.travelInsurance}
                    onChange={(e) => handleDiscountChange('travelInsurance', e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-6 h-6 border rounded flex items-center justify-center ${
                    discounts.travelInsurance 
                      ? 'bg-[#2F7DDD] border-[#2F7DDD]' 
                      : 'bg-white border-[#d9d9d9]'
                  }`}>
                    {discounts.travelInsurance && (
                      <img src="/images/checkmark.svg" alt="Checked" className="w-4 h-4" />
                    )}
                  </div>
                </div>
                <span className="font-geograph text-[18px] text-[#2f2f2f]" style={{ letterSpacing: '0px' }}>
                  I'm interested in travel insurance for this cruise
                </span>
              </label>
            </div>
          </div>

          {/* Discount Qualifiers Section */}
          <div className="mb-8">
            <h3 className="font-whitney font-black text-[32px] text-dark-blue uppercase mb-1" style={{ letterSpacing: '-0.02em' }}>
              DISCOUNT QUALIFIERS
            </h3>
            <p className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5] mb-6" style={{ letterSpacing: '-0.02em' }}>
              All optional, but might help you get more discounts off your cruise
            </p>

            <div className="space-y-4">
              {/* Pay in Full Checkbox */}
              <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                <label className="flex items-center cursor-pointer">
                  <div className="relative mr-3">
                    <input
                      type="checkbox"
                      checked={discounts.payInFull}
                      onChange={(e) => handleDiscountChange('payInFull', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 border rounded flex items-center justify-center ${
                      discounts.payInFull 
                        ? 'bg-[#2F7DDD] border-[#2F7DDD]' 
                        : 'bg-white border-[#d9d9d9]'
                    }`}>
                      {discounts.payInFull && (
                        <img src="/images/checkmark.svg" alt="Checked" className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <span className="font-geograph text-[18px] text-[#2f2f2f]" style={{ letterSpacing: '0px' }}>
                    I want to pay in full/non-refundable
                  </span>
                </label>
              </div>

              {/* 55+ Checkbox */}
              <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                <label className="flex items-center cursor-pointer">
                  <div className="relative mr-3">
                    <input
                      type="checkbox"
                      checked={discounts.age55Plus}
                      onChange={(e) => handleDiscountChange('age55Plus', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 border rounded flex items-center justify-center ${
                      discounts.age55Plus 
                        ? 'bg-[#2F7DDD] border-[#2F7DDD]' 
                        : 'bg-white border-[#d9d9d9]'
                    }`}>
                      {discounts.age55Plus && (
                        <img src="/images/checkmark.svg" alt="Checked" className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <span className="font-geograph text-[18px] text-[#2f2f2f]" style={{ letterSpacing: '0px' }}>
                    I am 55 or older
                  </span>
                </label>
              </div>

              {/* Military Checkbox */}
              <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                <label className="flex items-center cursor-pointer">
                  <div className="relative mr-3">
                    <input
                      type="checkbox"
                      checked={discounts.military}
                      onChange={(e) => handleDiscountChange('military', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 border rounded flex items-center justify-center ${
                      discounts.military 
                        ? 'bg-[#2F7DDD] border-[#2F7DDD]' 
                        : 'bg-white border-[#d9d9d9]'
                    }`}>
                      {discounts.military && (
                        <img src="/images/checkmark.svg" alt="Checked" className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <span className="font-geograph text-[18px] text-[#2f2f2f]" style={{ letterSpacing: '0px' }}>
                    I am an active/retired military member or veteran
                  </span>
                </label>
              </div>

              {/* State of Residence Dropdown */}
              <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                <select
                  value={discounts.stateOfResidence}
                  onChange={(e) => handleDiscountChange('stateOfResidence', e.target.value)}
                  className="w-full border-none outline-none font-geograph text-[18px] text-[#2f2f2f] bg-transparent"
                  style={{ letterSpacing: '0px' }}
                >
                  <option value="">State of Residence</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              {/* Loyalty Number Input */}
              <div className="border border-[#d9d9d9] rounded-[10px] p-4">
                <input
                  type="text"
                  value={discounts.loyaltyNumber}
                  onChange={(e) => handleDiscountChange('loyaltyNumber', e.target.value)}
                  placeholder="Loyalty Number"
                  className="w-full border-none outline-none font-geograph text-[18px] text-[#2f2f2f] bg-transparent"
                  style={{ letterSpacing: '0px' }}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          {isSignedIn ? (
            <button
              onClick={handleGetFinalQuotes}
              className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors"
            >
              Get final quotes
            </button>
          ) : (
            <SignInButton 
              mode="modal"
            >
              <button
                onClick={handleGetFinalQuotes}
                className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors"
              >
                Sign in to get final quotes
              </button>
            </SignInButton>
          )}

        </div>
      </div>
    </div>
  );
}