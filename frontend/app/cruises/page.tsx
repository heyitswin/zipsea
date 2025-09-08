"use client";

import { Suspense } from "react";
import CruisesContent from "./CruisesContent";

export default function CruisesPage() {
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
