"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CruisesContent from "./CruisesContent";

export default function CruisesPage() {
  // Don't use a dynamic key - let the component handle its own state management
  // The issue was in the state sync logic, not in component mounting

  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">Loading cruises...</div>
      }
    >
      <CruisesContent />
    </Suspense>
  );
}
