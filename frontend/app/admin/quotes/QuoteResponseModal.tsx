'use client';

import { useState } from 'react';

interface Category {
  category: string;
  roomName?: string;
  cabinCode?: string;
  finalPrice: number;
  obcAmount: number;
}

interface QuoteResponseModalProps {
  quote: any;
  onClose: () => void;
  onSubmit: (quoteId: string, response: any) => Promise<void>;
}

export default function QuoteResponseModal({ quote, onClose, onSubmit }: QuoteResponseModalProps) {
  const [categories, setCategories] = useState<Category[]>([
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
    { category: '', roomName: '', cabinCode: '', finalPrice: 0, obcAmount: 0 },
  ]);
  
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCategoryChange = (index: number, field: keyof Category, value: string | number) => {
    const updatedCategories = [...categories];
    updatedCategories[index] = {
      ...updatedCategories[index],
      [field]: field === 'finalPrice' || field === 'obcAmount' ? Number(value) : value,
    };
    setCategories(updatedCategories);
  };

  const handleSubmit = async () => {
    // Filter out empty rows
    const validCategories = categories.filter(cat => cat.category && cat.finalPrice > 0);
    
    if (validCategories.length === 0) {
      alert('Please fill in at least one category with pricing');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(quote.id, {
        categories: validCategories,
        notes,
      });
    } catch (error) {
      console.error('Error submitting response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Respond to Quote Request #{quote.referenceNumber}
                </h3>
                
                {/* Quote Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Cruise:</span> {quote.cruise?.cruiseName || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Ship:</span> {quote.cruise?.shipName || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Departure:</span> {quote.cruise?.departureDate ? new Date(quote.cruise.departureDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Passengers:</span> {quote.passengerCount}
                    </div>
                    <div>
                      <span className="font-medium">Requested Cabin:</span> {quote.cabinType}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {quote.contactInfo?.email || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Pricing Table */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Cabin Categories & Pricing</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Room Name (Optional)
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cabin Code (Optional)
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Final Price ($)
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            OBC Amount ($)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map((cat, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={cat.category}
                                onChange={(e) => handleCategoryChange(index, 'category', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Interior"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={cat.roomName || ''}
                                onChange={(e) => handleCategoryChange(index, 'roomName', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Ocean View Stateroom"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={cat.cabinCode || ''}
                                onChange={(e) => handleCategoryChange(index, 'cabinCode', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., INT, BAL, SUI"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                value={cat.finalPrice || ''}
                                onChange={(e) => handleCategoryChange(index, 'finalPrice', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                value={cat.obcAmount || ''}
                                onChange={(e) => handleCategoryChange(index, 'obcAmount', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                                min="0"
                                step="0.01"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any special notes or instructions for the customer..."
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending...' : 'Send Quote'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}