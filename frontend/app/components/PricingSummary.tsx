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
        const currency = basketData.results?.[0]?.currency || "USD";
        const currencySymbol = basketData.results?.[0]?.currencysymbol || "$";

        // Get breakdown from basket item
        const breakdown: PriceBreakdownItem[] = [];
        let cruiseFare = 0;
        let taxes = 0;
        let fees = 0;
        let gratuities = 0;
        let discounts = 0;

        // Extract pricing from Traveltek basket item
        // Traveltek provides: fare, taxes, ncf (port fees), gratuity
        if (basketItem) {
          // Base cruise fare
          const fareAmount = parseFloat(
            basketItem.fare || basketItem.baseprice || 0,
          );
          if (fareAmount > 0) {
            breakdown.push({
              description: "Cruise Fare",
              amount: fareAmount,
              isDiscount: false,
              isTax: false,
            });
            cruiseFare = fareAmount;
          }

          // Taxes
          const taxAmount = parseFloat(basketItem.taxes || 0);
          if (taxAmount > 0) {
            breakdown.push({
              description: "Taxes & Fees",
              amount: taxAmount,
              isDiscount: false,
              isTax: true,
            });
            taxes = taxAmount;
          }

          // Port Fees / NCF (Non-Commissionable Fees)
          const ncfAmount = parseFloat(basketItem.ncf || 0);
          if (ncfAmount > 0) {
            breakdown.push({
              description: "Port Fees",
              amount: ncfAmount,
              isDiscount: false,
              isTax: true,
            });
            fees = ncfAmount;
          }

          // Gratuities
          const gratuityAmount = parseFloat(basketItem.gratuity || 0);
          if (gratuityAmount > 0) {
            breakdown.push({
              description: "Prepaid Gratuities",
              amount: gratuityAmount,
              isDiscount: false,
              isTax: false,
            });
            gratuities = gratuityAmount;
          }
        }

        // Fallback: if no breakdown, use total as cruise fare
        if (breakdown.length === 0 && totalprice > 0) {
          breakdown.push({
            description: "Cruise Fare",
            amount: totalprice,
            isDiscount: false,
            isTax: false,
          });
          cruiseFare = totalprice;
        }

        // Fetch session to get cruise line info for cancellation policy
        let shipName = basketItem?.name || undefined;
        let shipImage = basketItem?.image || undefined;
        let cruiseLineName: string | undefined;
        let cancellationPolicyUrl: string | undefined;

        try {
          const sessionResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/booking/session/${sessionId}`,
          );
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.cruiseId) {
              // Fetch cruise details to get cruise line
              const cruiseResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/cruises/${sessionData.cruiseId}`,
              );
              if (cruiseResponse.ok) {
                const cruiseData = await cruiseResponse.json();
                const cruise = cruiseData.data || cruiseData;

                shipName = cruise.shipName || cruise.ship?.name || shipName;
                shipImage =
                  cruise.ship?.defaultShipImageHd ||
                  cruise.ship?.defaultShipImage2k ||
                  cruise.shipImageHd ||
                  shipImage;

                // Fetch cruise line for cancellation policy
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

        setPricingData({
          cruiseFare,
          taxes,
          fees,
          discounts,
          total: totalprice,
          deposit: totaldeposit,
          currency,
          currencySymbol,
          breakdown,
          shipName,
          shipImage,
          cruiseLineName,
          cancellationPolicyUrl,
          isPriceEstimated,
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
    return `${pricingData.currencySymbol}${Math.abs(amount).toFixed(2)}`;
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
      <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
        Pricing Summary
      </h3>

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

      {/* Deposit Due */}
      {pricingData.deposit > 0 && pricingData.deposit < pricingData.total && (
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
          <span className="font-geograph text-[14px] text-gray-700">
            Deposit Due Today
          </span>
          <span className="font-geograph font-bold text-[16px] text-[#2f7ddd]">
            {formatPrice(pricingData.deposit)}
          </span>
        </div>
      )}

      {/* Cancellation Policy Link */}
      {pricingData.cancellationPolicyUrl && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <a
            href={pricingData.cancellationPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-geograph text-[13px] text-[#2f7ddd] hover:underline"
          >
            View {pricingData.cruiseLineName || ""} Cancellation Policy →
          </a>
        </div>
      )}
    </div>
  );
}
