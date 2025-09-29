import { Metadata } from "next";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  name: "Bridgetown Barbados Cruise Port Guide - UNESCO Heritage & Beaches",
  description:
    "Complete Bridgetown cruise port guide featuring UNESCO World Heritage sites, Carlisle Bay sea turtle swimming, Harrison's Cave, rum tours, and authentic Bajan cuisine.",
  url: "https://www.zipsea.com/guides/bridgetown",
  author: {
    "@type": "Organization",
    name: "Zipsea",
    url: "https://www.zipsea.com",
  },
  datePublished: "2025-01-28",
  dateModified: "2025-01-28",
  mainEntity: {
    "@type": "Place",
    name: "Bridgetown, Barbados",
    description:
      "UNESCO World Heritage capital of Barbados with pristine beaches and rich rum heritage",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 13.0969,
      longitude: -59.6145,
    },
  },
  about: [
    {
      "@type": "TouristAttraction",
      name: "Carlisle Bay",
      description: "Marine park with shipwrecks and sea turtle swimming",
    },
    {
      "@type": "TouristAttraction",
      name: "Harrison's Cave",
      description: "Underground stalactite caverns with tram tours",
    },
    {
      "@type": "TouristAttraction",
      name: "Parliament Buildings",
      description: "Gothic architecture with iconic clock tower",
    },
    {
      "@type": "TouristAttraction",
      name: "Mount Gay Rum Distillery",
      description: "Birthplace of rum with tours and tastings",
    },
    {
      "@type": "TouristAttraction",
      name: "Oistins Fish Fry",
      description: "Weekend market with grilled fish and local culture",
    },
  ],
};

export const metadata: Metadata = {
  title: "Bridgetown Barbados Cruise Port Guide 2025: Beaches & UNESCO Sites | Zipsea",
  description:
    "Complete Bridgetown cruise guide: UNESCO heritage sites, Carlisle Bay turtles, Harrison's Cave, beaches, rum tours. Transportation, Bajan cuisine, and insider tips.",
  keywords:
    "Bridgetown cruise port, Barbados cruise terminal, Carlisle Bay sea turtles, Harrison's Cave, Mount Gay Rum, Flying Fish and Cou Cou, Oistins Fish Fry, Accra Beach, UNESCO World Heritage Bridgetown, Atlantis Submarine Barbados, Deep Water Harbour, Caribbean cruise ports",
  openGraph: {
    title: "Bridgetown Barbados Cruise Port Guide - UNESCO Heritage & Sea Turtles",
    description:
      "Explore Bridgetown's UNESCO sites, swim with sea turtles in Carlisle Bay, tour Harrison's Cave, and taste authentic Bajan cuisine. Complete cruise port guide.",
    url: "https://www.zipsea.com/guides/bridgetown",
    siteName: "Zipsea",
    images: [
      {
        url: "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
        width: 1200,
        height: 800,
        alt: "Aerial view of Bridgetown Cruise Port Barbados",
      },
    ],
    locale: "en_US",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bridgetown Barbados Cruise Guide - Beaches & UNESCO Heritage",
    description:
      "Complete guide to Bridgetown cruise port with sea turtle swimming, rum tours, and pristine beaches.",
    images: [
      "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/bridgetown",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function BridgetownGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
