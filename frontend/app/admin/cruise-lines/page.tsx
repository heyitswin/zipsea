'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '../../hooks/useAdmin';
import { useAlert } from '../../../components/GlobalAlertProvider';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

interface CruiseLineStats {
  id: number;
  name: string;
  code: string;
  totalCruises: number;
  activeCruises: number;
  lastUpdated: string;
  recentlyUpdated: number;
  lastSyncDate?: string;
}

export default function AdminCruiseLines() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { showAlert } = useAlert();
  
  const [cruiseLines, setCruiseLines] = useState<CruiseLineStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalLines: 0,
    totalCruises: 0,
    updatedToday: 0,
    updatedThisWeek: 0,
  });

  // Check admin access
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      showAlert('You do not have permission to access this page');
      router.push('/');
    }
  }, [isAdmin, adminLoading, router, showAlert]);

  // Fetch cruise lines data
  useEffect(() => {
    if (isAdmin) {
      fetchCruiseLines();
    }
  }, [isAdmin]);

  const fetchCruiseLines = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://zipsea-production.onrender.com';
      
      const response = await fetch(`${backendUrl}/api/v1/admin/cruise-lines/stats`);
      if (response.ok) {
        const data = await response.json();
        setCruiseLines(data.cruiseLines || []);
        setTotalStats(data.stats || {
          totalLines: 0,
          totalCruises: 0,
          updatedToday: 0,
          updatedThisWeek: 0,
        });
      } else {
        console.error('Failed to fetch cruise lines:', response.status);
        showAlert('Failed to load cruise lines data');
      }
    } catch (error) {
      console.error('Error fetching cruise lines:', error);
      showAlert('Error loading cruise lines data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Less than 1 hour ago';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getUpdateStatusColor = (lastUpdated: string) => {
    if (!lastUpdated) return 'text-gray-500';
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) return 'text-green-600';
    if (diffHours < 72) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading cruise lines data...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cruise Lines Management</h1>
              <p className="mt-1 text-sm text-gray-500">Monitor cruise inventory and sync status</p>
            </div>
            
            {/* Back to Dashboard */}
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Cruise Lines</p>
            <p className="text-2xl font-bold text-gray-900">{totalStats.totalLines}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Cruises</p>
            <p className="text-2xl font-bold text-gray-900">{totalStats.totalCruises.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Updated Today</p>
            <p className="text-2xl font-bold text-green-600">{totalStats.updatedToday.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Updated This Week</p>
            <p className="text-2xl font-bold text-blue-600">{totalStats.updatedThisWeek.toLocaleString()}</p>
          </div>
        </div>

        {/* Cruise Lines Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Cruise Lines Overview</h2>
            <button
              onClick={fetchCruiseLines}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cruise Line
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cruises
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Cruises
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recently Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Sync
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cruiseLines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{line.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{line.code || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{line.totalCruises.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{line.activeCruises.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {line.recentlyUpdated > 0 ? (
                          <span className="text-green-600 font-medium">
                            {line.recentlyUpdated.toLocaleString()} cruises
                          </span>
                        ) : (
                          <span className="text-gray-400">0 cruises</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${getUpdateStatusColor(line.lastUpdated)}`}>
                        {formatDate(line.lastUpdated)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {line.lastUpdated && new Date(line.lastUpdated) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : line.lastUpdated && new Date(line.lastUpdated) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Stale
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Outdated
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}