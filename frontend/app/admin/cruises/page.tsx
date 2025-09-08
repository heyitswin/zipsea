"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Force dynamic rendering to prevent build-time errors
export const runtime = "nodejs";

// Dynamically import the component that uses Clerk hooks
const AdminCruisesWithAuth = dynamic(() => import("./AdminCruisesContent"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function AdminCruises() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminCruisesWithAuth />
    </Suspense>
  );
}
