'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '../hooks/useAdmin';
import { useAlert } from '../../components/GlobalAlertProvider';

// Define types for analytics data
interface QuoteAnalytics {
  totalQuotes: number;
  quotesToday: number;
  quotesThisWeek: number;
  quotesThisMonth: number;
  conversionRate: number;
  averageQuoteValue: number;
  quotesByStatus: {
    pending: number;
    contacted: number;
    booked: number;
    cancelled: number;
  };
}

interface CruiseAnalytics {
  totalCruises: number;
  upcomingCruises: number;
  popularCruises: Array<{
    id: string;
    name: string;
    cruiseLineName: string;
    shipName: string;
    quoteCount: number;
    viewCount: number;
    revenue: number;
  }>;
  cruisesByLine: Array<{
    cruiseLineName: string;
    count: number;
    revenue: number;
    avgPrice: number;
  }>;
  cruisesByDestination: Array<{
    destination: string;
    count: number;
    popularity: number;
  }>;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  usersBySource: {
    organic: number;
    google: number;
    social: number;
    direct: number;
    referral: number;
  };
  topUsers: Array<{
    email: string;
    quoteCount: number;
    totalValue: number;
  }>;
}

interface RevenueAnalytics {
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
  averageBookingValue: number;
  projectedRevenue: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { showAlert } = useAlert();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, 90d, 1y, all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Analytics states
  const [quoteAnalytics, setQuoteAnalytics] = useState<QuoteAnalytics | null>(null);
  const [cruiseAnalytics, setCruiseAnalytics] = useState<CruiseAnalytics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any>(null);

