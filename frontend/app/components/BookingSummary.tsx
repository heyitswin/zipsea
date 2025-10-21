"use client";

import { useEffect, useState } from "react";

interface BookingSummaryProps {
  sessionId: string;
}

interface CruiseData {
  name?: string;
  shipName?: string;
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

export default function BookingSummary({ sessionId }: BookingSummaryProps) {
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
            const cruise = await cruiseResponse.json();
            console.log("🚢 Cruise data received:", cruise);

            setCruiseData({
              name: cruise.name || cruise.title || cruise.voyageName,
              shipName: cruise.shipName || cruise.ship?.name,
              departureDate:
                cruise.departureDate || cruise.startDate || cruise.sailingDate,
              arrivalDate:
                cruise.arrivalDate || cruise.endDate || cruise.returnDate,
              nights: cruise.nights || cruise.duration,
              ports:
                cruise.ports || cruise.portsOfCall || cruise.portNames || [],
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

        // Set cabin data from session
        if (sessionData.selectedCabinGrade) {
          console.log("🛏️ Cabin data:", sessionData.selectedCabinGrade);
          setCabinData({
            cabinType: sessionData.selectedCabinGrade.cabinType,
            description: sessionData.selectedCabinGrade.description,
            gradeno: sessionData.selectedCabinGrade.gradeno,
          });
        } else {
          console.warn("⚠️ No selectedCabinGrade in session data");
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
        Booking Summary
      </h3>

      <div className="space-y-3">
        {/* Cruise Name */}
        {cruiseData?.name && (
          <div>
            <p className="font-geograph text-[12px] text-gray-600 uppercase tracking-wide mb-1">
              Cruise
            </p>
            <p className="font-geograph font-medium text-[16px] text-dark-blue">
              {cruiseData.name}
            </p>
          </div>
        )}

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
                  ({cruiseData.nights} night{cruiseData.nights !== 1 ? "s" : ""}
                  )
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
      </div>
    </div>
  );
}
