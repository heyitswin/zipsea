const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function analyzeRawDataFields() {
  console.log('Analyzing raw_data JSONB fields across all cruises...\n');

  try {
    // Get a sample of cruises with non-empty raw_data
    const sampleResult = await pool.query(`
      SELECT
        id,
        cruise_line_id,
        raw_data
      FROM cruises
      WHERE raw_data IS NOT NULL
        AND raw_data::text != '{}'
      LIMIT 100
    `);

    console.log(`Analyzing ${sampleResult.rows.length} sample cruises...\n`);

    // Track all unique fields and their occurrence
    const fieldOccurrence = {};
    const fieldTypes = {};
    const fieldExamples = {};

    sampleResult.rows.forEach(row => {
      const analyzeObject = (obj, path = '') => {
        Object.keys(obj).forEach(key => {
          const fullPath = path ? `${path}.${key}` : key;

          // Track occurrence
          if (!fieldOccurrence[fullPath]) {
            fieldOccurrence[fullPath] = 0;
          }
          fieldOccurrence[fullPath]++;

          // Track type
          const value = obj[key];
          const type = Array.isArray(value) ? 'array' : typeof value;
          if (!fieldTypes[fullPath]) {
            fieldTypes[fullPath] = new Set();
          }
          fieldTypes[fullPath].add(type);

          // Store example (first non-null value)
          if (!fieldExamples[fullPath] && value !== null && value !== undefined) {
            fieldExamples[fullPath] = value;
          }

          // Recurse for objects (but not arrays to avoid noise)
          if (type === 'object' && value !== null && !Array.isArray(value)) {
            analyzeObject(value, fullPath);
          }
        });
      };

      if (row.raw_data) {
        analyzeObject(row.raw_data);
      }
    });

    // Sort fields by occurrence
    const sortedFields = Object.entries(fieldOccurrence).sort((a, b) => b[1] - a[1]);

    console.log('=== TOP-LEVEL FIELDS (Most Common) ===\n');
    sortedFields
      .filter(([field]) => !field.includes('.'))
      .slice(0, 30)
      .forEach(([field, count]) => {
        const types = Array.from(fieldTypes[field]).join(', ');
        const example = JSON.stringify(fieldExamples[field])?.substring(0, 100);
        console.log(`${field}: ${count}/100 occurrences (${types})`);
        if (example && example !== 'null') {
          console.log(`  Example: ${example}`);
        }
      });

    // Check specific important fields
    console.log('\n=== ANALYSIS OF KEY FIELDS ===\n');

    // Check for pricing fields
    const pricingFields = sortedFields.filter(
      ([field]) =>
        field.toLowerCase().includes('price') ||
        field.toLowerCase().includes('cost') ||
        field.toLowerCase().includes('rate')
    );

    console.log('Pricing-related fields:');
    pricingFields.forEach(([field, count]) => {
      console.log(`  ${field}: ${count}/100`);
    });

    // Check for date fields
    const dateFields = sortedFields.filter(
      ([field]) =>
        field.toLowerCase().includes('date') ||
        field.toLowerCase().includes('time') ||
        field.toLowerCase().includes('depart') ||
        field.toLowerCase().includes('arrival')
    );

    console.log('\nDate/Time fields:');
    dateFields.forEach(([field, count]) => {
      console.log(`  ${field}: ${count}/100`);
    });

    // Check for location fields
    const locationFields = sortedFields.filter(
      ([field]) =>
        field.toLowerCase().includes('port') ||
        field.toLowerCase().includes('destination') ||
        field.toLowerCase().includes('region') ||
        field.toLowerCase().includes('country')
    );

    console.log('\nLocation fields:');
    locationFields.forEach(([field, count]) => {
      console.log(`  ${field}: ${count}/100`);
    });

    // Check if we have itinerary data
    const itineraryFields = sortedFields.filter(
      ([field]) =>
        field.toLowerCase().includes('itinerary') ||
        field.toLowerCase().includes('stop') ||
        field.toLowerCase().includes('day')
    );

    console.log('\nItinerary fields:');
    itineraryFields.forEach(([field, count]) => {
      console.log(`  ${field}: ${count}/100`);
    });

    // Look for frequently accessed fields that might benefit from extraction
    console.log('\n=== FIELDS SUITABLE FOR EXTRACTION ===\n');

    const extractionCandidates = sortedFields.filter(([field, count]) => {
      // High occurrence and not deeply nested
      return count >= 80 && field.split('.').length <= 2;
    });

    console.log('High-frequency fields (80%+ occurrence):');
    extractionCandidates.forEach(([field, count]) => {
      const types = Array.from(fieldTypes[field]).join(', ');
      const example = JSON.stringify(fieldExamples[field])?.substring(0, 100);
      console.log(`\n${field}: ${count}/100 (${types})`);
      if (example && example !== 'null' && example !== '{}' && example !== '[]') {
        console.log(`  Example: ${example}`);
      }
    });

    // Get actual data statistics
    console.log('\n=== DATABASE STATISTICS ===\n');

    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN raw_data IS NOT NULL AND raw_data::text != '{}' THEN 1 END) as with_data,
        COUNT(CASE WHEN raw_data->>'cheapestprice' IS NOT NULL THEN 1 END) as with_cheapest_price,
        COUNT(CASE WHEN raw_data->>'duration' IS NOT NULL THEN 1 END) as with_duration,
        COUNT(CASE WHEN raw_data->>'nights' IS NOT NULL THEN 1 END) as with_nights,
        COUNT(CASE WHEN raw_data->>'shipname' IS NOT NULL THEN 1 END) as with_shipname,
        COUNT(CASE WHEN raw_data->>'departureport' IS NOT NULL THEN 1 END) as with_departure_port,
        COUNT(CASE WHEN raw_data->>'destinationname' IS NOT NULL THEN 1 END) as with_destination,
        COUNT(CASE WHEN raw_data->>'itinerary' IS NOT NULL THEN 1 END) as with_itinerary
      FROM cruises
      WHERE is_active = true
    `);

    const stats = statsResult.rows[0];
    console.log(`Total active cruises: ${stats.total_cruises}`);
    console.log(
      `With raw_data: ${stats.with_data} (${((stats.with_data / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With cheapest price: ${stats.with_cheapest_price} (${((stats.with_cheapest_price / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With duration: ${stats.with_duration} (${((stats.with_duration / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With nights: ${stats.with_nights} (${((stats.with_nights / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With ship name: ${stats.with_shipname} (${((stats.with_shipname / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With departure port: ${stats.with_departure_port} (${((stats.with_departure_port / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With destination: ${stats.with_destination} (${((stats.with_destination / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `With itinerary: ${stats.with_itinerary} (${((stats.with_itinerary / stats.total_cruises) * 100).toFixed(1)}%)`
    );
  } catch (error) {
    console.error('Error analyzing raw_data:', error);
  } finally {
    await pool.end();
  }
}

analyzeRawDataFields();
