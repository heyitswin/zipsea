#!/usr/bin/env node

/**
 * Comprehensive Search API Test Suite
 * Tests all search endpoints with various scenarios
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1/search`;

console.log('🚢 Testing Zipsea Search API');
console.log(`Base URL: ${BASE_URL}`);
console.log('='=50);

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// Test utility functions
function logTest(testName, status, message = '', data = null) {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${emoji} ${testName}: ${status}${message ? ` - ${message}` : ''}`);
  
  if (data && status === 'FAIL') {
    console.log('   Error details:', JSON.stringify(data, null, 2));
  }
  
  testResults.total++;
  if (status === 'PASS') testResults.passed++;
  if (status === 'FAIL') testResults.failed++;
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { response, data, status: response.status };
  } catch (error) {
    return { error, status: 0 };
  }
}

function validateResponseStructure(data, expectedStructure) {
  for (const [key, type] of Object.entries(expectedStructure)) {
    if (!(key in data)) {
      return `Missing field: ${key}`;
    }
    if (typeof data[key] !== type && type !== 'any') {
      return `Field ${key} should be ${type}, got ${typeof data[key]}`;
    }
  }
  return null;
}

function measureResponseTime(startTime) {
  return Date.now() - startTime;
}

// Test cases
async function testBasicSearch() {
  console.log('\n🔍 Testing Basic Search Functionality');
  
  const startTime = Date.now();
  const { response, data, error, status } = await makeRequest(`${API_URL}?limit=5`);
  const responseTime = measureResponseTime(startTime);
  
  if (error) {
    logTest('Basic Search', 'FAIL', `Network error: ${error.message}`);
    return;
  }
  
  if (status !== 200) {
    logTest('Basic Search', 'FAIL', `HTTP ${status}`, data);
    return;
  }
  
  const structureError = validateResponseStructure(data, {
    success: 'boolean',
    data: 'object'
  });
  
  if (structureError) {
    logTest('Basic Search', 'FAIL', structureError);
    return;
  }
  
  if (!data.success) {
    logTest('Basic Search', 'FAIL', 'Response success is false', data);
    return;
  }
  
  const searchData = data.data;
  const dataStructureError = validateResponseStructure(searchData, {
    cruises: 'object',
    filters: 'object',
    meta: 'object'
  });
  
  if (dataStructureError) {
    logTest('Basic Search', 'FAIL', dataStructureError);
    return;
  }
  
  if (!Array.isArray(searchData.cruises)) {
    logTest('Basic Search', 'FAIL', 'Cruises should be an array');
    return;
  }
  
  logTest('Basic Search', 'PASS', `${searchData.cruises.length} cruises, ${responseTime}ms`);
  
  // Test response time
  if (responseTime > 200) {
    logTest('Response Time', 'FAIL', `${responseTime}ms > 200ms threshold`);
  } else {
    logTest('Response Time', 'PASS', `${responseTime}ms`);
  }
}

async function testSearchWithFilters() {
  console.log('\n🎯 Testing Search with Filters');
  
  const filters = [
    { name: 'Price Range', params: 'minPrice=100&maxPrice=2000' },
    { name: 'Duration Range', params: 'minNights=7&maxNights=14' },
    { name: 'Cruise Line', params: 'cruiseLine=1' },
    { name: 'Departure Date', params: 'sailingDateFrom=2025-09-01&sailingDateTo=2025-12-31' },
    { name: 'Cabin Type', params: 'cabinType=balcony' },
    { name: 'General Search', params: 'q=caribbean' },
    { name: 'Duration Shortcut', params: 'duration=week' },
    { name: 'Include Deals', params: 'includeDeals=true' },
    { name: 'Multiple Cruise Lines', params: 'cruiseLine=1&cruiseLine=2' },
    { name: 'Multiple Cabin Types', params: 'cabinType=interior&cabinType=balcony' }
  ];
  
  for (const filter of filters) {
    const startTime = Date.now();
    const { response, data, error, status } = await makeRequest(`${API_URL}?${filter.params}&limit=3`);
    const responseTime = measureResponseTime(startTime);
    
    if (error) {
      logTest(`Filter: ${filter.name}`, 'FAIL', `Network error: ${error.message}`);
      continue;
    }
    
    if (status !== 200) {
      logTest(`Filter: ${filter.name}`, 'FAIL', `HTTP ${status}`, data);
      continue;
    }
    
    if (!data.success) {
      logTest(`Filter: ${filter.name}`, 'FAIL', 'Response success is false', data);
      continue;
    }
    
    const cruiseCount = data.data.cruises.length;
    logTest(`Filter: ${filter.name}`, 'PASS', `${cruiseCount} results, ${responseTime}ms`);
  }
}

async function testSortingOptions() {
  console.log('\n🔄 Testing Sorting Options');
  
  const sortOptions = [
    { name: 'Price Ascending', params: 'sortBy=price&sortOrder=asc' },
    { name: 'Price Descending', params: 'sortBy=price&sortOrder=desc' },
    { name: 'Date Ascending', params: 'sortBy=date&sortOrder=asc' },
    { name: 'Date Descending', params: 'sortBy=date&sortOrder=desc' },
    { name: 'Duration Ascending', params: 'sortBy=nights&sortOrder=asc' },
    { name: 'Duration Descending', params: 'sortBy=nights&sortOrder=desc' },
    { name: 'Name Ascending', params: 'sortBy=name&sortOrder=asc' },
    { name: 'Rating Descending', params: 'sortBy=rating&sortOrder=desc' },
    { name: 'Popularity', params: 'sortBy=popularity' },
    { name: 'Best Deals', params: 'sortBy=deals' }
  ];
  
  for (const sort of sortOptions) {
    const startTime = Date.now();
    const { response, data, error, status } = await makeRequest(`${API_URL}?${sort.params}&limit=3`);
    const responseTime = measureResponseTime(startTime);
    
    if (error) {
      logTest(`Sort: ${sort.name}`, 'FAIL', `Network error: ${error.message}`);
      continue;
    }
    
    if (status !== 200) {
      logTest(`Sort: ${sort.name}`, 'FAIL', `HTTP ${status}`, data);
      continue;
    }
    
    if (!data.success) {
      logTest(`Sort: ${sort.name}`, 'FAIL', 'Response success is false', data);
      continue;
    }
    
    const cruiseCount = data.data.cruises.length;
    logTest(`Sort: ${sort.name}`, 'PASS', `${cruiseCount} results, ${responseTime}ms`);
    
    // Validate sorting worked (basic check)
    if (cruiseCount >= 2 && sort.name.includes('Price')) {
      const cruises = data.data.cruises;
      const isAscending = sort.params.includes('asc');
      const price1 = cruises[0].pricing.from;
      const price2 = cruises[1].pricing.from;
      
      if (isAscending && price1 > price2) {
        logTest(`Sort Validation: ${sort.name}`, 'FAIL', `Not properly sorted: ${price1} > ${price2}`);
      } else if (!isAscending && price1 < price2) {
        logTest(`Sort Validation: ${sort.name}`, 'FAIL', `Not properly sorted: ${price1} < ${price2}`);
      } else {
        logTest(`Sort Validation: ${sort.name}`, 'PASS', 'Correctly sorted');
      }
    }
  }
}

async function testPagination() {
  console.log('\n📄 Testing Pagination');
  
  const paginationTests = [
    { name: 'Page 1', params: 'page=1&limit=5' },
    { name: 'Page 2', params: 'page=2&limit=5' },
    { name: 'Large Limit', params: 'page=1&limit=50' },
    { name: 'Max Limit', params: 'page=1&limit=100' },
    { name: 'Over Max Limit', params: 'page=1&limit=150' },
    { name: 'Invalid Page', params: 'page=0&limit=10' },
    { name: 'Negative Page', params: 'page=-1&limit=10' }
  ];
  
  for (const test of paginationTests) {
    const startTime = Date.now();
    const { response, data, error, status } = await makeRequest(`${API_URL}?${test.params}`);
    const responseTime = measureResponseTime(startTime);
    
    if (error) {
      logTest(`Pagination: ${test.name}`, 'FAIL', `Network error: ${error.message}`);
      continue;
    }
    
    if (status !== 200) {
      logTest(`Pagination: ${test.name}`, 'FAIL', `HTTP ${status}`, data);
      continue;
    }
    
    if (!data.success) {
      logTest(`Pagination: ${test.name}`, 'FAIL', 'Response success is false', data);
      continue;
    }
    
    const meta = data.data.meta;
    const cruiseCount = data.data.cruises.length;
    
    // Validate pagination metadata
    if (!meta.page || !meta.limit || !meta.total || !meta.totalPages) {
      logTest(`Pagination: ${test.name}`, 'FAIL', 'Missing pagination metadata');
      continue;
    }
    
    // Check limit enforcement
    if (test.name === 'Over Max Limit' && meta.limit > 100) {
      logTest(`Pagination: ${test.name}`, 'FAIL', `Limit not enforced: ${meta.limit}`);
      continue;
    }
    
    // Check page normalization
    if ((test.name === 'Invalid Page' || test.name === 'Negative Page') && meta.page < 1) {
      logTest(`Pagination: ${test.name}`, 'FAIL', `Page not normalized: ${meta.page}`);
      continue;
    }
    
    logTest(`Pagination: ${test.name}`, 'PASS', `Page ${meta.page}/${meta.totalPages}, ${cruiseCount} results`);
  }
}

async function testFacetedSearch() {
  console.log('\n🏷️ Testing Faceted Search');
  
  const startTime = Date.now();
  const { response, data, error, status } = await makeRequest(`${API_URL}?facets=true&limit=10`);
  const responseTime = measureResponseTime(startTime);
  
  if (error) {
    logTest('Faceted Search', 'FAIL', `Network error: ${error.message}`);
    return;
  }
  
  if (status !== 200) {
    logTest('Faceted Search', 'FAIL', `HTTP ${status}`, data);
    return;
  }
  
  if (!data.success) {
    logTest('Faceted Search', 'FAIL', 'Response success is false', data);
    return;
  }
  
  const searchData = data.data;
  
  // Check if facets are included
  if (!searchData.facets) {
    logTest('Faceted Search', 'FAIL', 'Facets not included in response');
    return;
  }
  
  const facetStructureError = validateResponseStructure(searchData.facets, {
    cruiseLines: 'object',
    cabinTypes: 'object',
    priceRanges: 'object',
    durationRanges: 'object'
  });
  
  if (facetStructureError) {
    logTest('Faceted Search', 'FAIL', facetStructureError);
    return;
  }
  
  logTest('Faceted Search', 'PASS', `${responseTime}ms, facets included`);
  
  // Validate facet structure
  const facets = searchData.facets;
  if (Array.isArray(facets.cruiseLines) && facets.cruiseLines.length > 0) {
    logTest('Cruise Line Facets', 'PASS', `${facets.cruiseLines.length} cruise lines`);
  } else {
    logTest('Cruise Line Facets', 'FAIL', 'No cruise line facets');
  }
  
  if (Array.isArray(facets.cabinTypes) && facets.cabinTypes.length > 0) {
    logTest('Cabin Type Facets', 'PASS', `${facets.cabinTypes.length} cabin types`);
  } else {
    logTest('Cabin Type Facets', 'FAIL', 'No cabin type facets');
  }
}

async function testSearchSuggestions() {
  console.log('\n💡 Testing Search Suggestions');
  
  const suggestionQueries = [
    { query: 'car', name: 'Caribbean' },
    { query: 'roy', name: 'Royal' },
    { query: 'mia', name: 'Miami' },
    { query: 'med', name: 'Mediterranean' },
    { query: 'nor', name: 'Norwegian' },
    { query: 'a', name: 'Too Short' },
    { query: '', name: 'Empty Query' },
    { query: 'x'.repeat(101), name: 'Too Long' }
  ];
  
  for (const test of suggestionQueries) {
    const startTime = Date.now();
    const { response, data, error, status } = await makeRequest(`${API_URL}/suggestions?q=${encodeURIComponent(test.query)}`);
    const responseTime = measureResponseTime(startTime);
    
    if (error) {
      logTest(`Suggestions: ${test.name}`, 'FAIL', `Network error: ${error.message}`);
      continue;
    }
    
    if (test.name === 'Too Long' && status === 400) {
      logTest(`Suggestions: ${test.name}`, 'PASS', 'Correctly rejected long query');
      continue;
    }
    
    if (status !== 200) {
      logTest(`Suggestions: ${test.name}`, 'FAIL', `HTTP ${status}`, data);
      continue;
    }
    
    if (!data.success) {
      logTest(`Suggestions: ${test.name}`, 'FAIL', 'Response success is false', data);
      continue;
    }
    
    const suggestions = data.data.suggestions;
    
    if (!Array.isArray(suggestions)) {
      logTest(`Suggestions: ${test.name}`, 'FAIL', 'Suggestions should be an array');
      continue;
    }
    
    if (test.name === 'Too Short' || test.name === 'Empty Query') {
      if (suggestions.length === 0) {
        logTest(`Suggestions: ${test.name}`, 'PASS', 'Correctly returned empty suggestions');
      } else {
        logTest(`Suggestions: ${test.name}`, 'FAIL', 'Should return empty suggestions for short queries');
      }
      continue;
    }
    
    logTest(`Suggestions: ${test.name}`, 'PASS', `${suggestions.length} suggestions, ${responseTime}ms`);
    
    // Validate suggestion structure
    if (suggestions.length > 0) {
      const suggestion = suggestions[0];
      const suggestionError = validateResponseStructure(suggestion, {
        type: 'string',
        value: 'string',
        label: 'string'
      });
      
      if (suggestionError) {
        logTest(`Suggestion Structure: ${test.name}`, 'FAIL', suggestionError);
      } else {
        logTest(`Suggestion Structure: ${test.name}`, 'PASS', suggestion.type);
      }
    }
  }
}

async function testSearchFilters() {
  console.log('\n🔧 Testing Search Filters Endpoint');
  
  const startTime = Date.now();
  const { response, data, error, status } = await makeRequest(`${API_URL}/filters`);
  const responseTime = measureResponseTime(startTime);
  
  if (error) {
    logTest('Search Filters', 'FAIL', `Network error: ${error.message}`);
    return;
  }
  
  if (status !== 200) {
    logTest('Search Filters', 'FAIL', `HTTP ${status}`, data);
    return;
  }
  
  if (!data.success) {
    logTest('Search Filters', 'FAIL', 'Response success is false', data);
    return;
  }
  
  const filters = data.data;
  const filtersStructureError = validateResponseStructure(filters, {
    cruiseLines: 'object',
    ships: 'object',
    destinations: 'object',
    departurePorts: 'object',
    cabinTypes: 'object',
    nightsRange: 'object',
    priceRange: 'object',
    sailingDateRange: 'object'
  });
  
  if (filtersStructureError) {
    logTest('Search Filters', 'FAIL', filtersStructureError);
    return;
  }
  
  logTest('Search Filters', 'PASS', `${responseTime}ms`);
  
  // Validate individual filter arrays
  const filterTests = [
    { name: 'Cruise Lines', array: filters.cruiseLines },
    { name: 'Ships', array: filters.ships },
    { name: 'Destinations', array: filters.destinations },
    { name: 'Departure Ports', array: filters.departurePorts },
    { name: 'Cabin Types', array: filters.cabinTypes }
  ];
  
  for (const test of filterTests) {
    if (Array.isArray(test.array)) {
      logTest(`Filter Array: ${test.name}`, 'PASS', `${test.array.length} items`);
    } else {
      logTest(`Filter Array: ${test.name}`, 'FAIL', 'Not an array');
    }
  }
  
  // Validate range objects
  const rangeTests = [
    { name: 'Nights Range', range: filters.nightsRange },
    { name: 'Price Range', range: filters.priceRange },
    { name: 'Sailing Date Range', range: filters.sailingDateRange }
  ];
  
  for (const test of rangeTests) {
    if (test.range && typeof test.range === 'object' && 'min' in test.range && 'max' in test.range) {
      logTest(`Range: ${test.name}`, 'PASS', `${test.range.min} - ${test.range.max}`);
    } else {
      logTest(`Range: ${test.name}`, 'FAIL', 'Invalid range structure');
    }
  }
}

async function testPopularCruises() {
  console.log('\n⭐ Testing Popular Cruises Endpoint');
  
  const startTime = Date.now();
  const { response, data, error, status } = await makeRequest(`${API_URL}/popular?limit=10`);
  const responseTime = measureResponseTime(startTime);
  
  if (error) {
    logTest('Popular Cruises', 'FAIL', `Network error: ${error.message}`);
    return;
  }
  
  if (status !== 200) {
    logTest('Popular Cruises', 'FAIL', `HTTP ${status}`, data);
    return;
  }
  
  if (!data.success) {
    logTest('Popular Cruises', 'FAIL', 'Response success is false', data);
    return;
  }
  
  const cruises = data.data.cruises;
  
  if (!Array.isArray(cruises)) {
    logTest('Popular Cruises', 'FAIL', 'Cruises should be an array');
    return;
  }
  
  logTest('Popular Cruises', 'PASS', `${cruises.length} popular cruises, ${responseTime}ms`);
}

async function testRecommendations() {
  console.log('\n🎯 Testing Recommendations Endpoint');
  
  const startTime = Date.now();
  const { response, data, error, status } = await makeRequest(`${API_URL}/recommendations?limit=5`);
  const responseTime = measureResponseTime(startTime);
  
  if (error) {
    logTest('Recommendations', 'FAIL', `Network error: ${error.message}`);
    return;
  }
  
  if (status !== 200) {
    logTest('Recommendations', 'FAIL', `HTTP ${status}`, data);
    return;
  }
  
  if (!data.success) {
    logTest('Recommendations', 'FAIL', 'Response success is false', data);
    return;
  }
  
  const cruises = data.data.cruises;
  
  if (!Array.isArray(cruises)) {
    logTest('Recommendations', 'FAIL', 'Cruises should be an array');
    return;
  }
  
  logTest('Recommendations', 'PASS', `${cruises.length} recommendations, ${responseTime}ms`);
}

async function testPerformance() {
  console.log('\n⚡ Testing Performance & Load');
  
  const performanceTests = [
    { name: 'Simple Search', url: `${API_URL}?limit=10` },
    { name: 'Complex Search', url: `${API_URL}?q=caribbean&minPrice=500&maxPrice=2000&minNights=7&sortBy=price&facets=true&limit=20` },
    { name: 'Large Result Set', url: `${API_URL}?limit=100` },
    { name: 'Suggestions', url: `${API_URL}/suggestions?q=royal` },
    { name: 'Filters', url: `${API_URL}/filters` }
  ];
  
  for (const test of performanceTests) {
    const times = [];
    const iterations = 3;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const { response, data, error, status } = await makeRequest(test.url);
      const responseTime = measureResponseTime(startTime);
      
      if (!error && status === 200 && data.success) {
        times.push(responseTime);
      }
    }
    
    if (times.length === iterations) {
      const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const maxTime = Math.max(...times);
      
      if (avgTime < 200) {
        logTest(`Performance: ${test.name}`, 'PASS', `avg: ${avgTime}ms, max: ${maxTime}ms`);
      } else if (avgTime < 500) {
        logTest(`Performance: ${test.name}`, 'WARN', `avg: ${avgTime}ms, max: ${maxTime}ms (slow)`);
      } else {
        logTest(`Performance: ${test.name}`, 'FAIL', `avg: ${avgTime}ms, max: ${maxTime}ms (too slow)`);
      }
    } else {
      logTest(`Performance: ${test.name}`, 'FAIL', 'Requests failed');
    }
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling');
  
  const errorTests = [
    { name: 'Invalid Sort Field', url: `${API_URL}?sortBy=invalid&limit=5` },
    { name: 'Invalid Date Format', url: `${API_URL}?sailingDateFrom=invalid-date&limit=5` },
    { name: 'Negative Price', url: `${API_URL}?minPrice=-100&limit=5` },
    { name: 'Invalid Cruise Line ID', url: `${API_URL}?cruiseLine=99999&limit=5` },
    { name: 'Invalid Ship ID', url: `${API_URL}?ship=99999&limit=5` },
    { name: 'SQL Injection Attempt', url: `${API_URL}?q='; DROP TABLE cruises; --&limit=5` }
  ];
  
  for (const test of errorTests) {
    const startTime = Date.now();
    const { response, data, error, status } = await makeRequest(test.url);
    const responseTime = measureResponseTime(startTime);
    
    if (error) {
      logTest(`Error Handling: ${test.name}`, 'FAIL', `Network error: ${error.message}`);
      continue;
    }
    
    // Most of these should either return 200 with valid data (handled gracefully)
    // or return appropriate error status codes
    if (status === 200 && data.success) {
      logTest(`Error Handling: ${test.name}`, 'PASS', 'Handled gracefully');
    } else if (status >= 400 && status < 500) {
      logTest(`Error Handling: ${test.name}`, 'PASS', `Returned HTTP ${status}`);
    } else {
      logTest(`Error Handling: ${test.name}`, 'FAIL', `Unexpected status: ${status}`);
    }
  }
}

// Main test runner
async function runAllTests() {
  const startTime = Date.now();
  
  try {
    await testBasicSearch();
    await testSearchWithFilters();
    await testSortingOptions();
    await testPagination();
    await testFacetedSearch();
    await testSearchSuggestions();
    await testSearchFilters();
    await testPopularCruises();
    await testRecommendations();
    await testPerformance();
    await testErrorHandling();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📋 Total: ${testResults.total}`);
  console.log(`⏱️ Total Time: ${totalTime}ms`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n⚠️ Some tests failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Search API is ready for production.');
  }
}

// Check if we have fetch available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or a fetch polyfill');
  console.log('💡 To install a polyfill: npm install node-fetch');
  console.log('💡 Or use Node.js 18+ which includes fetch natively');
  process.exit(1);
}

// Run the tests
runAllTests().catch(console.error);