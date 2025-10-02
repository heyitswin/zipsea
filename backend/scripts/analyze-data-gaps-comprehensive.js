/**
 * Comprehensive analysis of data gaps across all cruise lines and months
 * This will help us understand the full scope of the sync issue
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function analyzeCoverageGaps() {
  console.log('=== COMPREHENSIVE DATA GAP ANALYSIS ===\n');
  console.log('Analyzing cruise availability for 2026 across all major cruise lines\n');

  // Get all cruise lines
  console.log('Step 1: Fetching all cruise lines...');
  const facetsUrl = `${API_URL}/api/v1/search/comprehensive/facets`;

  let allCruiseLines = [];
  try {
    const response = await fetch(facetsUrl);
    const data = await response.json();
    allCruiseLines = data.cruiseLines || [];
    console.log(`Found ${allCruiseLines.length} cruise lines\n`);
  } catch (error) {
    console.log('ERROR fetching cruise lines:', error.message);
    return;
  }

  // Focus on major cruise lines (those with significant inventory)
  const majorLines = allCruiseLines.filter(line => line.count >= 100).slice(0, 20);
  console.log(`Analyzing top ${majorLines.length} cruise lines with 100+ cruises\n`);
  console.log('---\n');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const gapReport = [];
  let totalGaps = 0;
  let linesWithGaps = 0;

  // Analyze each cruise line
  for (const line of majorLines) {
    console.log(`Analyzing: ${line.name} (ID ${line.id})`);

    const lineGaps = [];
    let hasAnyGaps = false;

    // Check each month in 2026
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const monthKey = `2026-${monthStr}`;

      const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=${line.id}&departureMonth=${monthKey}&limit=1`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        const count = data.pagination?.total || 0;

        if (count === 0) {
          lineGaps.push({
            month: months[month - 1],
            monthNum: month,
            count: 0
          });
          hasAnyGaps = true;
          totalGaps++;
        }
      } catch (error) {
        console.log(`  ERROR checking ${monthKey}: ${error.message}`);
      }
    }

    if (hasAnyGaps) {
      linesWithGaps++;
      const gapMonths = lineGaps.map(g => g.month).join(', ');
      console.log(`  ❌ GAPS: ${gapMonths}`);

      gapReport.push({
        lineId: line.id,
        lineName: line.name,
        totalCruises: line.count,
        gaps: lineGaps,
        gapCount: lineGaps.length
      });
    } else {
      console.log(`  ✅ Complete coverage for all 12 months`);
    }

    console.log('');
  }

  console.log('\n=== SUMMARY ===\n');
  console.log(`Total cruise lines analyzed: ${majorLines.length}`);
  console.log(`Lines with data gaps: ${linesWithGaps}`);
  console.log(`Lines with complete coverage: ${majorLines.length - linesWithGaps}`);
  console.log(`Total month gaps detected: ${totalGaps}`);
  console.log('');

  if (gapReport.length > 0) {
    console.log('=== DETAILED GAP REPORT ===\n');

    // Sort by number of gaps (most problematic first)
    gapReport.sort((a, b) => b.gapCount - a.gapCount);

    gapReport.forEach(report => {
      console.log(`${report.lineName} (ID ${report.lineId})`);
      console.log(`  Total cruises: ${report.totalCruises}`);
      console.log(`  Missing months (${report.gapCount}/12): ${report.gaps.map(g => g.month).join(', ')}`);
      console.log('');
    });
  }

  // Check pattern: Are gaps concentrated in certain months?
  console.log('=== MONTH GAP PATTERN ANALYSIS ===\n');

  const monthGapCounts = new Array(12).fill(0);
  gapReport.forEach(report => {
    report.gaps.forEach(gap => {
      monthGapCounts[gap.monthNum - 1]++;
    });
  });

  console.log('Number of cruise lines missing data for each month:\n');
  months.forEach((month, idx) => {
    const count = monthGapCounts[idx];
    const percentage = ((count / majorLines.length) * 100).toFixed(1);
    const status = count === 0 ? '✅' : count < 5 ? '⚠️ ' : '❌';
    console.log(`${status} ${month.padEnd(10)}: ${count.toString().padStart(2)} lines (${percentage}% affected)`);
  });

  // Hypothesis check: Are later months more affected?
  console.log('\n=== HYPOTHESIS: Later months have more gaps ===');
  const h1Gaps = monthGapCounts.slice(0, 6).reduce((a, b) => a + b, 0); // Jan-Jun
  const h2Gaps = monthGapCounts.slice(6, 12).reduce((a, b) => a + b, 0); // Jul-Dec
  console.log(`Jan-Jun 2026 gaps: ${h1Gaps}`);
  console.log(`Jul-Dec 2026 gaps: ${h2Gaps}`);
  console.log(`Conclusion: ${h2Gaps > h1Gaps ? 'YES - Later months have MORE gaps' : 'NO - Gaps are evenly distributed'}`);

  // Check current month hypothesis
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentMonthGaps = monthGapCounts[currentMonth];
  console.log(`\nCurrent month (${months[currentMonth]}) gaps: ${currentMonthGaps}`);
  console.log(`This suggests: ${currentMonthGaps > 5 ? 'Sync is likely skipping current month data' : 'Current month is being synced'}`);

  console.log('\n=== RECOMMENDED ACTIONS ===\n');
  console.log('1. Fix webhook sync logic to scan ALL months from January onwards (not from current month)');
  console.log('2. Run manual backfill for missing months');
  console.log('3. Set up monitoring to alert when data gaps appear');
  console.log('4. Consider running full sync monthly to catch any gaps');
}

analyzeCoverageGaps().catch(console.error);
