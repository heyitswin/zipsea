import { traveltekApiService } from './traveltek-api.service';
import { traveltekSessionService } from './traveltek-session.service';
import { slackService } from './slack.service';
import { db, sql } from '../db/connection';
import { bookings, bookingPassengers, bookingPayments } from '../db/schema';
import { cruises, cruiseLines, ships } from '../db/schema';
import { eq } from 'drizzle-orm';

interface PassengerDetails {
  passengerNumber: number;
  passengerType: 'adult' | 'child' | 'infant';
  title?: string; // Mr, Mrs, Ms, Miss, Dr, etc. - Optional, will default based on gender
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'M' | 'F';
  nationality: string; // ISO country code
  citizenship: string; // ISO country code
  email?: string;
  phone?: string;
  isLeadPassenger: boolean;
}

interface ContactDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PaymentDetails {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
  amount: number;
  paymentType: 'deposit' | 'full_payment';
}

interface CabinSelectionParams {
  sessionId: string;
  cruiseId: string;
  resultNo: string; // From cabin grades response
  gradeNo: string; // From cabin grades response
  rateCode: string; // From cabin grades response
  cabinResult?: string; // Optional specific cabin result
  cabinNo?: string; // Optional specific cabin number
}

interface BookingParams {
  sessionId: string;
  passengers: PassengerDetails[];
  contact: ContactDetails;
  payment: PaymentDetails;
  dining: string; // Dining selection code
}

interface BookingResult {
  bookingId: string;
  traveltekBookingId: string;
  status: 'confirmed' | 'pending' | 'failed' | 'hold';
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  balanceDueDate: string;
  confirmationNumber?: string;
  bookingDetails: any;
}

/**
 * Booking Orchestration Service
 *
 * High-level service that orchestrates the complete booking flow:
 * 1. Get live cabin pricing
 * 2. Add to basket
 * 3. Collect passenger details
 * 4. Create booking with Traveltek
 * 5. Process payment
 * 6. Store booking in database
 *
 * Uses traveltek-api.service for API calls and traveltek-session.service for session management.
 */
class TraveltekBookingService {
  /**
   * Get live cabin pricing for a cruise
   *
   * This is called from the cruise detail page to show real-time pricing.
   * Requires an active booking session with passenger count.
   *
   * OPTIMIZATION: Caches pricing data in Redis for 5 minutes to speed up repeated requests.
   *
   * @param sessionId - Active booking session ID
   * @param cruiseId - Cruise ID (codetocruiseid from Traveltek, stored as cruises.id)
   * @returns Cabin grades with pricing
   */
  async getCabinPricing(sessionId: string, cruiseId: string): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      const { adults, children, childAges } = sessionData.passengerCount;

