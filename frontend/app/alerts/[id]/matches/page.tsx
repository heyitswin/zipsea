"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Navigation from "../../../components/Navigation";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "../../../../lib/utils";
import { createSlugFromCruise } from "../../../../lib/slug";

interface Cruise {
  id: string;
  name: string;
  nights: number;
  sailingDate: string;
  embarkPortName: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  cruiseLine?: {
    name: string;
  };
  ship?: {
    name: string;
    defaultShipImage?: string;
  };
}

interface AlertMatch {
  cruiseId: string;
  cabinType: string;
  price: number;
  cruise: Cruise;
}

interface Alert {
  id: string;
  name: string;
  maxBudget: string;
  cabinTypes: string[];
}

export default function AlertMatchesPage() {
  const router = useRouter();
  const params = useParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const alertId = params.id as string;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [matches, setMatches] = useState<AlertMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(`/sign-in?redirect_url=/alerts/${alertId}/matches`);
      return;
    }

    if (isLoaded && isSignedIn) {
      loadData();
    }
  }, [isLoaded, isSignedIn, alertId]);

  const loadData = async () => {
    try {
      const token = await getToken();

      // Load alert details
      const alertResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alerts/${alertId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!alertResponse.ok) {
        throw new Error("Failed to load alert");
      }

      const alertData = await alertResponse.json();
      setAlert(alertData);

      // Load matches
      const matchesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alerts/${alertId}/matches`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!matchesResponse.ok) {
        throw new Error("Failed to load matches");
      }

      const matchesData = await matchesResponse.json();
      setMatches(matchesData);
    } catch (err) {
      console.error("Failed to load data", err);
      setError("Failed to load alert matches");
    } finally {
      setLoading(false);
    }
  };

  const getCruiseDetailUrl = (cruise: Cruise) => {
    const slug = createSlugFromCruise({
      id: cruise.id,
      shipName: cruise.ship?.name || "unknown-ship",
      sailingDate: cruise.sailingDate,
    });
    return `/cruise/${slug}`;
  };

  const getLowestPrice = (cruise: Cruise) => {
    const prices = [
      cruise.interiorPrice,
      cruise.oceanviewPrice,
      cruise.balconyPrice,
      cruise.suitePrice,
    ].filter((p): p is number => p != null && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8 mt-16">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8 mt-16">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error || "Alert not found"}</p>
            <Link href="/alerts" className="text-blue-600 hover:underline">
              Back to Alerts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 py-8 mt-16">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/alerts"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            ← Back to All Alerts
          </Link>

          <h1 className="text-3xl font-bold mb-2">{alert.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Budget: Up to ${alert.maxBudget} per person</span>
            <span>•</span>
            <span>
              Cabin Types:{" "}
              {alert.cabinTypes
                .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
                .join(", ")}
            </span>
          </div>
        </div>

        {/* Matches List */}
        {matches.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No matches yet
            </h3>
            <p className="text-gray-600">
              We haven't found any cruises matching your criteria yet. Check
              back daily!
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-gray-600">
              Found {matches.length} cruise{matches.length !== 1 ? "s" : ""}{" "}
              matching your alert
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => {
                const cruise = match.cruise;
                const lowestPrice = getLowestPrice(cruise);

                return (
                  <Link
                    key={`${match.cruiseId}-${match.cabinType}`}
                    href={getCruiseDetailUrl(cruise)}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Ship Image */}
                    {cruise.ship?.defaultShipImage && (
                      <div className="relative h-48 w-full">
                        <Image
                          src={cruise.ship.defaultShipImage}
                          alt={cruise.ship.name || "Ship"}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-4">
                      <div className="text-xs text-gray-500 mb-1">
                        {cruise.cruiseLine?.name}
                      </div>
                      <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                        {cruise.name}
                      </h3>

                      <div className="space-y-1 text-sm text-gray-600 mb-3">
                        <p>{cruise.nights} Nights</p>
                        <p>
                          Departs:{" "}
                          {new Date(cruise.sailingDate).toLocaleDateString()}
                        </p>
                        <p>From: {cruise.embarkPortName}</p>
                      </div>

                      {/* Alert Match Info */}
                      <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded">
                        <div className="text-xs font-medium text-green-800">
                          Alert Match:{" "}
                          {match.cabinType.charAt(0).toUpperCase() +
                            match.cabinType.slice(1)}
                        </div>
                        <div className="text-sm font-bold text-green-900">
                          ${Math.round(match.price).toLocaleString()}
                        </div>
                      </div>

                      {/* All Prices */}
                      {lowestPrice && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500">From</div>
                          <div className="text-xl font-bold text-blue-600">
                            ${Math.round(lowestPrice).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            per person
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
