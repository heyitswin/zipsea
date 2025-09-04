#!/usr/bin/env node
require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
const chalk = require('chalk');

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
});
const db = drizzle(pool);

let previousStats = {};
let iteration = 0;

async function getStats() {
  try {
    // Get flagged cruises count by line
    const flaggedByLine = await db.execute(sql`
      SELECT
        cl.name as line_name,
        cl.id as line_id,
        COUNT(c.id) as flagged_count,
        MIN(c.sailing_date) as earliest_sailing,
        MAX(c.sailing_date) as latest_sailing
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      WHERE c.needs_price_update = true
        AND c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
      ORDER BY flagged_count DESC
    `);

    // Get recently processed cruises (last 5 minutes)
    const recentlyProcessed = await db.execute(sql`
      SELECT
        cl.name as line_name,
        COUNT(c.id) as processed_count
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      WHERE c.needs_price_update = false
        AND c.is_active = true
        AND c.updated_at >= NOW() - INTERVAL '5 minutes'
      GROUP BY cl.id, cl.name
      ORDER BY processed_count DESC
    `);

    // Get cruises with pricing data
    const withPricing = await db.execute(sql`
      SELECT
        cl.name as line_name,
        COUNT(DISTINCT c.id) as cruises_with_pricing
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      JOIN pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
    `);

    // Get total active cruises
    const totalActive = await db.execute(sql`
      SELECT
        cl.name as line_name,
        COUNT(c.id) as total_cruises
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
    `);

    return {
      flaggedByLine: flaggedByLine.rows,
      recentlyProcessed: recentlyProcessed.rows,
      withPricing: withPricing.rows,
      totalActive: totalActive.rows,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    return null;
  }
}

function displayStats(stats) {
  console.clear();
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('  BATCH SYNC MONITOR - REAL TIME'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.gray(`  Timestamp: ${stats.timestamp}`));
  console.log(chalk.gray(`  Iteration: ${++iteration} | Refresh: 2s`));
  console.log(chalk.cyan('───────────────────────────────────────────────────────────────'));

  // Combine all data
  const lineData = {};

  stats.totalActive.forEach(row => {
    if (!lineData[row.line_name]) {
      lineData[row.line_name] = {};
    }
    lineData[row.line_name].total = parseInt(row.total_cruises);
  });

  stats.flaggedByLine.forEach(row => {
    if (!lineData[row.line_name]) {
      lineData[row.line_name] = {};
    }
    lineData[row.line_name].flagged = parseInt(row.flagged_count);
    lineData[row.line_name].earliest = row.earliest_sailing;
    lineData[row.line_name].latest = row.latest_sailing;
  });

  stats.recentlyProcessed.forEach(row => {
    if (!lineData[row.line_name]) {
      lineData[row.line_name] = {};
    }
    lineData[row.line_name].recent = parseInt(row.processed_count);
  });

  stats.withPricing.forEach(row => {
    if (!lineData[row.line_name]) {
      lineData[row.line_name] = {};
    }
    lineData[row.line_name].withPricing = parseInt(row.cruises_with_pricing);
  });

  // Display flagged cruises
  console.log(chalk.yellow.bold('\n📌 CRUISES PENDING SYNC:'));

  let totalFlagged = 0;
  const flaggedLines = Object.entries(lineData)
    .filter(([_, data]) => data.flagged > 0)
    .sort((a, b) => b[1].flagged - a[1].flagged);

  if (flaggedLines.length === 0) {
    console.log(chalk.green('  ✓ No cruises pending sync'));
  } else {
    flaggedLines.forEach(([lineName, data]) => {
      totalFlagged += data.flagged;
      const prev = previousStats[lineName]?.flagged || 0;
      const diff = data.flagged - prev;
      const diffStr =
        diff > 0 ? chalk.red(`+${diff}`) : diff < 0 ? chalk.green(`${diff}`) : chalk.gray('0');

      const percentage = data.total ? ((data.flagged / data.total) * 100).toFixed(1) : 0;
      console.log(
        chalk.white(`  ${lineName.padEnd(25)}`),
        chalk.yellow(`${String(data.flagged).padStart(4)} pending`),
        chalk.gray(`(${diffStr})`),
        chalk.gray(`[${percentage}% of ${data.total}]`)
      );

      if (data.earliest && data.latest) {
        console.log(chalk.gray(`    Sailing dates: ${data.earliest} to ${data.latest}`));
      }
    });
    console.log(chalk.yellow.bold(`  Total: ${totalFlagged} cruises pending`));
  }

  // Display recently processed
  console.log(chalk.green.bold('\n✅ RECENTLY PROCESSED (last 5 min):'));

  const processedLines = Object.entries(lineData)
    .filter(([_, data]) => data.recent > 0)
    .sort((a, b) => b[1].recent - a[1].recent);

  if (processedLines.length === 0) {
    console.log(chalk.gray('  No cruises processed in last 5 minutes'));
  } else {
    processedLines.forEach(([lineName, data]) => {
      console.log(
        chalk.white(`  ${lineName.padEnd(25)}`),
        chalk.green(`${String(data.recent).padStart(4)} processed`)
      );
    });
  }

  // Display pricing coverage
  console.log(chalk.blue.bold('\n📊 PRICING COVERAGE:'));

  Object.entries(lineData)
    .filter(([_, data]) => data.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10) // Top 10 lines
    .forEach(([lineName, data]) => {
      const withPricing = data.withPricing || 0;
      const coverage = data.total ? ((withPricing / data.total) * 100).toFixed(1) : 0;
      const bar = '█'.repeat(Math.floor(coverage / 5)) + '░'.repeat(20 - Math.floor(coverage / 5));

      console.log(
        chalk.white(`  ${lineName.padEnd(25)}`),
        chalk.cyan(bar),
        chalk.cyan(`${coverage}%`),
        chalk.gray(`(${withPricing}/${data.total})`)
      );
    });

  console.log(chalk.cyan('───────────────────────────────────────────────────────────────'));
  console.log(chalk.gray('\n  Press Ctrl+C to exit'));

  // Update previous stats
  Object.entries(lineData).forEach(([lineName, data]) => {
    if (!previousStats[lineName]) {
      previousStats[lineName] = {};
    }
    previousStats[lineName].flagged = data.flagged || 0;
  });
}

async function monitor() {
  const stats = await getStats();
  if (stats) {
    displayStats(stats);
  }
}

// Initial run
monitor();

// Update every 2 seconds
setInterval(monitor, 2000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Monitoring stopped'));
  pool.end();
  process.exit(0);
});
