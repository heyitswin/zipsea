"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import Navigation from "../components/Navigation";
import Link from "next/link";

interface Alert {
  id: string;
  name: string;
  searchCriteria: {
    cruiseLineId?: number[];
    departureMonth?: string[];
    regionId?: number;
  };
  maxBudget: string;
  cabinTypes: string[];
  alertEnabled: boolean;
  lastChecked: string | null;
  lastNotified: string | null;
  resultsCount: number;
  createdAt: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in?redirect_url=/alerts");
      return;
    }

    if (isLoaded && isSignedIn) {
      loadAlerts();
    }
  }, [isLoaded, isSignedIn]);

  const loadAlerts = async () => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alerts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load alerts");
      }

      const data = await response.json();
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load alerts", err);
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const toggleAlert = async (alertId: string, currentStatus: boolean) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alerts/${alertId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            alertEnabled: !currentStatus,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update alert");
      }

      // Update local state
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? { ...alert, alertEnabled: !currentStatus }
            : alert,
        ),
      );
    } catch (err) {
      console.error("Failed to toggle alert", err);
      alert("Failed to update alert");
    }
  };

  const deleteAlert = async (alertId: string, alertName: string) => {
    if (!confirm(`Are you sure you want to delete "${alertName}"?`)) {
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alerts/${alertId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete alert");
      }

      // Update local state
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (err) {
      console.error("Failed to delete alert", err);
      alert("Failed to delete alert");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 mt-16">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 py-8 mt-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Price Alerts</h1>
            <p className="text-gray-600">
              Manage your cruise price alerts and get notified when prices drop
            </p>
          </div>
          <Link
            href="/alerts/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create New Alert
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No alerts yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first price alert to get notified when cruises match
              your criteria
            </p>
            <Link
              href="/alerts/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Your First Alert
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{alert.name}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          alert.alertEnabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {alert.alertEnabled ? "Active" : "Paused"}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                      <p>
                        <span className="font-medium">Budget:</span> Up to $
                        {alert.maxBudget} per person
                      </p>
                      <p>
                        <span className="font-medium">Cabin Types:</span>{" "}
                        {alert.cabinTypes
                          .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
                          .join(", ")}
                      </p>
                      <p>
                        <span className="font-medium">Last Checked:</span>{" "}
                        {formatDate(alert.lastChecked)}
                      </p>
                      <p>
                        <span className="font-medium">Last Notified:</span>{" "}
                        {formatDate(alert.lastNotified)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/alerts/${alert.id}/matches`}
                        className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                      >
                        View Matches ({alert.resultsCount})
                      </Link>

                      <button
                        onClick={() =>
                          toggleAlert(alert.id, alert.alertEnabled)
                        }
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          alert.alertEnabled
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {alert.alertEnabled ? "Pause Alert" : "Resume Alert"}
                      </button>

                      <button
                        onClick={() => deleteAlert(alert.id, alert.name)}
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