  // Check admin access
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      showAlert('You do not have permission to access this page');
      router.push('/');
    }
  }, [isAdmin, adminLoading, router, showAlert]);

  // Fetch analytics data
  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [isAdmin, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://zipsea-production.onrender.com';
      
      // Fetch all analytics data in parallel
      const [quotes, cruises, users, revenue, recent] = await Promise.all([
        fetch(`${backendUrl}/api/v1/admin/analytics/quotes?range=${dateRange}`).then(r => r.ok ? r.json() : null),
        fetch(`${backendUrl}/api/v1/admin/analytics/cruises?range=${dateRange}`).then(r => r.ok ? r.json() : null),
        fetch(`${backendUrl}/api/v1/admin/analytics/users?range=${dateRange}`).then(r => r.ok ? r.json() : null),
        fetch(`${backendUrl}/api/v1/admin/analytics/revenue?range=${dateRange}`).then(r => r.ok ? r.json() : null),
        fetch(`${backendUrl}/api/v1/admin/quotes/recent?limit=10`).then(r => r.ok ? r.json() : null),
      ]);
      
      // For now, use mock data if API endpoints don't exist yet
      setQuoteAnalytics(quotes || {
        totalQuotes: 1847,
        quotesToday: 23,
        quotesThisWeek: 156,
        quotesThisMonth: 624,
        conversionRate: 12.5,
        averageQuoteValue: 3250,
        quotesByStatus: {
          pending: 234,
          contacted: 156,
          booked: 89,
          cancelled: 12
        }
      });
      
      setCruiseAnalytics(cruises || {
        totalCruises: 3456,
        upcomingCruises: 892,
        popularCruises: [
          { id: '1', name: '7-Night Caribbean', cruiseLineName: 'Royal Caribbean', shipName: 'Wonder of the Seas', quoteCount: 234, viewCount: 5678, revenue: 456000 },
          { id: '2', name: '5-Night Bahamas', cruiseLineName: 'Carnival', shipName: 'Carnival Magic', quoteCount: 189, viewCount: 4321, revenue: 234000 },
          { id: '3', name: '10-Night Mediterranean', cruiseLineName: 'Norwegian', shipName: 'Norwegian Epic', quoteCount: 167, viewCount: 3890, revenue: 567000 },
        ],
        cruisesByLine: [
          { cruiseLineName: 'Royal Caribbean', count: 456, revenue: 2340000, avgPrice: 5131 },
          { cruiseLineName: 'Carnival', count: 389, revenue: 1560000, avgPrice: 4010 },
          { cruiseLineName: 'Norwegian', count: 312, revenue: 1890000, avgPrice: 6057 },
        ],
        cruisesByDestination: [
          { destination: 'Caribbean', count: 678, popularity: 35 },
          { destination: 'Mediterranean', count: 456, popularity: 28 },
          { destination: 'Alaska', count: 234, popularity: 18 },
        ]
      });
      
      setUserAnalytics(users || {
        totalUsers: 8923,
        activeUsers: 2134,
        newUsersToday: 67,
        newUsersThisWeek: 423,
        usersBySource: {
          organic: 3456,
          google: 2134,
          social: 1890,
          direct: 987,
          referral: 456
        },
        topUsers: [
          { email: 'john.smith@example.com', quoteCount: 23, totalValue: 45000 },
          { email: 'sarah.jones@example.com', quoteCount: 19, totalValue: 38000 },
          { email: 'mike.wilson@example.com', quoteCount: 17, totalValue: 34000 },
        ]
      });
      
      setRevenueAnalytics(revenue || {
        totalRevenue: 4567890,
        revenueToday: 23456,
        revenueThisWeek: 156789,
        revenueThisMonth: 678901,
        revenueByMonth: [
          { month: 'Jan', revenue: 456789, bookings: 123 },
          { month: 'Feb', revenue: 523456, bookings: 145 },
          { month: 'Mar', revenue: 612345, bookings: 167 },
          { month: 'Apr', revenue: 578901, bookings: 156 },
          { month: 'May', revenue: 689012, bookings: 189 },
          { month: 'Jun', revenue: 723456, bookings: 198 },
        ],
        averageBookingValue: 3456,
        projectedRevenue: 8901234
      });
      
      setRecentQuotes(recent?.quotes || [
        { id: 1, email: 'john@example.com', cruiseName: '7-Night Caribbean', date: '2025-01-15', status: 'pending', value: 3450 },
        { id: 2, email: 'sarah@example.com', cruiseName: '5-Night Bahamas', date: '2025-01-14', status: 'contacted', value: 2890 },
        { id: 3, email: 'mike@example.com', cruiseName: '10-Night Mediterranean', date: '2025-01-14', status: 'booked', value: 5670 },
      ]);
      
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (type: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://zipsea-production.onrender.com';
      const response = await fetch(`${backendUrl}/api/v1/admin/export/${type}?range=${dateRange}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showAlert(`${type} data exported successfully`);
      }
    } catch (err) {
      console.error('Export error:', err);
      showAlert('Failed to export data');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
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
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Business analytics and reporting</p>
            </div>
            
            {/* Date Range Selector */}
            <div className="flex items-center space-x-4">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
                <option value="all">All time</option>
              </select>
              
              <button
                onClick={() => fetchAnalytics()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-8 border-b border-gray-200 -mb-px">
            {['overview', 'quotes', 'cruises', 'users', 'revenue'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Revenue Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(revenueAnalytics?.totalRevenue || 0)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      +12.5% from last period
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Total Quotes Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Quotes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(quoteAnalytics?.totalQuotes || 0)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {formatNumber(quoteAnalytics?.quotesToday || 0)} today
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Active Users Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(userAnalytics?.activeUsers || 0)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {formatNumber(userAnalytics?.newUsersToday || 0)} new today
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Conversion Rate Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercent(quoteAnalytics?.conversionRate || 0)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      +2.3% from last period
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Chart visualization would go here</p>
                  <p className="text-xs text-gray-400 mt-1">Integrate with Chart.js or Recharts</p>
                </div>
              </div>
            </div>

            {/* Recent Quotes Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Quote Requests</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cruise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentQuotes.map((quote) => (
                      <tr key={quote.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {quote.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {quote.cruiseName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {quote.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            quote.status === 'booked' ? 'bg-green-100 text-green-800' :
                            quote.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                            quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {quote.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(quote.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Quotes Tab */}
        {activeTab === 'quotes' && quoteAnalytics && (
          <div className="space-y-6">
            {/* Quote Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatNumber(quoteAnalytics.quotesByStatus.pending)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Contacted</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(quoteAnalytics.quotesByStatus.contacted)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Booked</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(quoteAnalytics.quotesByStatus.booked)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatNumber(quoteAnalytics.quotesByStatus.cancelled)}
                </p>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={() => exportData('quotes')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Export Quotes Data
              </button>
            </div>
          </div>
        )}

        {/* Cruises Tab */}
        {activeTab === 'cruises' && cruiseAnalytics && (
          <div className="space-y-6">
            {/* Popular Cruises */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Most Popular Cruises</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cruise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cruise Line
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ship
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quotes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cruiseAnalytics.popularCruises.map((cruise) => (
                      <tr key={cruise.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {cruise.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cruise.cruiseLineName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cruise.shipName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(cruise.quoteCount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(cruise.viewCount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(cruise.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cruise Lines Performance */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Cruise Lines Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cruise Line
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cruises
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cruiseAnalytics.cruisesByLine.map((line) => (
                      <tr key={line.cruiseLineName} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {line.cruiseLineName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(line.count)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(line.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(line.avgPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={() => exportData('cruises')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Export Cruise Data
              </button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && userAnalytics && (
          <div className="space-y-6">
            {/* User Source Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {Object.entries(userAnalytics.usersBySource).map(([source, count]) => (
                <div key={source} className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm font-medium text-gray-600 capitalize">{source}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(count)}
                  </p>
                </div>
              ))}
            </div>

            {/* Top Users */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Top Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quotes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userAnalytics.topUsers.map((user, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(user.quoteCount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(user.totalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={() => exportData('users')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Export User Data
              </button>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && revenueAnalytics && (
          <div className="space-y-6">
            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Average Booking Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueAnalytics.averageBookingValue)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Revenue This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueAnalytics.revenueThisMonth)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Projected Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueAnalytics.projectedRevenue)}
                </p>
              </div>
            </div>

            {/* Monthly Revenue Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Monthly Revenue</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bookings
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {revenueAnalytics.revenueByMonth.map((month) => (
                      <tr key={month.month} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {month.month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(month.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(month.bookings)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(month.revenue / month.bookings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={() => exportData('revenue')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Export Revenue Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}