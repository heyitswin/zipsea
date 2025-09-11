const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkRegionsAndPorts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');
    console.log('='.repeat(60));

    // Count unique regions
    const regionsResult = await client.query(`
      SELECT
        COUNT(DISTINCT id) as total_regions,
        COUNT(DISTINCT CASE WHEN is_active = true THEN id END) as active_regions
      FROM regions;
    `);

    console.log('REGIONS:');
    console.log(`  Total unique regions: ${regionsResult.rows[0].total_regions}`);
    console.log(`  Active regions: ${regionsResult.rows[0].active_regions}`);

    // Get top regions by cruise count
    const topRegionsResult = await client.query(`
      SELECT
        r.id,
        r.name,
        r.code,
        COUNT(DISTINCT c.id) as cruise_count
      FROM regions r
      LEFT JOIN cruises c ON c.region_ids LIKE '%' || r.id || '%'
      WHERE r.is_active = true
      GROUP BY r.id, r.name, r.code
      ORDER BY cruise_count DESC
      LIMIT 10;
    `);

    console.log('\n  Top 10 Regions by Cruise Count:');
    for (const row of topRegionsResult.rows) {
      console.log(`    ${row.name.padEnd(30)} (${row.code || 'N/A'})  - ${row.cruise_count} cruises`);
    }

    console.log('\n' + '='.repeat(60));

    // Count unique ports
    const portsResult = await client.query(`
      SELECT
        COUNT(DISTINCT id) as total_ports,
        COUNT(DISTINCT CASE WHEN is_active = true THEN id END) as active_ports
      FROM ports;
    `);

    console.log('PORTS:');
    console.log(`  Total unique ports: ${portsResult.rows[0].total_ports}`);
    console.log(`  Active ports: ${portsResult.rows[0].active_ports}`);

    // Count unique departure ports (embark ports)
    const departurePortsResult = await client.query(`
      SELECT
        COUNT(DISTINCT embark_port_id) as unique_departure_ports
      FROM cruises
      WHERE embark_port_id IS NOT NULL
        AND is_active = true;
    `);

    console.log(`  Unique departure ports (in active cruises): ${departurePortsResult.rows[0].unique_departure_ports}`);

    // Get top departure ports
    const topDeparturePortsResult = await client.query(`
      SELECT
        p.id,
        p.name,
        p.city,
        p.country,
        p.country_code,
        COUNT(c.id) as cruise_count
      FROM ports p
      INNER JOIN cruises c ON c.embark_port_id = p.id
      WHERE c.is_active = true
      GROUP BY p.id, p.name, p.city, p.country, p.country_code
      ORDER BY cruise_count DESC
      LIMIT 15;
    `);

    console.log('\n  Top 15 Departure Ports by Cruise Count:');
    for (const row of topDeparturePortsResult.rows) {
      const portName = `${row.name}${row.city ? ', ' + row.city : ''}${row.country ? ', ' + row.country : ''}`;
      console.log(`    ${portName.padEnd(50)} - ${row.cruise_count} cruises`);
    }

    console.log('\n' + '='.repeat(60));

    // Additional statistics
    const statsResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM cruises WHERE is_active = true) as active_cruises,
        (SELECT COUNT(DISTINCT cruise_line_id) FROM cruises WHERE is_active = true) as cruise_lines,
        (SELECT COUNT(DISTINCT ship_id) FROM cruises WHERE is_active = true) as ships
    `);

    console.log('ADDITIONAL STATISTICS:');
    console.log(`  Active cruises: ${statsResult.rows[0].active_cruises}`);
    console.log(`  Cruise lines with active cruises: ${statsResult.rows[0].cruise_lines}`);
    console.log(`  Ships with active cruises: ${statsResult.rows[0].ships}`);

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Error detail:', error);
  } finally {
    await client.end();
  }
}

checkRegionsAndPorts();
