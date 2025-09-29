import { Metadata } from "next";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  name: "Cabo San Lucas Cruise Port Guide - El Arco & Pacific Beaches",
  description:
    "Complete Cabo San Lucas cruise port guide featuring El Arco, Medano Beach, sport fishing, water taxis, tequila tasting, and the best fish tacos in Mexico.",
  url: "https://www.zipsea.com/guides/cabo-san-lucas",
  author: {
    "@type": "Organization",
    name: "Zipsea",
    url: "https://www.zipsea.com",
  },
  datePublished: "2025-01-28",
  dateModified: "2025-01-28",
  mainEntity: {
    "@type": "Place",
    name: "Cabo San Lucas",
    description:
      "Resort city at the southern tip of Mexico's Baja California Peninsula where the Pacific Ocean meets the Sea of Cortez",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 22.8905,
      longitude: -109.9167,
    },
  },
  about: [
    {
      "@type": "TouristAttraction",
      name: "El Arco",
      description: "Iconic rock arch formation at Land's End",
    },
    {
      "@type": "TouristAttraction",
      name: "Medano Beach",
      description: "Main swimming beach with beach clubs and water sports",
    },
    {
      "@type": "TouristAttraction",
      name: "Lover's Beach",
      description: "Secluded beach accessible only by boat",
    },
    {
      "@type": "TouristAttraction",
      name: "Marina Cabo San Lucas",
      description: "Luxury marina with restaurants and shopping",
    },
    {
      "@type": "TouristAttraction",
      name: "Cabo Wabo",
      description: "Famous cantina with live music and tequila",
    },
  ],
};

export const metadata: Metadata = {
  title: "Cabo San Lucas Cruise Port Guide 2025: El Arco, Beaches & Fishing | Zipsea",
  description:
    "Complete Cabo San Lucas cruise guide: El Arco tours, Medano Beach, sport fishing, water taxis, snorkeling, tequila tasting. Tender port tips and transportation info.",
  keywords:
    "Cabo San Lucas cruise port, Cabo tender port, El Arco Cabo, Medano Beach, Lover's Beach Cabo, Marina Cabo San Lucas, sport fishing Cabo, Cabo water taxi, Cabo Wabo, fish tacos Cabo, Mexican Riviera cruise, Land's End Cabo, Pelican Rock snorkeling",
  openGraph: {
    title: "Cabo San Lucas Cruise Port Guide - Where Pacific Meets Sea of Cortez",
    description:
      "Explore Cabo's iconic El Arco, pristine beaches, world-class fishing, and vibrant nightlife. Complete tender port guide with tips and excursions.",
    url: "https://www.zipsea.com/guides/cabo-san-lucas",
    siteName: "Zipsea",
    images: [
      {
        url: "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
        width: 1200,
        height: 800,
        alt: "Cabo San Lucas Marina and El Arco aerial view",
      },
    ],
    locale: "en_US",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cabo San Lucas Cruise Guide - El Arco & World-Class Beaches",
    description:
      "Complete guide to Cabo tender port with El Arco tours, beach clubs, sport fishing, and authentic Mexican cuisine.",
    images: [
      "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/cabo-san-lucas",
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

export default function CaboSanLucasGuideLayout({
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
