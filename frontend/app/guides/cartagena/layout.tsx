import { Metadata } from "next";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  name: "Cartagena Colombia Cruise Port Guide - Colonial Charm & Caribbean Vibes",
  description:
    "Complete Cartagena cruise port guide featuring the UNESCO Old City, Castillo San Felipe, colorful colonial streets, Rosario Islands, emerald shopping, and authentic Colombian cuisine.",
  url: "https://www.zipsea.com/guides/cartagena",
  author: {
    "@type": "Organization",
    name: "Zipsea",
    url: "https://www.zipsea.com",
  },
  datePublished: "2025-01-28",
  dateModified: "2025-01-28",
  mainEntity: {
    "@type": "Place",
    name: "Cartagena, Colombia",
    description:
      "Historic Caribbean port city with Spanish colonial architecture and vibrant culture",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 10.3910,
      longitude: -75.4794,
    },
  },
  about: [
    {
      "@type": "TouristAttraction",
      name: "Ciudad Amurallada",
      description: "UNESCO World Heritage walled Old City",
    },
    {
      "@type": "TouristAttraction",
      name: "Castillo San Felipe",
      description: "Largest Spanish fortress in the Americas",
    },
    {
      "@type": "TouristAttraction",
      name: "Las Bóvedas",
      description: "Former dungeons now housing artisan shops",
    },
    {
      "@type": "TouristAttraction",
      name: "Rosario Islands",
      description: "Pristine archipelago for beach day trips",
    },
    {
      "@type": "TouristAttraction",
      name: "Getsemaní",
      description: "Vibrant neighborhood with street art",
    },
  ],
};

export const metadata: Metadata = {
  title: "Cartagena Colombia Cruise Port Guide 2025: Old City & Fortresses | Zipsea",
  description:
    "Complete Cartagena cruise guide: UNESCO Old City walking tours, Castillo San Felipe, beaches, emerald shopping, mud volcanoes. Terminal info and Colombian cuisine tips.",
  keywords:
    "Cartagena cruise port, Colombia cruise terminal, Ciudad Amurallada, Castillo San Felipe, Las Bóvedas, Rosario Islands, Playa Blanca, Torre del Reloj, Getsemaní street art, Colombian emeralds, arepas de huevo, ceviche Cartagenero, Caribbean cruise ports, Sociedad Portuaria terminal",
  openGraph: {
    title: "Cartagena Colombia Cruise Port Guide - Colonial Charm Meets Caribbean",
    description:
      "Explore Cartagena's colorful Old City, massive fortresses, pristine beaches, and vibrant culture. Complete cruise port guide with excursions and tips.",
    url: "https://www.zipsea.com/guides/cartagena",
    siteName: "Zipsea",
    images: [
      {
        url: "https://images.pexels.com/photos/5321464/pexels-photo-5321464.jpeg",
        width: 1200,
        height: 800,
        alt: "Aerial view of Cartagena Colombia Old City walls",
      },
    ],
    locale: "en_US",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cartagena Colombia Cruise Guide - UNESCO Heritage & Beaches",
    description:
      "Complete guide to Cartagena cruise port with Old City tours, fortress visits, beach excursions, and Colombian cuisine.",
    images: [
      "https://images.pexels.com/photos/5321464/pexels-photo-5321464.jpeg",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/cartagena",
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

export default function CartagenaGuideLayout({
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
