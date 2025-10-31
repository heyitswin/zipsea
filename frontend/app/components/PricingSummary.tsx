"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface PricingSummaryProps {
  sessionId: string;
}

interface PriceBreakdownItem {
  description: string;
  amount: number;
  isDiscount?: boolean;
  isTax?: boolean;
  order?: number;
}

interface PricingData {
  cruiseFare: number;
  taxes: number;
  fees: number;
  discounts: number;
  total: number;
  deposit: number;
  currency: string;
  currencySymbol: string;
  breakdown: PriceBreakdownItem[];
  shipName?: string;
  shipImage?: string;
  cruiseLineName?: string;
  cancellationPolicyUrl?: string;
  isPriceEstimated?: boolean;
  obcAmount?: number; // ZipSea calculated OBC (displayed in green box at bottom)
  apiObcAmount?: number; // Cruise line API OBC (displayed after Total)
  cabinName?: string;
  cabinCode?: string;
  roomNumber?: string;
  deckNumber?: string;
}

export default function PricingSummary({ sessionId }: PricingSummaryProps) {
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricingData = async () => {
      try {
        console.log(
          "💰 PricingSummary: Fetching pricing for session:",
          sessionId,
        );

        // Fetch basket data which contains pricing breakdown
        const basketResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/booking/${sessionId}/basket`,
        );

        if (!basketResponse.ok) {
          throw new Error("Failed to fetch basket data");
        }

        const basketData = await basketResponse.json();
        console.log("🛒 Basket data:", basketData);
        console.log("🛒 basketData.results:", basketData.results);
        console.log("🛒 basketData.results[0]:", basketData.results?.[0]);

        // Extract pricing from basket
        // Note: Traveltek returns totalprice=0 until dining selection is finalized during booking
        // In this case, use searchprice from the basket item as the estimated price
        const basketItem = basketData.results?.[0]?.basketitems?.[0];
        let totalprice = basketData.results?.[0]?.totalprice || 0;
        let totaldeposit = basketData.results?.[0]?.totaldeposit || 0;
        let isPriceEstimated = false;

        // Fallback to searchprice if totalprice is 0
        if (totalprice === 0 && basketItem?.searchprice) {
          console.log("💵 Using searchprice as fallback (totalprice is 0)");
          totalprice = parseFloat(basketItem.searchprice);
          totaldeposit = parseFloat(basketItem.searchdeposit || 0);
          isPriceEstimated = true;
        }

        console.log("💵 Extracted totalprice:", totalprice);
        console.log("💵 Extracted totaldeposit:", totaldeposit);
        console.log("💵 Is price estimated?", isPriceEstimated);

        // ALWAYS use USD - Traveltek sometimes returns CAD in scurrency field even though we request USD
        // All our pricing is in USD, so force it here
        const currency = "USD";
        const currencySymbol = "$";

        // Get breakdown from basket item
        const breakdown: PriceBreakdownItem[] = [];
        let cruiseFare = 0;
        let taxes = 0;
        let fees = 0;
        let gratuities = 0;
        let discounts = 0;

        // ONLY SOURCE: Use pricingBreakdown from session (fetched from cruisecabingradebreakdown.pl)
        // This is the ONLY trusted source - no fallbacks
        if (
          !basketData.pricingBreakdown ||
          !Array.isArray(basketData.pricingBreakdown) ||
          basketData.pricingBreakdown.length === 0
        ) {
          console.error(
            "💥 PricingSummary: Missing pricingBreakdown in basketData",
          );
          throw new Error(
            "Pricing breakdown is not available. Please refresh the page and select your cabin again.",
          );
        }

        console.log(
          "💰 Using pricingBreakdown from session (cruisecabingradebreakdown.pl API)",
        );
        const breakdownSource = basketData.pricingBreakdown;
        let apiObcAmount = 0;

        if (breakdownSource && breakdownSource.length > 0) {
          breakdownSource.forEach((item: any) => {
            // Handle two different API response formats:
            // 1. cruisecabingradebreakdown.pl: items have "prices" array with guest-level pricing
            // 2. basketitem breakdown: items have direct "totalcost" or "sprice" values
            let amount = 0;

            if (item.prices && Array.isArray(item.prices)) {
              // Sum up all guest prices for cruisecabingradebreakdown.pl format
              amount = item.prices.reduce((sum: number, priceItem: any) => {
                const priceValue = parseFloat(
                  priceItem.sprice || priceItem.price || 0,
                );
                return sum + priceValue;
              }, 0);
            } else {
              // Use direct amount for basketitem breakdown format
              amount = parseFloat(item.totalcost || item.sprice || 0);
            }

            let description = item.description || "Unknown";
            const category = item.category?.toLowerCase();

            if (amount === 0) return; // Skip zero amounts

            // Check if this is an onboard credit from the cruise line/API
            const isOnboardCredit =
              description.toLowerCase().includes("onboard credit") ||
              description.toLowerCase().includes("on-board credit") ||
              description.toLowerCase().includes("obc") ||
              category === "credit" ||
              category === "onboard_credit";

            // Extract API OBC separately - don't add to breakdown
            if (isOnboardCredit) {
              apiObcAmount = amount;
              return; // Skip adding to breakdown
            }

            if (category === "fare") {
              // Cruise fare
              breakdown.push({
                description: description,
                amount: amount,
                isDiscount: false,
                isTax: false,
                order: 1, // Display first
              });
              cruiseFare += amount;
            } else if (category === "discount") {
              // Discounts (negative amounts)
              // Try to find promo details from basketitem
              let discountDetails = "";
              if (basketItem?.cruisedetail?.classificationnames) {
                const promos =
                  basketItem.cruisedetail.classificationnames.filter(
                    (name: string) =>
                      name && name.toLowerCase().includes("promo"),
                  );
                if (promos.length > 0) {
                  discountDetails = ` (${promos.join(", ")})`;
                }
              }

              breakdown.push({
                description: description + discountDetails,
                amount: Math.abs(amount), // Display as positive with isDiscount flag
                isDiscount: true,
                isTax: false,
                order: 4, // Display last
              });
              discounts += Math.abs(amount);
            } else if (category === "tax") {
              // Rename "Non-Commissionable Fare" to "Port Fees"
              if (description.toLowerCase().includes("non-commissionable")) {
                description = "Port Fees";
              }

              // Taxes and fees
              breakdown.push({
                description: description,
                amount: amount,
                isDiscount: false,
                isTax: true,
                order: description === "Port Fees" ? 3 : 2, // Port Fees after Taxes & Fees
              });

              // Categorize as taxes or fees based on description
              if (
                description === "Port Fees" ||
                description.toLowerCase().includes("port")
              ) {
                fees += amount;
              } else {
                taxes += amount;
              }
            } else if (
              category === "gratuity" ||
              description.toLowerCase().includes("gratuity")
            ) {
              // Gratuities
              breakdown.push({
                description: description,
                amount: amount,
                isDiscount: false,
                isTax: false,
                order: 3.5, // Between Port Fees and Discount
              });
              gratuities += amount;
            } else {
              // Other items
              breakdown.push({
                description: description,
                amount: amount,
                isDiscount: false,
                isTax: category === "tax",
                order: 5,
              });
            }
          });

          // Sort breakdown by order property
          breakdown.sort((a, b) => (a.order || 99) - (b.order || 99));
        }

        // Validate that we actually got breakdown items
        if (breakdown.length === 0) {
          console.error("💥 PricingSummary: No breakdown items found");
          throw new Error(
            "Pricing details are not available. Please refresh the page and select your cabin again.",
          );
        }

        // Fetch session to get cruise line info for cancellation policy and cabin details
        let shipName = basketItem?.name || undefined;
        let shipImage = basketItem?.image || undefined;
        let cruiseLineName: string | undefined;
        let cancellationPolicyUrl: string | undefined;
        let cabinName: string | undefined;
        let cabinCode: string | undefined;
        let roomNumber: string | undefined;
        let deckNumber: string | undefined;
        let cruise: any = null;

        try {
          const sessionResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/booking/session/${sessionId}`,
          );
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log("🛏️ Session data for cabin details:", {
              selectedCabin: sessionData.selectedCabin,
              cabinName: sessionData.cabinName,
              cabinCode: sessionData.cabinCode,
              roomNumber: sessionData.roomNumber,
              deckNumber: sessionData.deckNumber,
            });

            // Extract cabin details from session
            cabinName = sessionData.cabinName || sessionData.selectedCabin;
            cabinCode = sessionData.cabinCode;
            roomNumber = sessionData.roomNumber;
            deckNumber = sessionData.deckNumber;
            if (sessionData.cruiseId) {
              // Fetch cruise details to get cruise line
              const cruiseResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/cruises/${sessionData.cruiseId}`,
              );
              if (cruiseResponse.ok) {
                const cruiseData = await cruiseResponse.json();
                cruise = cruiseData.data || cruiseData;

                shipName = cruise.shipName || cruise.ship?.name || shipName;
                shipImage =
                  cruise.ship?.defaultShipImageHd ||
                  cruise.ship?.defaultShipImage2k ||
                  cruise.shipImageHd ||
                  shipImage;

                // Fetch cruise line for cancellation policy and determine if live booking
                if (cruise.cruiseLineId) {
                  const lineResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/cruise-lines/${cruise.cruiseLineId}`,
                  );
                  if (lineResponse.ok) {
                    const lineData = await lineResponse.json();
                    cruiseLineName = lineData.name;
                    cancellationPolicyUrl =
                      lineData.cancellationPolicyUrl ||
                      lineData.cancellation_policy_url;
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn("⚠️ Could not fetch session/cruise data:", err);
        }

        // Determine if this is a live booking cruise
        const liveBookingEnabled =
          process.env.NEXT_PUBLIC_ENABLE_LIVE_BOOKING === "true";
        // Parse live booking line IDs from environment variable
        const liveBookingLineIds = process.env.NEXT_PUBLIC_LIVE_BOOKING_LINE_IDS
          ? process.env.NEXT_PUBLIC_LIVE_BOOKING_LINE_IDS.split(",")
              .map((id) => parseInt(id.trim(), 10))
              .filter((id) => !isNaN(id))
          : [];
        console.log("🔍 isLiveBooking check:", {
          liveBookingEnabled,
          cruiseLineId: cruise?.cruiseLineId,
          cruiseLineIdType: typeof cruise?.cruiseLineId,
          liveBookingLineIds,
          liveBookingLineIdsLength: liveBookingLineIds.length,
          includes:
            cruise?.cruiseLineId &&
            liveBookingLineIds.includes(Number(cruise.cruiseLineId)),
        });

        const isLiveBooking =
          liveBookingEnabled &&
          cruise?.cruiseLineId &&
          liveBookingLineIds.length > 0
            ? liveBookingLineIds.includes(Number(cruise.cruiseLineId))
            : false;

        // Calculate total from breakdown if available (more accurate than basket totalprice)
        // The breakdown comes from cruisecabingradebreakdown.pl which has the itemized costs
        let calculatedTotal = totalprice;
        if (breakdown.length > 0) {
          // Sum: cruise fare + taxes + fees + gratuities - discounts
          calculatedTotal = cruiseFare + taxes + fees + gratuities - discounts;
          console.log("💰 Calculated total from breakdown:", {
            cruiseFare,
            taxes,
            fees,
            gratuities,
            discounts,
            calculatedTotal,
            originalTotalprice: totalprice,
          });
        }

        // Calculate OBC per guest, then sum (commission rates may differ per guest)
        // OBC = 10% for live bookings, 8% for non-live, rounded DOWN to nearest $10 increment
        // Must account for discounts per-guest as they affect commissionable amounts
        let obcAmount = 0;
        if (breakdownSource && breakdownSource.length > 0) {
          const obcPercent = isLiveBooking ? 0.1 : 0.08;

          // Find fare items in the breakdown
          const fareItems = breakdownSource.filter(
            (item: any) => item.category?.toLowerCase() === "fare",
          );

          // Find discount items in the breakdown (BOGO, percentage discounts, etc.)
          const discountItems = breakdownSource.filter(
            (item: any) => item.category?.toLowerCase() === "discount",
          );

          // Build per-guest commissionable fares (fare + discount per guest)
          // Use a map to track fares by guest number
          const guestCommissionableFares = new Map<string, number>();

          // First, add base fares per guest
          fareItems.forEach((fareItem: any) => {
            if (fareItem.prices && Array.isArray(fareItem.prices)) {
              fareItem.prices.forEach((priceItem: any) => {
                const guestNo =
                  priceItem.guestno ||
                  String(guestCommissionableFares.size + 1);
                const guestFare = parseFloat(
                  priceItem.sprice || priceItem.price || 0,
                );
                if (guestFare > 0) {
                  guestCommissionableFares.set(
                    guestNo,
                    (guestCommissionableFares.get(guestNo) || 0) + guestFare,
                  );
                }
              });
            }
          });

          // Then, apply discounts per guest (discounts are negative amounts)
          discountItems.forEach((discountItem: any) => {
            if (discountItem.prices && Array.isArray(discountItem.prices)) {
              discountItem.prices.forEach((priceItem: any) => {
                const guestNo =
                  priceItem.guestno || String(guestCommissionableFares.size);
                const discountAmount = parseFloat(
                  priceItem.sprice || priceItem.price || 0,
                );
                // Discounts are negative, so adding them reduces the commissionable fare
                guestCommissionableFares.set(
                  guestNo,
                  (guestCommissionableFares.get(guestNo) || 0) + discountAmount,
                );
              });
            }
          });

          // Calculate OBC per guest from net commissionable fares
          const guestFares: number[] = [];
          const guestObcs: number[] = [];
          guestCommissionableFares.forEach((commissionableFare, guestNo) => {
            guestFares.push(commissionableFare);
            // Only calculate OBC if commissionable fare is positive
            if (commissionableFare > 0) {
              const guestObc =
                Math.floor((commissionableFare * obcPercent) / 10) * 10;
              guestObcs.push(guestObc);
              obcAmount += guestObc;
            } else {
              guestObcs.push(0);
            }
          });

          console.log("💳 Calculated OBC per guest (with discounts):", {
            guestFares,
            guestFare1: guestFares[0],
            guestFare2: guestFares[1],
            guestObc1: guestObcs[0],
            guestObc2: guestObcs[1],
            totalObcAmount: obcAmount,
            isLiveBooking,
            obcPercent: `${obcPercent * 100}%`,
            fareItemsCount: fareItems.length,
            discountItemsCount: discountItems.length,
            guestCount: guestFares.length,
          });
        }

        setPricingData({
          cruiseFare,
          taxes,
          fees,
          discounts,
          total: calculatedTotal,
          deposit: totaldeposit,
          currency,
          currencySymbol,
          breakdown,
          shipName,
          shipImage,
          cruiseLineName,
          cancellationPolicyUrl,
          isPriceEstimated,
          obcAmount,
          apiObcAmount, // OBC from cruise line API (displayed after Total)
          cabinName,
          cabinCode,
          roomNumber,
          deckNumber,
        });
        setIsLoading(false);
      } catch (error) {
        console.error("💥 Error fetching pricing data:", error);
        setError("Unable to load pricing information");
        setIsLoading(false);
      }
    };

    if (sessionId) {
      fetchPricingData();
    }
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pricingData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="font-geograph text-[14px] text-red-600">
          {error || "Pricing information unavailable"}
        </p>
      </div>
    );
  }

  const formatPrice = (amount: number) => {
    return `${pricingData.currencySymbol}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Ship Image at Top */}
      {pricingData.shipImage && (
        <div className="mb-4">
          <Image
            src={pricingData.shipImage}
            alt={pricingData.shipName || "Cruise ship"}
            width={400}
            height={200}
            className="rounded-lg object-cover w-full"
          />
          {pricingData.shipName && (
            <p className="font-geograph font-medium text-[14px] text-dark-blue mt-2">
              {pricingData.shipName}
            </p>
          )}
        </div>
      )}

      {/* Pricing Header */}
      <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-2">
        Pricing Summary
      </h3>

      {/* Cabin Details */}
      {(pricingData.cabinName || pricingData.cabinCode) && (
        <div className="mb-4 pb-3 border-b border-gray-200">
          {pricingData.cabinName && (
            <p className="font-geograph text-[14px] text-gray-700">
              {pricingData.cabinName}
            </p>
          )}
          <div className="flex gap-2 text-[13px] text-gray-600 font-geograph mt-1">
            {pricingData.cabinCode && (
              <span>Code: {pricingData.cabinCode}</span>
            )}
            {pricingData.roomNumber && (
              <>
                <span>•</span>
                <span>Room: {pricingData.roomNumber}</span>
              </>
            )}
            {pricingData.deckNumber && (
              <>
                <span>•</span>
                <span>Deck: {pricingData.deckNumber}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detailed Breakdown */}
      <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
        {pricingData.breakdown.map((item, index) => (
          <div key={index} className="flex justify-between items-start">
            <span
              className={`font-geograph text-[14px] ${item.isDiscount ? "text-green-600" : "text-gray-700"}`}
            >
              {item.description}
            </span>
            <span
              className={`font-geograph text-[14px] ${item.isDiscount ? "text-green-600" : "text-gray-900"}`}
            >
              {item.isDiscount && item.amount > 0 ? "-" : ""}
              {formatPrice(item.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center mb-2">
        <span className="font-geograph font-bold text-[16px] text-dark-blue">
          Total
        </span>
        <span className="font-geograph font-bold text-[18px] text-dark-blue">
          {formatPrice(pricingData.total)}
        </span>
      </div>

      {/* API OBC - Onboard credit from cruise line (displayed after Total) */}
      {(() => {
        console.log("🔍 API OBC Debug:", {
          apiObcAmount: pricingData.apiObcAmount,
          type: typeof pricingData.apiObcAmount,
          isNumber: typeof pricingData.apiObcAmount === "number",
          greaterThanZero: pricingData.apiObcAmount
            ? pricingData.apiObcAmount > 0
            : false,
          shouldShow:
            pricingData.apiObcAmount &&
            typeof pricingData.apiObcAmount === "number" &&
            pricingData.apiObcAmount > 0,
        });
        return null;
      })()}
      {pricingData.apiObcAmount &&
        typeof pricingData.apiObcAmount === "number" &&
        pricingData.apiObcAmount > 0 && (
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
            <span className="font-geograph text-[14px] text-green-600 font-normal">
              On-Board Credit
            </span>
            <span className="font-geograph text-[14px] text-green-600 font-normal">
              +{formatPrice(pricingData.apiObcAmount)}
            </span>
          </div>
        )}

      {/* OBC - Extras added after booking (only show if > 0) */}
      {pricingData.obcAmount && pricingData.obcAmount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="p-3 bg-[#D4F4DD] rounded-lg text-center">
            <div className="font-geograph font-bold text-[14px] text-[#1B8F57] mb-1">
              Extra perks on us
            </div>
            <div className="font-geograph font-normal text-[14px] text-[#1B8F57]">
              +$
              {pricingData.obcAmount.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              onboard credit
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