      // Check Redis cache first for faster response
      // Cache key includes cruise ID and passenger count for accurate pricing
      const cacheKey = `cabin_pricing:${cruiseId}:${adults}a:${children}c:${childAges.join(',')}`;

      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          console.log(`[TraveltekBooking] 🚀 Cache HIT for cabin pricing: ${cruiseId}`);
          redis.disconnect();
          return JSON.parse(cachedData);
        }
        console.log(`[TraveltekBooking] Cache MISS for cabin pricing: ${cruiseId}`);
      } catch (cacheError) {
        console.warn('[TraveltekBooking] Redis cache read failed:', cacheError);
      }

      // Get cruise to verify it exists
      // Use raw SQL to avoid schema mismatch issues between environments
      const cruiseResult = await sql`
        SELECT id, cruise_line_id, ship_id, sailing_date
        FROM cruises
        WHERE id = ${cruiseId}
        LIMIT 1
      `;

      if (cruiseResult.length === 0) {
        redis.disconnect();
        throw new Error('Cruise not found');
      }

      const cruise = cruiseResult[0];

      // Get cabin grades from Traveltek API
      // cruises.id is the codetocruiseid from Traveltek

      // Format child DOBs for API (YYYY-MM-DD)
      // Calculate DOB from ages assuming today's date
      const childDobs = childAges.map((age: number) => {
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - age);
        return dob.toISOString().split('T')[0];
      });

      const getCabinGradesParams = {
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid, // Fixed SID value (52471)
        codetocruiseid: cruise.id, // This is correct - cruises.id IS the codetocruiseid
        adults,
        children,
        childDobs: childDobs.length > 0 ? childDobs : undefined,
      };

      console.log('[TraveltekBooking] 🚀 Calling getCabinGrades with params:', {
        ...getCabinGradesParams,
        sessionkey: '***' + getCabinGradesParams.sessionkey.slice(-8),
      });

      const pricingData = await traveltekApiService.getCabinGrades(getCabinGradesParams);

      console.log(`[TraveltekBooking] Retrieved cabin pricing for cruise ${cruiseId}`);
      console.log('[TraveltekBooking] 🔍 getCabinGrades response structure:', {
        hasResults: !!pricingData.results,
        resultsCount: pricingData.results?.length || 0,
        hasMeta: !!pricingData.meta,
        metaCriteriaKeys: pricingData.meta?.criteria ? Object.keys(pricingData.meta.criteria) : [],
      });

      // Transform Traveltek response to match frontend expected format
      // Frontend expects: { cabins: [...] }
      // Traveltek returns: { results: [...] }

      // DEBUG: Log first cabin to see Traveltek's actual structure
      if (pricingData.results && pricingData.results.length > 0) {
        console.log(
          '[TraveltekBooking] 🔍 DEBUG First cabin from Traveltek:',
          JSON.stringify(pricingData.results[0], null, 2)
        );
      }

      // Transform cabin grades - each cabin should appear ONCE with its cheapest rate
      // Per Traveltek docs: gridpricing array contains multiple rate codes for the SAME cabin grade
      const cabins: any[] = [];

      (pricingData.results || []).forEach((cabin: any) => {
        // Find the cheapest available rate from gridpricing array
        let cheapestOption = null;

        if (cabin.gridpricing && Array.isArray(cabin.gridpricing) && cabin.gridpricing.length > 0) {
          // Filter to available options and find cheapest
          const availableOptions = cabin.gridpricing.filter((opt: any) => opt.available === 'Y');

          if (availableOptions.length > 0) {
            cheapestOption = availableOptions.reduce((cheapest: any, current: any) => {
              const cheapestPrice = parseFloat(cheapest.price || '99999');
              const currentPrice = parseFloat(current.price || '99999');
              return currentPrice < cheapestPrice ? current : cheapest;
            });
          }
        }

        // Only add cabin if we have a valid pricing option
        if (cheapestOption) {
          // Transform all available rates for this cabin to be easily accessible by rate code
          const ratesByCode: Record<string, any> = {};
          cabin.gridpricing
            .filter((opt: any) => opt.available === 'Y')
            .forEach((rate: any) => {
              ratesByCode[rate.ratecode] = {
                price: parseFloat(rate.price || '0'),
                gradeno: rate.gradeno,
                ratecode: rate.ratecode,
                resultno: rate.resultno || cabin.resultno, // Use rate-specific resultno if available, fallback to cabin resultno
                fare: parseFloat(rate.fare || '0'),
                taxes: parseFloat(rate.taxes || '0'),
                fees: parseFloat(rate.fees || '0'),
                gratuity: parseFloat(rate.gratuity || '0'),
              };
            });

          cabins.push({
            code: cabin.cabincode || cabin.code || cabin.gradecode,
            name: cabin.name,
            description: cabin.description,
            category: cabin.codtype, // 'inside', 'outside', 'balcony', 'suite'
            imageUrl: cabin.imageurlhd || cabin.imageurl,
            cheapestPrice: parseFloat(cheapestOption.price || cabin.cheapestprice || '0'),
            isGuaranteed:
              cabin.code?.toLowerCase().includes('guarantee') ||
              cabin.name?.toLowerCase().includes('guarantee'),
            resultNo: cabin.resultno,
            gradeNo: cheapestOption.gradeno, // Use gradeno from cheapest pricing option
            rateCode: cheapestOption.ratecode || '', // Use ratecode from cheapest pricing option
            // Include all rate options indexed by rate code for easy lookup when user changes selection
            ratesByCode,
            // Accessibility indicator (modified:1 = accessible cabin)
            accessible: cabin.modified === 1 || cabin.modified === '1',
          });
        } else if (cabin.gradeno && cabin.ratecode) {
          // Fallback: If no gridpricing array, use top-level values
          const singleRateByCode: Record<string, any> = {
            [cabin.ratecode]: {
              price: parseFloat(cabin.cheapestprice || '0'),
              gradeno: cabin.gradeno,
              ratecode: cabin.ratecode,
              resultno: cabin.resultno,
              fare: 0,
              taxes: 0,
              fees: 0,
              gratuity: 0,
            },
          };

          cabins.push({
            code: cabin.cabincode || cabin.code || cabin.gradecode,
            name: cabin.name,
            description: cabin.description,
            category: cabin.codtype,
            imageUrl: cabin.imageurlhd || cabin.imageurl,
            cheapestPrice: parseFloat(cabin.cheapestprice || '0'),
            isGuaranteed:
              cabin.code?.toLowerCase().includes('guarantee') ||
              cabin.name?.toLowerCase().includes('guarantee'),
            resultNo: cabin.resultno,
            gradeNo: cabin.gradeno,
            rateCode: cabin.ratecode || '',
            ratesByCode: singleRateByCode,
            // Accessibility indicator (modified:1 = accessible cabin)
            accessible: cabin.modified === 1 || cabin.modified === '1',
          });
        }
      });

      // Extract rate code metadata from meta.criteria.ratecodes (per Traveltek docs)
      const rateCodeMetadata = new Map<string, any>();
      if (
        pricingData.meta?.criteria?.ratecodes &&
        Array.isArray(pricingData.meta.criteria.ratecodes)
      ) {
        pricingData.meta.criteria.ratecodes.forEach((rateInfo: any) => {
          // Debug: Log the actual nonrefundable value from Traveltek
          console.log(
            `[TraveltekBooking] 🔍 Rate ${rateInfo.code}: nonrefundable=${rateInfo.nonrefundable} (type: ${typeof rateInfo.nonrefundable})`
          );

          // BUG FIX: Traveltek's nonrefundable field is unreliable (often returns 0 even for non-refundable rates)
          // Instead, check the description/name for keywords indicating non-refundable status
          const description = (rateInfo.description || rateInfo.name || '').toLowerCase();
          const name = (rateInfo.name || '').toLowerCase();
          const code = (rateInfo.code || '').toLowerCase();

          // Check for non-refundable indicators in description, name, or code
          const hasNonRefundableKeyword =
            description.includes('nonrefundable') ||
            description.includes('non-refundable') ||
            description.includes('nrd') || // Non-Refundable Deposit
            name.includes('nonrefundable') ||
            name.includes('non-refundable') ||
            name.includes('nrd') ||
            code.includes('nrd');

          rateCodeMetadata.set(rateInfo.code, {
            code: rateInfo.code,
            name: rateInfo.name || rateInfo.code,
            description: rateInfo.description || rateInfo.name || rateInfo.code,
            // Use description-based check instead of unreliable nonrefundable field
            // If description mentions "nonrefundable" or "NRD", it's NOT refundable
            isRefundable: !hasNonRefundableKeyword,
            faretype: rateInfo.faretype,
            // Per Traveltek docs: military/senior/pastpassenger are 0/1 integers
            military:
              rateInfo.military === 1 || rateInfo.military === true || rateInfo.military === 'Y',
            senior: rateInfo.senior === 1 || rateInfo.senior === true || rateInfo.senior === 'Y',
            pastpassenger:
              rateInfo.pastpassenger === 1 ||
              rateInfo.pastpassenger === true ||
              rateInfo.pastpassenger === 'Y',
          });
        });
      }

      // Extract all unique rate codes that are actually available in gridpricing
      const rateCodesMap = new Map<string, any>();

      (pricingData.results || []).forEach((cabin: any) => {
        if (cabin.gridpricing && Array.isArray(cabin.gridpricing)) {
          cabin.gridpricing.forEach((rate: any) => {
            if (rate.available === 'Y' && rate.ratecode && !rateCodesMap.has(rate.ratecode)) {
              // Use metadata from meta.criteria.ratecodes if available
              const metadata = rateCodeMetadata.get(rate.ratecode);
              if (metadata) {
                rateCodesMap.set(rate.ratecode, metadata);
              } else {
                // Fallback to gridpricing data if metadata not found
                rateCodesMap.set(rate.ratecode, {
                  code: rate.ratecode,
                  name: rate.ratecode,
                  description: rate.ratecode,
                  isRefundable: false,
                });
              }
            }
          });
        }
      });

      const availableRateCodes = Array.from(rateCodesMap.values());

      console.log(`[TraveltekBooking] 📊 Found ${availableRateCodes.length} unique rate codes`);
      availableRateCodes.forEach(rate => {
        console.log(
          `   - ${rate.code}${rate.isRefundable ? ' (REFUNDABLE)' : ''}: ${rate.description}`
        );
      });

      const result = {
        cabins,
        sessionId,
        cruiseId,
        availableRateCodes, // Add available rate codes for frontend selector
      };

      // Cache the result for 5 minutes (300 seconds)
      // Pricing changes infrequently, so this provides a good balance
      try {
        await redis.setex(cacheKey, 300, JSON.stringify(result));
        console.log(`[TraveltekBooking] 💾 Cached cabin pricing for 5 minutes: ${cruiseId}`);
      } catch (cacheError) {
        console.warn('[TraveltekBooking] Failed to cache pricing:', cacheError);
      } finally {
        redis.disconnect();
      }

      return result;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get cabin pricing:', error);
      throw error;
    }
  }

  /**
   * Select cabin and add to basket
   *
   * User has selected a cabin grade from the pricing response.
   * Add it to the Traveltek basket.
   *
   * @param params - Cabin selection parameters (must include resultNo, gradeNo, rateCode from pricing response)
   * @returns Updated basket data
   */
  async selectCabin(params: CabinSelectionParams): Promise<any> {
    try {
      console.log(
        '[TraveltekBooking] 🔍 selectCabin called with params:',
        JSON.stringify({
          sessionId: params.sessionId,
          cruiseId: params.cruiseId,
          resultNo: params.resultNo,
          gradeNo: params.gradeNo,
          rateCode: params.rateCode,
          cabinResult: params.cabinResult,
          cabinNo: params.cabinNo,
        })
      );

      // Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      console.log(
        '[TraveltekBooking] 🔍 Session data:',
        JSON.stringify({
          sessionKey: sessionData.sessionKey ? '***' + sessionData.sessionKey.slice(-8) : 'MISSING',
          sid: sessionData.sid,
          cruiseId: sessionData.cruiseId,
          hasPassengerCount: !!sessionData.passengerCount,
        })
      );

      // Get cruise data to verify
      // Use raw SQL to avoid schema mismatch issues between environments
      const cruiseResult = await sql`
        SELECT id, cruise_line_id, ship_id, sailing_date
        FROM cruises
        WHERE id = ${params.cruiseId}
        LIMIT 1
      `;

      if (cruiseResult.length === 0) {
        throw new Error('Cruise not found');
      }

      const cruise = cruiseResult[0];
      console.log('[TraveltekBooking] 🔍 Cruise found:', {
        id: cruise.id,
        cruiseLineId: cruise.cruise_line_id,
        shipId: cruise.ship_id,
        sailingDate: cruise.sailing_date,
      });

      // NOTE: Removed getCabinGrades call before addToBasket
      // Previously tried to refresh pricing by calling getCabinGrades first, but this caused issues:
      // - Rate codes change frequently (DM996598 → DM996603, etc.)
      // - User's selected rate code may no longer exist after getCabinGrades refresh
      // - This resulted in addToBasket returning price: 0, paymentoption: "none"
      // Solution: Trust the user's selection from when they loaded the pricing page
      // The addToBasket API will return current pricing for that cabin grade

      console.log(
        '[TraveltekBooking] 🚀 Adding to basket directly (no pre-refresh to avoid rate code mismatches)'
      );

      // Build addToBasket params
      // For guaranteed cabins: only send resultno, gradeno, ratecode
      // For specific cabins: also send cabinresult and cabinno
      const addToBasketParams: any = {
        sessionkey: sessionData.sessionKey,
        type: 'cruise' as const,
        resultno: params.resultNo,
        gradeno: params.gradeNo,
        ratecode: params.rateCode,
      };

      // Only add cabinresult for specific cabin selection
      if (params.cabinResult) {
        addToBasketParams.cabinresult = params.cabinResult;
      }

      // Only add cabinno for specific cabin number
      if (params.cabinNo) {
        addToBasketParams.cabinno = params.cabinNo;
      }

      console.log(
        '[TraveltekBooking] 🚀 Calling addToBasket with params:',
        JSON.stringify({
          ...addToBasketParams,
          sessionkey: '***' + addToBasketParams.sessionkey.slice(-8),
        })
      );

      const basketData = await traveltekApiService.addToBasket(addToBasketParams);

      console.log('[TraveltekBooking] 🔍 addToBasket response keys:', Object.keys(basketData));
      if (basketData.errors) {
        console.log('[TraveltekBooking] 🔍 Response has errors field');
      }
      if (basketData.warnings) {
        console.log('[TraveltekBooking] 🔍 Response has warnings:', basketData.warnings);
      }

      // Check if Traveltek returned errors in response body
      if (basketData.errors && basketData.errors.length > 0) {
        console.error(
          '[TraveltekBooking] ❌ Traveltek returned errors:',
          JSON.stringify(basketData.errors, null, 2)
        );
        const errorMessages = basketData.errors
          .map(
            (e: any) => `${e.code}: ${e.text || e.message || e.msg || e.error || 'Unknown error'}`
          )
          .join(', ');
        console.error('[TraveltekBooking] ❌ Error messages:', errorMessages);
        throw new Error(`Failed to add cabin to basket: ${errorMessages}`);
      }

      // Check if the selected rate is no longer available (price = 0, paymentoption = "none")
      // This happens when rate codes expire or sell out between loading pricing and reserving
      const basketItem = basketData.results?.[0]?.basketitems?.[0];
      if (basketItem && basketItem.price === 0 && basketItem.paymentoption === 'none') {
        console.warn(
          '[TraveltekBooking] ⚠️  Rate no longer available (price=0, paymentoption=none)'
        );
        console.warn('[TraveltekBooking] ⚠️  Attempting to find alternative rate...');

        // Get fresh pricing to find current available rates
        const { adults, children, childAges } = sessionData.passengerCount;
        const childDobs = (childAges || []).map((age: number) => {
          const dob = new Date();
          dob.setFullYear(dob.getFullYear() - age);
          return dob.toISOString().split('T')[0];
        });

        const freshPricing = await traveltekApiService.getCabinGrades({
          sessionkey: sessionData.sessionKey,
          sid: sessionData.sid,
          codetocruiseid: cruise.id,
          adults,
          children,
          childDobs: childDobs.length > 0 ? childDobs : undefined,
        });

        // Extract cabin type from the original gradeno (format: "201:RATECODE:TYPE")
        const gradeNoParts = params.gradeNo.split(':');
        const cabinTypeIndex = gradeNoParts.length >= 3 ? gradeNoParts[2] : null;

        console.log(
          '[TraveltekBooking] 🔍 Looking for alternative rate with cabin type index:',
          cabinTypeIndex
        );

        // Find a matching cabin grade with the same type from fresh pricing
        let alternativeGrade = null;
        if (cabinTypeIndex && freshPricing.results && freshPricing.results.length > 0) {
          alternativeGrade = freshPricing.results.find((r: any) => {
            const parts = r.gradeno?.split(':');
            return parts && parts.length >= 3 && parts[2] === cabinTypeIndex;
          });
        }

        if (alternativeGrade && alternativeGrade.price > 0) {
          console.log('[TraveltekBooking] ✅ Found alternative rate:', {
            originalRate: params.rateCode,
            newRate: alternativeGrade.ratecode,
            originalPrice: basketItem.searchprice || 'unknown',
            newPrice: alternativeGrade.price,
          });

          // Try adding to basket with the fresh rate
          const retryParams = {
            ...addToBasketParams,
            resultno: alternativeGrade.resultno,
            gradeno: alternativeGrade.gradeno,
            ratecode: alternativeGrade.ratecode,
          };

          console.log('[TraveltekBooking] 🔄 Retrying addToBasket with fresh rate');
          const retryBasketData = await traveltekApiService.addToBasket(retryParams);

          // Update basketData to use the retry response
          Object.assign(basketData, retryBasketData);

          console.log('[TraveltekBooking] ✅ Successfully added to basket with alternative rate');
        } else {
          console.error('[TraveltekBooking] ❌ No alternative rates available');
          throw new Error(
            'The selected rate is no longer available and no alternatives were found. Please refresh the page to see current pricing.'
          );
        }
      }

      // Extract itemkey from basket response
      // The itemkey is needed for booking creation to specify dining preferences
      // Note: basketitems is nested inside results[0], not at the top level
      let itemkey: string | undefined;
      if (
        basketData.results &&
        basketData.results.length > 0 &&
        basketData.results[0].basketitems &&
        basketData.results[0].basketitems.length > 0
      ) {
        // Get the first basket item (the cruise we just added)
        const basketItem = basketData.results[0].basketitems[0];
        itemkey = basketItem.itemkey;
        console.log('[TraveltekBooking] 📦 Extracted itemkey from basket:', itemkey);
      } else {
        console.warn(
          '[TraveltekBooking] ⚠️ No basketitems found in response, itemkey not available'
        );
      }

      // Update session with basket data and itemkey
      // Note: We're only storing the basketData for now since we don't have complete cabin details
      // The selectedCabinGrade and selectedCabin fields in the schema expect full objects,
      // but we only have the IDs at this point. We can add them later if needed.
      console.log('[TraveltekBooking] 💾 Saving basketData to session:');
      console.log('  - basketData has items?', !!basketData.results?.[0]?.basketitems?.length);
      console.log('  - basketData.results[0].totalprice:', basketData.results?.[0]?.totalprice);
      console.log('  - basketData.results[0].totaldeposit:', basketData.results?.[0]?.totaldeposit);
      console.log(
        '  - Full basketData.results[0]:',
        JSON.stringify(basketData.results?.[0], null, 2)
      );
      console.log('  - basketData structure:', JSON.stringify(basketData).substring(0, 300));

      await traveltekSessionService.updateSession(params.sessionId, {
        basketData,
        itemkey,
      });

      console.log(`[TraveltekBooking] ✅ Added cabin to basket for session ${params.sessionId}`);
      return basketData;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to select cabin:', error);
      throw error;
    }
  }

  /**
   * Get specific available cabins for a cabin grade
   *
   * @param params - Cabin grade parameters
   * @returns List of specific cabins with availability
   */
  async getSpecificCabins(params: {
    sessionId: string;
    cruiseId: string;
    resultNo: string;
    gradeNo: string;
    rateCode: string;
  }): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Get specific cabins from Traveltek API
      const cabinsData = await traveltekApiService.getCabins({
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid,
        resultno: params.resultNo,
        gradeno: params.gradeNo,
        ratecode: params.rateCode,
      });

      // Log first cabin for debugging deck field structure
      if (cabinsData.results && cabinsData.results.length > 0) {
        console.log(
          '[TraveltekBooking] 🔍 DEBUG First cabin from getCabins:',
          JSON.stringify(cabinsData.results[0], null, 2)
        );
      }

      // Get cruise to fetch ship_id for deck plans
      const cruiseResult = await sql`
        SELECT ship_id
        FROM cruises
        WHERE id = ${params.cruiseId}
        LIMIT 1
      `;

      // Get ship details for deck plans
      let deckPlans = null;
      if (cruiseResult.length > 0 && cruiseResult[0].ship_id) {
        try {
          const shipId = cruiseResult[0].ship_id;
          console.log('[TraveltekBooking] 🚢 Fetching ship details for shipId:', shipId);
          const shipDetails = await traveltekApiService.getShipDetails({
            sessionkey: sessionData.sessionKey,
            shipid: shipId, // Per Traveltek docs: use shipid not sid
          });

          console.log(
            '[TraveltekBooking] 🔍 Ship details response keys:',
            Object.keys(shipDetails)
          );

          // Traveltek returns ship data in results field (or results array)
          const shipData =
            shipDetails.results && Array.isArray(shipDetails.results)
              ? shipDetails.results[0]
              : shipDetails.results || shipDetails;

          console.log('[TraveltekBooking] 🔍 Ship data keys:', Object.keys(shipData || {}));

          if (shipData?.decks) {
            console.log('[TraveltekBooking] 🔍 Decks length:', shipData.decks.length);
            if (shipData.decks.length > 0) {
              console.log(
                '[TraveltekBooking] 🔍 First deck sample:',
                JSON.stringify(shipData.decks[0]).substring(0, 200)
              );
            }
          } else {
            console.log('[TraveltekBooking] ⚠️  No decks field in ship data');
            console.log(
              '[TraveltekBooking] 🔍 Available ship data fields:',
              Object.keys(shipData || {})
            );
          }

          // Extract deck plan images indexed by deck code/name
          if (shipData?.decks && Array.isArray(shipData.decks)) {
            deckPlans = shipData.decks.map((deck: any) => ({
              name: deck.name,
              deckCode: deck.deckcode,
              deckId: deck.id,
              imageUrl: deck.imageurl,
              description: deck.description,
            }));
            console.log(`[TraveltekBooking] ✅ Retrieved ${deckPlans.length} deck plans`);
          }
        } catch (error) {
          console.error('[TraveltekBooking] ❌ Failed to get ship details for deck plans:', error);
          if (error instanceof Error) {
            console.error('[TraveltekBooking] Error message:', error.message);
            console.error('[TraveltekBooking] Error stack:', error.stack);
          }
          // Continue without deck plans if this fails
        }
      } else {
        console.log('[TraveltekBooking] ⚠️  No ship_id found for cruise, skipping deck plans');
      }

      // Transform response to match frontend expected format
      // Per Traveltek docs: deck info can be in deckname, deckcode, or deck fields
      // Include x1, y1, x2, y2 coordinates for cabin highlighting on deck plans
      const cabins = (cabinsData.results || []).map((cabin: any) => ({
        cabinNo: cabin.cabinno || cabin.cabinNumber,
        deck: cabin.deckname || cabin.deck || cabin.deckcode || 'Unknown',
        deckCode: cabin.deckcode,
        deckId: cabin.deckid,
        position: cabin.position || cabin.location,
        features: cabin.features || [],
        obstructed: cabin.obstructed === true || cabin.obstructed === 'Y',
        available: cabin.available !== false && cabin.available !== 'N',
        resultNo: cabin.resultno,
        // Coordinates for highlighting cabin on deck plan
        x1: cabin.x1,
        y1: cabin.y1,
        x2: cabin.x2,
        y2: cabin.y2,
        // Accessibility indicator (modified:1 = accessible cabin)
        accessible: cabin.modified === 1 || cabin.modified === '1',
      }));

      console.log(
        `[TraveltekBooking] Retrieved ${cabins.length} specific cabins for grade ${params.gradeNo}`
      );

      return {
        cabins,
        deckPlans, // Array of deck plan images with metadata
        sessionId: params.sessionId,
        cruiseId: params.cruiseId,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get specific cabins:', error);
      throw error;
    }
  }

  /**
   * Get current basket contents
   *
   * @param sessionId - Active booking session ID
   * @returns Basket data
   */
  async getBasket(sessionId: string): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Get basket with sessionkey and default resultkey
      const basketData = await traveltekApiService.getBasket({
        sessionkey: sessionData.sessionKey,
      });

      // Check if basket is empty but we have cached basketData from selectCabin
      // This handles race conditions where frontend requests basket before Traveltek
      // has fully processed the addToBasket call
      const basketItems = basketData.results?.[0]?.basketitems || [];

      // Debug logging to trace the issue
      console.log('[TraveltekBooking] 🔍 Basket debug info:');
      console.log('  - API basketItems length:', basketItems.length);
      console.log('  - Session has basketData?', !!sessionData.basketData);
      if (sessionData.basketData) {
        const cachedItems = sessionData.basketData.results?.[0]?.basketitems || [];
        console.log('  - Cached basketItems length:', cachedItems.length);
        console.log(
          '  - Cached basket structure:',
          JSON.stringify(sessionData.basketData).substring(0, 200)
        );
      }

      const hasCachedBasket =
        sessionData.basketData && sessionData.basketData.results?.[0]?.basketitems?.length > 0;
      console.log('  - hasCachedBasket?', hasCachedBasket);

      if (basketItems.length === 0 && hasCachedBasket) {
        console.log(
          '[TraveltekBooking] 📦 Basket empty from API, using cached basket from session'
        );
        console.log(
          '[TraveltekBooking] 💵 Returning cached totalprice:',
          sessionData.basketData.results?.[0]?.totalprice
        );
        console.log(
          '[TraveltekBooking] 💵 Returning cached totaldeposit:',
          sessionData.basketData.results?.[0]?.totaldeposit
        );
        return sessionData.basketData;
      }

      console.log(
        '[TraveltekBooking] 💵 Returning API totalprice:',
        basketData.results?.[0]?.totalprice
      );
      console.log(
        '[TraveltekBooking] 💵 Returning API totaldeposit:',
        basketData.results?.[0]?.totaldeposit
      );
      return basketData;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get basket:', error);
      throw error;
    }
  }

  /**
   * Create booking with passenger details
   *
   * This is the main booking flow that:
   * 1. Creates the booking with Traveltek
   * 2. Processes payment
   * 3. Stores everything in our database
   * 4. Marks session as completed
   *
   * @param params - Complete booking parameters
   * @returns Booking result with confirmation
   */
  async createBooking(params: BookingParams): Promise<BookingResult> {
    try {
      // Step 1: Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Step 2: Validate passenger count matches session
      const totalPassengers = params.passengers.length;
      const expectedPassengers =
        sessionData.passengerCount.adults + sessionData.passengerCount.children;

      if (totalPassengers !== expectedPassengers) {
        throw new Error(
          `Passenger count mismatch: expected ${expectedPassengers}, got ${totalPassengers}`
        );
      }

      // Step 3: Validate itemkey is available
      if (!sessionData.itemkey) {
        throw new Error('No itemkey found in session. Please select a cabin before booking.');
      }

      // Step 4: Create booking with Traveltek INCLUDING payment
      // Per Traveltek docs: Include ccard object for full payment bookings
      console.log(
        '🔍 [TraveltekBooking] Raw passengers received from frontend:',
        JSON.stringify(params.passengers, null, 2)
      );

      // Determine card type from card number
      const cardType = this.determineCardType(params.payment.cardNumber);
      console.log(`💳 [TraveltekBooking] Detected card type: ${cardType}`);

      // Get title from lead passenger or first passenger for cardholder
      const leadPassenger = params.passengers.find(p => p.isLeadPassenger) || params.passengers[0];
      const cardholderTitle = leadPassenger.title;

      const bookingResponse = await traveltekApiService.createBooking({
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid,
        itemkey: sessionData.itemkey,
        contact: {
          firstname: params.contact.firstName,
          lastname: params.contact.lastName,
          email: params.contact.email,
          telephone: params.contact.phone,
          address1: params.contact.address,
          city: params.contact.city,
          county: params.contact.state,
          postcode: params.contact.postalCode,
          country: params.contact.country,
        },
        passengers: params.passengers.map(p => {
          const age = this.calculateAge(p.dateOfBirth);
          return {
            title: p.title || this.getDefaultTitle(p.gender, age),
            firstname: p.firstName,
            lastname: p.lastName,
            dob: p.dateOfBirth,
            gender: p.gender,
            nationality: p.nationality,
            paxtype: p.passengerType,
            age: age,
          };
        }),
        dining: params.dining, // Dining seating preference passed to API service
        depositBooking: false, // Full payment for now
        // Include payment card in booking request (per Traveltek docs)
        ccard: {
          amount: params.payment.amount,
          nameoncard: params.payment.cardholderName,
          cardtype: cardType,
          cardnumber: params.payment.cardNumber,
          expirymonth: params.payment.expiryMonth,
          expiryyear: params.payment.expiryYear,
          signature: params.payment.cvv,
          title: cardholderTitle,
          firstname: params.contact.firstName,
          lastname: params.contact.lastName,
          postcode: params.contact.postalCode,
          address1: params.contact.address,
          homecity: params.contact.city,
          county: params.contact.state,
          country: params.contact.country,
        },
      });

      if (!bookingResponse.bookingid) {
        throw new Error('Booking creation failed: no booking ID returned');
      }

      console.log('✅ [TraveltekBooking] Booking created with payment included');

      // Step 5: Store booking in our database
      // Extract transaction ID from booking response
      const transactionId =
        bookingResponse.transactions?.[0]?.transactionid || bookingResponse.transactionid;

      const bookingId = await this.storeBooking({
        sessionId: params.sessionId,
        traveltekBookingId: bookingResponse.bookingid,
        bookingDetails: bookingResponse,
        passengers: params.passengers,
        payment: {
          ...params.payment,
          transactionId: transactionId,
          last4: params.payment.cardNumber.slice(-4),
        },
      });

      // Step 6: Mark session as completed
      await traveltekSessionService.completeSession(params.sessionId);

      console.log(`[TraveltekBooking] Successfully created booking ${bookingId}`);

      // Step 7: Determine payment status from booking response
      // Check if payment was successful by looking at transaction authcode
      const hasAuthCode = bookingResponse.transactions?.[0]?.authcode;
      const paymentStatus = hasAuthCode ? 'confirmed' : 'pending';

      console.log(`💳 [TraveltekBooking] Payment status: ${paymentStatus}`, {
        hasAuthCode: !!hasAuthCode,
        authcode: hasAuthCode || '(empty)',
      });

      // Step 8: Send Slack notification
      try {
        // Get cruise details for the notification
        const cruiseDetails = await this.getCruiseDetailsForNotification(sessionData.cruiseId);

        // Find lead passenger
        const leadPassenger =
          params.passengers.find(p => p.isLeadPassenger) || params.passengers[0];

        await slackService.notifyBookingCreated({
          bookingId,
          confirmationNumber: bookingResponse.confirmationnumber,
          traveltekBookingId: bookingResponse.bookingid,
          cruiseName: cruiseDetails?.cruiseName,
          cruiseLine: cruiseDetails?.cruiseLine,
          shipName: cruiseDetails?.shipName,
          sailingDate: cruiseDetails?.sailingDate,
          nights: cruiseDetails?.nights,
          passengerCount: params.passengers.length,
          totalAmount: bookingResponse.totalcost,
          paidAmount: params.payment.amount,
          depositAmount: bookingResponse.depositamount,
          balanceDueDate: bookingResponse.balanceduedate,
          leadPassenger: {
            firstName: leadPassenger.firstName,
            lastName: leadPassenger.lastName,
            email: leadPassenger.email || params.contact.email,
            phone: leadPassenger.phone || params.contact.phone,
          },
          cabinGrade: bookingResponse.cabingrade || bookingResponse.cabintype,
          rateCode: bookingResponse.ratecode,
          status: paymentStatus,
        });
      } catch (slackError) {
        // Don't fail the booking if Slack notification fails
        console.error('[TraveltekBooking] Failed to send Slack notification:', slackError);
      }

      // Step 9: Return booking result
      return {
        bookingId,
        traveltekBookingId: bookingResponse.bookingid,
        status: paymentStatus,
        totalAmount: bookingResponse.totalcost,
        depositAmount: bookingResponse.depositamount,
        paidAmount: params.payment.amount,
        balanceDueDate: bookingResponse.balanceduedate,
        confirmationNumber: bookingResponse.confirmationnumber,
        bookingDetails: bookingResponse,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to create booking:', error);

      // Mark session as abandoned on failure
      await traveltekSessionService.abandonSession(params.sessionId);

      throw error;
    }
  }

  /**
   * Calculate age from date of birth
   *
   * @param dob - Date of birth in YYYY-MM-DD format
   * @returns Age in years
   */
  private calculateAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Get default title based on gender and age
   * Used when frontend doesn't provide title
   */
  private getDefaultTitle(gender: 'M' | 'F', age: number): string {
    if (gender === 'M') {
      return 'Mr';
    } else {
      // For females, use Miss for children and Ms for adults
      return age < 18 ? 'Miss' : 'Ms';
    }
  }

  /**
   * Determine card type from card number
   *
   * @param cardNumber - Credit card number
   * @returns Traveltek card type code (VIS, MSC, AMX, etc.)
   */
  private determineCardType(cardNumber: string): string {
    // Remove spaces and dashes
    const cleanedNumber = cardNumber.replace(/[\s-]/g, '');

    // Visa: starts with 4
    if (/^4/.test(cleanedNumber)) {
      return 'VIS';
    }

    // Mastercard: starts with 51-55 or 2221-2720
    if (/^5[1-5]/.test(cleanedNumber) || /^2[2-7]/.test(cleanedNumber)) {
      return 'MSC';
    }

    // American Express: starts with 34 or 37
    if (/^3[47]/.test(cleanedNumber)) {
      return 'AMX';
    }

    // Discover: starts with 6011, 622126-622925, 644-649, or 65
    if (/^(6011|65|64[4-9]|622)/.test(cleanedNumber)) {
      return 'DEL';
    }

    // Default to Visa if unknown
    console.warn(
      `[TraveltekBooking] Unknown card type for number starting with ${cleanedNumber.substring(0, 4)}, defaulting to VIS`
    );
    return 'VIS';
  }

  /**
   * Get cruise details for Slack notification
   *
   * @param cruiseId - The cruise ID
   * @returns Cruise details or null
   */
  private async getCruiseDetailsForNotification(cruiseId: string): Promise<{
    cruiseName: string;
    cruiseLine: string;
    shipName: string;
    sailingDate: string;
    nights: number;
  } | null> {
    try {
      const cruise = await db
        .select({
          name: cruises.name,
          nights: cruises.nights,
          sailingDate: cruises.sailingDate,
          lineName: cruiseLines.name,
          shipName: ships.name,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .where(eq(cruises.id, cruiseId))
        .limit(1);

      if (cruise.length === 0) {
        return null;
      }

      const c = cruise[0];
      return {
        cruiseName: c.name || 'Unknown Cruise',
        cruiseLine: c.lineName || 'Unknown Line',
        shipName: c.shipName || 'Unknown Ship',
        sailingDate: c.sailingDate || 'Unknown Date',
        nights: c.nights || 0,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get cruise details for notification:', error);
      return null;
    }
  }

  /**
   * Store booking in database
   *
   * Internal method to persist booking data.
   *
   * @param params - Booking data to store
   * @returns Booking ID (our database ID)
   */
  private async storeBooking(params: {
    sessionId: string;
    traveltekBookingId: string;
    bookingDetails: any;
    passengers: PassengerDetails[];
    payment: any;
  }): Promise<string> {
    try {
      // Insert booking
      const [booking] = await db
        .insert(bookings)
        .values({
          bookingSessionId: params.sessionId,
          traveltekBookingId: params.traveltekBookingId,
          status: 'confirmed',
          bookingDetails: params.bookingDetails,
          totalAmount: params.bookingDetails.totalcost.toString(),
          depositAmount: params.bookingDetails.depositamount.toString(),
          paidAmount: params.payment.amount.toString(),
          paymentStatus: 'paid',
          balanceDueDate: new Date(params.bookingDetails.balanceduedate),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: bookings.id });

      // Insert passengers
      await db.insert(bookingPassengers).values(
        params.passengers.map(p => ({
          bookingId: booking.id,
          passengerNumber: p.passengerNumber,
          passengerType: p.passengerType,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: new Date(p.dateOfBirth),
          gender: p.gender,
          citizenship: p.citizenship,
          email: p.email || null,
          phone: p.phone || null,
          isLeadPassenger: p.isLeadPassenger,
          createdAt: new Date(),
        }))
      );

      // Insert payment
      await db.insert(bookingPayments).values({
        bookingId: booking.id,
        amount: params.payment.amount.toString(),
        paymentType: params.payment.paymentType,
        paymentMethod: 'credit_card',
        last4: params.payment.last4,
        transactionId: params.payment.transactionId,
        status: 'completed',
        createdAt: new Date(),
      });

      console.log(`[TraveltekBooking] Stored booking ${booking.id} in database`);
      return booking.id;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to store booking in database:', error);
      throw error;
    }
  }

  /**
   * Get booking by ID
   *
   * @param bookingId - Booking ID (our database ID)
   * @returns Complete booking data with passengers and payments
   */
  async getBooking(bookingId: string): Promise<any> {
    try {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
          bookingSession: true,
          passengers: true,
          payments: true,
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      return booking;
    } catch (error) {
      console.error(`[TraveltekBooking] Failed to get booking ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Get bookings for a user
   *
   * @param userId - User ID
   * @returns Array of bookings
   */
  async getUserBookings(userId: string): Promise<any[]> {
    try {
      const userBookings = await db.query.bookings.findMany({
        where: (bookings, { eq, and }) =>
          and(
            eq(bookings.bookingSessionId, userId) // This needs to be fixed - should join through bookingSessions
          ),
        with: {
          bookingSession: true,
          passengers: true,
          payments: true,
        },
        orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      });

      return userBookings;
    } catch (error) {
      console.error(`[TraveltekBooking] Failed to get bookings for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create a hold booking without payment
   *
   * This creates a booking with Traveltek WITHOUT processing payment.
   * Useful for "hold cabin" feature where user reserves cabin but pays later.
   *
   * Per Traveltek docs: Omit the `ccard` object to create booking without payment.
   *
   * @param params - Minimal booking parameters (lead passenger contact info)
   * @returns Booking result with hold expiration
   */
  async createHoldBooking(params: {
    sessionId: string;
    leadPassenger: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    holdDurationDays?: number; // Default 7 days
  }): Promise<BookingResult> {
    try {
      // Step 1: Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Step 2: Validate itemkey is available
      if (!sessionData.itemkey) {
        throw new Error('No itemkey found in session. Please select a cabin before booking.');
      }

      // Step 3: Create minimal passenger data for hold
      // Use lead passenger info for all passengers to satisfy API requirements
      const passengerCount =
        sessionData.passengerCount.adults + sessionData.passengerCount.children;
      const holdPassengers = [];

      // Add adults
      for (let i = 0; i < sessionData.passengerCount.adults; i++) {
        holdPassengers.push({
          title: i === 0 ? 'Mr' : 'Mrs', // Simple default
          firstname: params.leadPassenger.firstName,
          lastname: params.leadPassenger.lastName,
          dob: '1990-01-01', // Placeholder DOB
          gender: i === 0 ? 'M' : 'F',
          nationality: 'US',
          paxtype: 'adult' as const,
          age: 30, // Placeholder age
        });
      }

      // Add children with placeholder data
      for (let i = 0; i < sessionData.passengerCount.children; i++) {
        const childAge = sessionData.passengerCount.childAges?.[i] || 10;
        const childDob = new Date();
        childDob.setFullYear(childDob.getFullYear() - childAge);

        holdPassengers.push({
          title: 'Miss',
          firstname: params.leadPassenger.firstName,
          lastname: params.leadPassenger.lastName,
          dob: childDob.toISOString().split('T')[0],
          gender: 'F',
          nationality: 'US',
          paxtype: 'child' as const,
          age: childAge,
        });
      }

      // Step 4: Create booking with Traveltek WITHOUT payment (no ccard object)
      console.log('[TraveltekBooking] 🏗️ Creating hold booking without payment');

      const bookingResponse = await traveltekApiService.createBooking({
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid,
        itemkey: sessionData.itemkey,
        contact: {
          firstname: params.leadPassenger.firstName,
          lastname: params.leadPassenger.lastName,
          email: params.leadPassenger.email,
          telephone: params.leadPassenger.phone,
          // Minimal address info - use placeholders
          address1: 'TBD',
          city: 'TBD',
          county: 'TBD',
          postcode: '00000',
          country: 'US',
        },
        passengers: holdPassengers,
        dining: 'anytime', // Hardcoded per requirements
        depositBooking: false,
        // IMPORTANT: No ccard object = booking created without payment
      });

      if (!bookingResponse.bookingid) {
        throw new Error('Hold booking creation failed: no booking ID returned');
      }

      // Step 5: Calculate hold expiration (default 7 days)
      const holdDays = params.holdDurationDays || 7;
      const holdExpiresAt = new Date();
      holdExpiresAt.setDate(holdExpiresAt.getDate() + holdDays);

      // Step 6: Store booking in our database with hold status
      const bookingId = await this.storeHoldBooking({
        sessionId: params.sessionId,
        traveltekBookingId: bookingResponse.bookingid,
        bookingDetails: bookingResponse,
        leadPassenger: params.leadPassenger,
        holdExpiresAt,
      });

      // Step 7: Mark session as completed
      await traveltekSessionService.completeSession(params.sessionId);

      console.log(`[TraveltekBooking] ✅ Successfully created hold booking ${bookingId}`);

      // Step 8: Send Slack notification for hold booking
      try {
        const cruiseDetails = await this.getCruiseDetailsForNotification(sessionData.cruiseId);

        await slackService.notifyBookingCreated({
          bookingId,
          confirmationNumber: bookingResponse.confirmationnumber,
          traveltekBookingId: bookingResponse.bookingid,
          cruiseName: cruiseDetails?.cruiseName,
          cruiseLine: cruiseDetails?.cruiseLine,
          shipName: cruiseDetails?.shipName,
          sailingDate: cruiseDetails?.sailingDate,
          nights: cruiseDetails?.nights,
          passengerCount,
          totalAmount: bookingResponse.totalcost,
          paidAmount: 0, // No payment yet
          depositAmount: bookingResponse.depositamount,
          balanceDueDate: bookingResponse.balanceduedate,
          leadPassenger: params.leadPassenger,
          cabinGrade: bookingResponse.cabingrade || bookingResponse.cabintype,
          rateCode: bookingResponse.ratecode,
          status: 'hold',
        });
      } catch (slackError) {
        console.error('[TraveltekBooking] Failed to send Slack notification:', slackError);
      }

      // Step 9: Return booking result
      return {
        bookingId,
        traveltekBookingId: bookingResponse.bookingid,
        status: 'hold' as const,
        totalAmount: bookingResponse.totalcost,
        depositAmount: bookingResponse.depositamount,
        paidAmount: 0,
        balanceDueDate: holdExpiresAt.toISOString(),
        confirmationNumber: bookingResponse.confirmationnumber,
        bookingDetails: bookingResponse,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to create hold booking:', error);
      await traveltekSessionService.abandonSession(params.sessionId);
      throw error;
    }
  }

  /**
   * Store hold booking in database
   *
   * @param params - Hold booking data to store
   * @returns Booking ID (our database ID)
   */
  private async storeHoldBooking(params: {
    sessionId: string;
    traveltekBookingId: string;
    bookingDetails: any;
    leadPassenger: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    holdExpiresAt: Date;
  }): Promise<string> {
    try {
      // Insert booking with hold status
      const [booking] = await db
        .insert(bookings)
        .values({
          bookingSessionId: params.sessionId,
          traveltekBookingId: params.traveltekBookingId,
          status: 'hold',
          bookingType: 'hold',
          holdExpiresAt: params.holdExpiresAt,
          bookingDetails: params.bookingDetails,
          totalAmount: params.bookingDetails.totalcost.toString(),
          depositAmount: params.bookingDetails.depositamount.toString(),
          paidAmount: '0',
          paymentStatus: 'pending',
          balanceDueDate: params.holdExpiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: bookings.id });

      // Insert lead passenger only for hold bookings
      await db.insert(bookingPassengers).values({
        bookingId: booking.id,
        passengerNumber: 1,
        passengerType: 'adult',
        firstName: params.leadPassenger.firstName,
        lastName: params.leadPassenger.lastName,
        dateOfBirth: new Date('1990-01-01'), // Placeholder
        gender: 'M',
        citizenship: 'US',
        email: params.leadPassenger.email,
        phone: params.leadPassenger.phone,
        isLeadPassenger: true,
        createdAt: new Date(),
      });

      console.log(`[TraveltekBooking] Stored hold booking ${booking.id} in database`);
      return booking.id;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to store hold booking in database:', error);
      throw error;
    }
  }

  /**
   * Complete payment for a held booking
   *
   * Uses Traveltek's /payment.pl endpoint to process payment for existing booking.
   *
   * @param params - Payment details for held booking
   * @returns Updated booking result
   */
  async completeHoldPayment(params: {
    bookingId: string;
    payment: {
      cardNumber: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
      cardholderName: string;
      amount: number;
    };
    passengers: PassengerDetails[]; // Full passenger details
    contact: ContactDetails; // Full contact details
  }): Promise<BookingResult> {
    try {
      // Step 1: Get booking from database
      const booking = await this.getBooking(params.bookingId);

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'hold') {
        throw new Error('Booking is not in hold status');
      }

      if (booking.holdExpiresAt && new Date() > new Date(booking.holdExpiresAt)) {
        throw new Error('Hold has expired');
      }

      // Step 2: Get session data to access sessionkey
      const sessionData = await traveltekSessionService.getSession(booking.bookingSessionId);
      if (!sessionData) {
        throw new Error('Booking session not found or expired');
      }

      // Step 3: Process payment via Traveltek /payment.pl endpoint
      console.log('[TraveltekBooking] 💳 Processing payment for held booking');

      const paymentResponse = await traveltekApiService.processPayment({
        sessionkey: sessionData.sessionKey,
        cardtype: 'VIS', // TODO: Determine from card number
        cardnumber: params.payment.cardNumber,
        expirymonth: params.payment.expiryMonth,
        expiryyear: params.payment.expiryYear,
        nameoncard: params.payment.cardholderName,
        cvv: params.payment.cvv,
        amount: params.payment.amount.toString(),
        address1: params.contact.address,
        city: params.contact.city,
        postcode: params.contact.postalCode,
        country: params.contact.country,
      });

      // Step 4: Update booking in database
      await db
        .update(bookings)
        .set({
          status: 'confirmed',
          bookingType: 'full_payment',
          paidAmount: params.payment.amount.toString(),
          paymentStatus: 'fully_paid',
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, params.bookingId));

      // Step 5: Update passengers with full details
      // First delete placeholder passenger
      await db.delete(bookingPassengers).where(eq(bookingPassengers.bookingId, params.bookingId));

      // Insert full passenger details
      await db.insert(bookingPassengers).values(
        params.passengers.map(p => ({
          bookingId: params.bookingId,
          passengerNumber: p.passengerNumber,
          passengerType: p.passengerType,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: new Date(p.dateOfBirth),
          gender: p.gender,
          citizenship: p.citizenship,
          email: p.email || null,
          phone: p.phone || null,
          isLeadPassenger: p.isLeadPassenger,
          createdAt: new Date(),
        }))
      );

      // Step 6: Store payment record
      await db.insert(bookingPayments).values({
        bookingId: params.bookingId,
        amount: params.payment.amount.toString(),
        paymentType: 'full_payment',
        paymentMethod: 'credit_card',
        last4: params.payment.cardNumber.slice(-4),
        transactionId: paymentResponse.transactionid,
        status: 'completed',
        createdAt: new Date(),
      });

      console.log(`[TraveltekBooking] ✅ Completed payment for hold booking ${params.bookingId}`);

      // Step 7: Return updated booking result
      return {
        bookingId: params.bookingId,
        traveltekBookingId: booking.traveltekBookingId,
        status: 'confirmed',
        totalAmount: parseFloat(booking.totalAmount),
        depositAmount: parseFloat(booking.depositAmount),
        paidAmount: params.payment.amount,
        balanceDueDate: booking.balanceDueDate?.toISOString() || '',
        confirmationNumber: booking.bookingDetails.confirmationnumber,
        bookingDetails: booking.bookingDetails,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to complete hold payment:', error);
      throw error;
    }
  }

  /**
   * Cancel booking
   *
   * Note: This requires integration with Traveltek's cancellation API.
   * For now, just marks as cancelled in our database.
   *
   * @param bookingId - Booking ID (our database ID)
   */
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      // TODO: Call Traveltek cancellation API

      // Mark as cancelled in our database
      await db
        .update(bookings)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId));

      console.log(`[TraveltekBooking] Cancelled booking ${bookingId}`);
    } catch (error) {
      console.error(`[TraveltekBooking] Failed to cancel booking ${bookingId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const traveltekBookingService = new TraveltekBookingService();
