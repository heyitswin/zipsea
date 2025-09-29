import { Metadata } from "next";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  name: "Bonaire Cruise Port Guide - Shore Diving Capital",
  description:
    "Complete Bonaire cruise port guide featuring 86 dive sites, walkable Kralendijk, Klein Bonaire snorkeling, flamingo sanctuaries, and insider tips for Caribbean cruisers.",
  url: "https://www.zipsea.com/guides/bonaire",
  author: {
    "@type": "Organization",
    name: "Zipsea",
    url: "https://www.zipsea.com",
  },
  datePublished: "2025-01-28",
  dateModified: "2025-01-28",
  mainEntity: {
    "@type": "Place",
    name: "Bonaire",
    description:
      "Dutch Caribbean island renowned for shore diving, marine conservation, and walkable cruise port",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 12.2019,
      longitude: -68.2624,
    },
  },
  about: [
    {
      "@type": "TouristAttraction",
      name: "Klein Bonaire",
      description: "Uninhabited island with pristine snorkeling",
    },
    {
      "@type": "TouristAttraction",
      name: "Bonaire Marine Park",
      description: "86 marked shore diving sites",
    },
    {
      "@type": "TouristAttraction",
      name: "Kralendijk",
      description: "Walkable capital with Dutch colonial architecture",
    },
    {
      "@type": "TouristAttraction",
      name: "Donkey Sanctuary",
      description: "Drive-through sanctuary with hundreds of friendly donkeys",
    },
    {
      "@type": "TouristAttraction",
      name: "Washington-Slagbaai National Park",
      description: "Protected area with flamingos and wildlife",
    },
  ],
};

export const metadata: Metadata = {
  title: "Bonaire Cruise Port Guide 2025: Shore Diving & Marine Parks | Zipsea",
  description:
    "Complete Bonaire cruise guide: 86 dive sites, Klein Bonaire snorkeling, walkable Kralendijk, flamingo sanctuaries. Transportation, beaches, dining, and Nature Fee info.",
  keywords:
    "Bonaire cruise port, Kralendijk cruise terminal, Klein Bonaire snorkeling, Bonaire diving sites, shore diving Bonaire, Sorobon Beach, Donkey Sanctuary Bonaire, flamingo sanctuary, Washington-Slagbaai Park, Bonaire Nature Fee, Caribbean cruise ports, Dutch Caribbean",
  openGraph: {
    title: "Bonaire Cruise Port Guide - Shore Diving Capital of the World",
    description:
      "Explore Bonaire's 86 dive sites, walkable Kralendijk, Klein Bonaire, and flamingo sanctuaries. Complete guide with transportation, beaches, and insider tips.",
    url: "https://www.zipsea.com/guides/bonaire",
    siteName: "Zipsea",
    images: [
      {
        url: "https://images.unsplash.com/photo-1685101260406-5c7ad28ca00b?q=80&w=1374&auto=format&fit=crop",
        width: 1374,
        height: 916,
        alt: "Aerial view of Bonaire Kralendijk waterfront",
      },
    ],
    locale: "en_US",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bonaire Cruise Port Guide - Shore Diving & Marine Parks",
    description:
      "Complete guide to Bonaire's cruise port with 86 dive sites, walkable downtown, and pristine marine parks.",
    images: [
      "https://images.unsplash.com/photo-1685101260406-5c7ad28ca00b?q=80&w=1374&auto=format&fit=crop",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/bonaire",
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

export default function BonaireGuideLayout({
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
