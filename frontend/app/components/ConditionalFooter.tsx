"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  const isBookingPage = pathname?.startsWith("/booking/");

  // Hide footer on booking/checkout pages
  if (isBookingPage) {
    return null;
  }

  return <Footer />;
}
