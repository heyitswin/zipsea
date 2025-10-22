"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Passenger {
  firstName: string;
  lastName: string;
  email?: string;
  passengerType?: string; // 'adult' or 'child'
}

interface BookingSummaryProps {
  sessionId: string;
  passengers?: Passenger[];
  showPassengers?: boolean; // Only show on payment page (step 3)
}

interface CruiseData {
  name?: string;
  shipName?: string;
  shipImage?: string;
  departureDate?: string;
  arrivalDate?: string;
  nights?: number;
  ports?: string[];
}

interface CabinData {
  cabinType?: string;
  description?: string;
  gradeno?: string;
}

export default function BookingSummary({
  sessionId,
  passengers,
  showPassengers = false,
}: BookingSummaryProps) {
  const [cruiseData, setCruiseData] = useState<CruiseData | null>(null);
  const [cabinData, setCabinData] = useState<CabinData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBookingData = async () => {
      try {
        console.log("📊 BookingSummary: Fetching session data for:", sessionId);

        // Fetch session data which includes cruise and cabin info
        const sessionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/booking/session/${sessionId}`,
        );

        if (!sessionResponse.ok) {
          console.error(
            "❌ Failed to fetch session data:",
            sessionResponse.status,
          );
          setIsLoading(false);
          return;
        }

        const sessionData = await sessionResponse.json();
        console.log("✅ Session data received:", sessionData);

        // Fetch full cruise details using the cruiseId from session
        if (sessionData.cruiseId) {
          const cruiseResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/cruises/${sessionData.cruiseId}`,
          );

          if (cruiseResponse.ok) {
            const cruiseResponseData = await cruiseResponse.json();
            const cruise = cruiseResponseData.data || cruiseResponseData;
            console.log("🚢 Cruise data received:", cruise);

            const shipImage =
              cruise.ship?.defaultShipImageHd ||
              cruise.ship?.defaultShipImage2k ||
              cruise.ship?.defaultShipImage ||
              cruise.shipImageHd ||
              cruise.shipImage2k ||
              cruise.shipImage;

            console.log("🖼️ Ship image URL:", shipImage);
            console.log("🖼️ Available image fields:", {
              shipDefaultHd: cruise.ship?.defaultShipImageHd,
              ship2k: cruise.ship?.defaultShipImage2k,
              shipDefault: cruise.ship?.defaultShipImage,
              cruiseShipHd: cruise.shipImageHd,
              cruiseShip2k: cruise.shipImage2k,
              cruiseShipImage: cruise.shipImage,
            });

            setCruiseData({
              name: cruise.name || cruise.title || cruise.voyageName,
              shipName: cruise.shipName || cruise.ship?.name,
              shipImage,
              departureDate:
                cruise.departureDate ||
                cruise.startDate ||
                cruise.sailingDate ||
                cruise.sailingDateText,
              arrivalDate:
                cruise.arrivalDate || cruise.endDate || cruise.returnDate,
              nights: cruise.nights || cruise.duration,
              ports: Array.isArray(cruise.ports)
                ? cruise.ports.map((p: any) =>
                    typeof p === "string" ? p : p.name || p.portName || p,
                  )
                : Array.isArray(cruise.portsOfCall)
                  ? cruise.portsOfCall.map((p: any) =>
                      typeof p === "string" ? p : p.name || p.portName || p,
                    )
                  : cruise.portNames || [],
            });
          } else {
            console.error(
              "❌ Failed to fetch cruise data:",
              cruiseResponse.status,
            );
          }
        } else {
          console.warn("⚠️ No cruiseId in session data");
        }

        // Fetch basket data to get cabin information
        try {
          const basketResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/booking/${sessionId}/basket`,
          );

          if (basketResponse.ok) {
            const basketData = await basketResponse.json();
            console.log("🛏️ Basket data received:", basketData);

            // Extract cabin info from basket
            if (basketData.items && basketData.items.length > 0) {
              const cabinItem = basketData.items[0];
              setCabinData({
                cabinType: cabinItem.name || cabinItem.description,
                description: cabinItem.details || cabinItem.longDescription,
                gradeno: cabinItem.gradeNo,
              });
            }
          } else {
            console.warn(
              "⚠️ Failed to fetch basket data:",
              basketResponse.status,
            );
          }
        } catch (error) {
          console.warn("⚠️ Error fetching basket data:", error);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("💥 Error fetching booking data:", error);
        setIsLoading(false);
      }
    };

    if (sessionId) {
      fetchBookingData();
    }
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="font-geograph font-bold text-[18px] text-dark-blue mb-4">
        Booking Summary{cruiseData?.name ? ` - ${cruiseData.name}` : ""}
      </h3>

      <div className="flex gap-4">
        {/* Ship Image Thumbnail */}
        {cruiseData?.shipImage && (
          <div className="flex-shrink-0">
            <Image
              src={cruiseData.shipImage}
              alt={cruiseData.shipName || "Cruise ship"}
              width={80}
              height={80}
              className="rounded-lg object-cover"
            />
          </div>
        )}

        {/* Booking Details */}
        <div className="flex-1 space-y-3">
          {/* Ship Name */}
          {cruiseData?.shipName && (
            <div>
              <p className="font-geograph text-[12px] text-gray-600 uppercase tracking-wide mb-1">
                Ship
              </p>
              <p className="font-geograph text-[14px] text-dark-blue">
                {cruiseData.shipName}
              </p>
            </div>
          )}

          {/* Dates */}
          {cruiseData?.departureDate && cruiseData?.arrivalDate && (
            <div>
              <p className="font-geograph text-[12px] text-gray-600 uppercase tracking-wide mb-1">
                Dates
              </p>
              <p className="font-geograph text-[14px] text-dark-blue">
                {formatDate(cruiseData.departureDate)} -{" "}
                {formatDate(cruiseData.arrivalDate)}
                {cruiseData.nights && (
                  <span className="text-gray-600">
                    {" "}
                    ({cruiseData.nights} night
                    {cruiseData.nights !== 1 ? "s" : ""})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Ports of Call */}
          {cruiseData?.ports && cruiseData.ports.length > 0 && (
            <div>
              <p className="font-geograph text-[12px] text-gray-600 uppercase tracking-wide mb-1">
                Ports of Call
              </p>
              <p className="font-geograph text-[14px] text-dark-blue">
                {cruiseData.ports.join(" • ")}
              </p>
            </div>
          )}

          {/* Cabin Details */}
          {cabinData?.cabinType && (
            <div>
              <p className="font-geograph text-[12px] text-gray-600 uppercase tracking-wide mb-1">
                Cabin
              </p>
              <p className="font-geograph font-medium text-[14px] text-dark-blue">
                {cabinData.cabinType}
              </p>
              {cabinData.description && (
                <p className="font-geograph text-[13px] text-gray-600 mt-1">
                  {cabinData.description}
                </p>
              )}
            </div>
          )}

          {/* Passengers - Only show on payment page */}
          {showPassengers && passengers && passengers.length > 0 && (
            <div>
              <p className="font-geograph text-[12px] text-gray-600 uppercase tracking-wide mb-1">
                Passengers ({passengers.length})
              </p>
              <div className="space-y-2">
                {passengers.map((passenger, index) => {
                  // Count adults and children separately for proper labeling
                  const adultsBeforeThis = passengers
                    .slice(0, index)
                    .filter(
                      (p) => !p.passengerType || p.passengerType === "adult",
                    ).length;
                  const childrenBeforeThis = passengers
                    .slice(0, index)
                    .filter((p) => p.passengerType === "child").length;

                  const isChild = passenger.passengerType === "child";
                  const label = isChild
                    ? `Child ${childrenBeforeThis + 1}`
                    : `Adult ${adultsBeforeThis + 1}`;

                  return (
                    <div
                      key={index}
                      className="flex justify-between items-start"
                    >
                      <div>
                        <p className="font-geograph font-medium text-[14px] text-dark-blue">
                          {passenger.firstName} {passenger.lastName}
                        </p>
                        <p className="font-geograph text-[13px] text-gray-600">
                          {label}
                        </p>
                      </div>
                      {index === 0 && passenger.email && (
                        <p className="font-geograph text-[13px] text-gray-600">
                          {passenger.email}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
