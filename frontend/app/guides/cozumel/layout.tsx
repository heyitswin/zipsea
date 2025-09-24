import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Cozumel Cruise Port Guide - Mexico's Premier Snorkeling Destination | Zipsea",
  description:
    "Cozumel cruise port guide: top snorkeling spots, beach clubs, Mayan ruins, transport. Plan your perfect Caribbean port day.",
  keywords:
    "Cozumel cruise port, Cozumel snorkeling, Palancar Reef, Cozumel beach clubs, Paradise Beach Cozumel, Mr. Sancho's, Nachi Cocom, San Gervasio ruins, Cozumel taxis, Cozumel shore excursions",
  openGraph: {
    title:
      "Cozumel Cruise Port Guide - Mexico's Premier Snorkeling Destination",
    description:
      "Everything you need to know for your Cozumel cruise stop: snorkeling, beaches, ruins, dining, and insider tips.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=2000&q=80",
        width: 1200,
        height: 630,
        alt: "Cozumel crystal clear turquoise waters",
      },
    ],
    type: "article",
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cozumel Cruise Port Guide - Complete Visitor Guide",
    description:
      "Plan your perfect day in Cozumel with our comprehensive cruise port guide.",
    images: [
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=2000&q=80",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/cozumel",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function CozumelGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
