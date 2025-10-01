"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

interface PriceSnapshot {
  snapshotDate: string;
  cabinCode: string;
  cabinType: string | null;
  basePrice: string | null;
  totalPrice: string | null;
}

interface DailyPrices {
  date: string;
  interior: number | null;
  oceanview: number | null;
  balcony: number | null;
  suite: number | null;
}

interface PriceHistoryChartProps {
  cruiseId: string;
}

export default function PriceHistoryChart({
  cruiseId,
}: PriceHistoryChartProps) {
  const [dailyPrices, setDailyPrices] = useState<DailyPrices[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

        // Fetch all price history for this cruise
        const response = await fetch(
          `${apiUrl}/price-history?cruiseId=${cruiseId}&limit=1000`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch price history");
        }

        const result = await response.json();
        const snapshots: PriceSnapshot[] = result.data?.prices || [];

        // Group by day and cabin category, finding cheapest price for each
        const dailyData: Record<string, DailyPrices> = {};

        snapshots.forEach((snapshot) => {
          const date = new Date(snapshot.snapshotDate)
            .toISOString()
            .split("T")[0];

          if (!dailyData[date]) {
            dailyData[date] = {
              date,
              interior: null,
              oceanview: null,
              balcony: null,
              suite: null,
            };
          }

          const price = parseFloat(
            snapshot.basePrice || snapshot.totalPrice || "0",
          );
          if (price <= 0) return;

          const cabinType = snapshot.cabinType?.toLowerCase() || "";

          // Map cabin types to categories
          let category: "interior" | "oceanview" | "balcony" | "suite" | null =
            null;

          if (cabinType.includes("inside") || cabinType.includes("interior")) {
            category = "interior";
          } else if (
            cabinType.includes("outside") ||
            cabinType.includes("oceanview") ||
            cabinType.includes("ocean")
          ) {
            category = "oceanview";
          } else if (cabinType.includes("balcony")) {
            category = "balcony";
          } else if (cabinType.includes("suite")) {
            category = "suite";
          }

          if (category) {
            // Keep the cheapest price for each category per day
            if (
              dailyData[date][category] === null ||
              price < dailyData[date][category]!
            ) {
              dailyData[date][category] = price;
            }
          }
        });

        // Convert to array and sort by date
        const sortedDaily = Object.values(dailyData).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        setDailyPrices(sortedDaily);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load price history",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (cruiseId) {
      fetchPriceHistory();
    }
  }, [cruiseId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading price history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="text-center py-8 text-red-600">
          <p className="font-semibold">Unable to load price history</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!dailyPrices || dailyPrices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Price History</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No price history data available yet.</p>
          <p className="text-sm mt-2">
            Price snapshots will appear here as data is collected.
          </p>
        </div>
      </div>
    );
  }

  const labels = dailyPrices.map((day) =>
    new Date(day.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );

  const datasets = [
    {
      label: "Interior",
      data: dailyPrices.map((d) => d.interior),
      borderColor: "rgb(59, 130, 246)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      tension: 0.3,
      hidden: !dailyPrices.some((d) => d.interior),
    },
    {
      label: "Oceanview",
      data: dailyPrices.map((d) => d.oceanview),
      borderColor: "rgb(16, 185, 129)",
      backgroundColor: "rgba(16, 185, 129, 0.1)",
      tension: 0.3,
      hidden: !dailyPrices.some((d) => d.oceanview),
    },
    {
      label: "Balcony",
      data: dailyPrices.map((d) => d.balcony),
      borderColor: "rgb(245, 158, 11)",
      backgroundColor: "rgba(245, 158, 11, 0.1)",
      tension: 0.3,
      hidden: !dailyPrices.some((d) => d.balcony),
    },
    {
      label: "Suite",
      data: dailyPrices.map((d) => d.suite),
      borderColor: "rgb(168, 85, 247)",
      backgroundColor: "rgba(168, 85, 247, 0.1)",
      tension: 0.3,
      hidden: !dailyPrices.some((d) => d.suite),
    },
  ].filter((dataset) => !dataset.hidden);

  const chartData = {
    labels,
    datasets,
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            family: "system-ui, -apple-system, sans-serif",
          },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: {
          size: 13,
          weight: "bold",
        },
        bodyFont: {
          size: 12,
        },
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += "$" + context.parsed.y.toLocaleString();
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          font: {
            size: 11,
          },
          callback: function (value) {
            return "$" + value.toLocaleString();
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Price History (Admin Only)
        </h2>
        <span className="text-sm text-gray-500">
          {dailyPrices.length} day{dailyPrices.length !== 1 ? "s" : ""} of data
        </span>
      </div>
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          * Prices shown are the cheapest available per cabin category, per
          person based on double occupancy. Data is collected from pricing
          snapshots.
        </p>
      </div>
    </div>
  );
}
