#!/usr/bin/env node
require('dotenv').config();
const { CruiseService } = require('../dist/services/cruise.service');

async function testCheapestPricingMethod() {
  const cruiseService = new CruiseService();

  try {
    console.log('Testing getCheapestPricing method directly...\n');

    const cheapestPricing = await cruiseService.getCheapestPricing('2145865');

    console.log('Result from getCheapestPricing:');
    console.log(JSON.stringify(cheapestPricing, null, 2));

    if (cheapestPricing.interior) {
      console.log('\nInterior price from method:', cheapestPricing.interior.price);
      console.log('Expected: 456.14');
      console.log('Status:', cheapestPricing.interior.price === 456.14 ? '✅ CORRECT' : '❌ WRONG');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testCheapestPricingMethod();
