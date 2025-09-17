"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "../hooks/useAdmin";
import { useAlert } from "../../components/GlobalAlertProvider";
import AdminQuotes from "./AdminQuotes";
import AdminCruiseLines from "./AdminCruiseLines";

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState("quotes"); // Default to quotes

  // Check admin access
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      showAlert("You do not have permission to access this page");
      router.push("/");
    }
  }, [isAdmin, adminLoading, router, showAlert]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-10xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage quotes and monitor cruise inventory
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-8 border-b border-gray-200 -mb-px">
            <button
              onClick={() => setActiveTab("quotes")}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === "quotes"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Quote Requests
            </button>
            <button
              onClick={() => setActiveTab("cruise-lines")}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === "cruise-lines"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Cruise Lines
            </button>
            <button
              onClick={() => router.push("/admin/cruises")}
              className="py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Cruises
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-10xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "quotes" && <AdminQuotes />}
        {activeTab === "cruise-lines" && <AdminCruiseLines />}
      </div>
    </div>
  );
}
