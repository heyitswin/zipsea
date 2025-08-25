'use client';

import { useEffect, useState } from 'react';

interface GlobalAlertProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function GlobalAlert({ message, isVisible, onClose }: GlobalAlertProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Start fade-in animation after a small delay
      setTimeout(() => {
        setIsAnimating(true);
      }, 10);
      
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const handleClose = () => {
    setIsAnimating(false);
    // Wait for fade-out animation to complete before hiding
    setTimeout(() => {
      setShouldRender(false);
      onClose();
    }, 300);
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed left-1/2 transform -translate-x-1/2 z-[10001] transition-all duration-300 ease-out ${
        isAnimating 
          ? 'translate-y-0 opacity-100' 
          : '-translate-y-full opacity-0'
      }`}
      style={{
        top: '100px',
        backgroundColor: 'white',
        borderRadius: '50px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div className="px-6 py-3">
        <div className="flex items-center gap-4">
          <p 
            className="font-geograph font-medium text-[16px] tracking-tight whitespace-nowrap"
            style={{ color: '#2f2f2f' }}
          >
            {message}
          </p>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Close alert"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}