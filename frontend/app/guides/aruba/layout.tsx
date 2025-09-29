import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Aruba Cruise Port Guide - One Happy Island Caribbean Paradise | Zipsea",
  description:
    "Complete Aruba cruise port guide: Eagle Beach, Palm Beach, downtown Oranjestad, free streetcar, Dutch heritage, beach clubs, snorkeling, and insider tips for your perfect Caribbean port day.",
  keywords:
    "Aruba cruise port, Eagle Beach Aruba, Palm Beach Aruba, Oranjestad cruise terminal, Aruba beaches, Baby Beach, De Palm Island, Arikok National Park, Aruba streetcar, Dutch Caribbean, ABC islands, Aruba shore excursions, Keshi Yena, Pastechi, Aruba Ariba",
  openGraph: {
    title:
      "Aruba Cruise Port Guide - One Happy Island in the Caribbean",
    description:
      "Everything you need for your Aruba cruise stop: best beaches, free downtown streetcar, Dutch colonial sites, local cuisine, and money-saving tips.",
    images: [
      {
        url: "https://source.unsplash.com/PCLabewO7eE/1200x630",
        width: 1200,
        height: 630,
        alt: "Colorful streetcar in downtown Oranjestad, Aruba",
      },
    ],
    type: "article",
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aruba Cruise Port Guide - Complete Visitor Guide",
    description:
      "Plan your perfect day in Aruba with our comprehensive cruise port guide covering beaches, excursions, dining, and transportation.",
    images: [
      "https://source.unsplash.com/PCLabewO7eE/1200x630",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/aruba",
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

export default function ArubaGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
