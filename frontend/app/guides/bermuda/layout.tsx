import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bermuda Cruise Port Guide 2025 | Royal Naval Dockyard, Pink Sand Beaches",
  description: "Complete Bermuda cruise port guide for 2025. Navigate Royal Naval Dockyard, visit pink sand Horseshoe Bay Beach, explore St. George's UNESCO site, Crystal Caves, transportation tips, fish sandwich spots, and insider advice for your perfect port day.",
  keywords: "Bermuda cruise port, Royal Naval Dockyard, Horseshoe Bay Beach Bermuda, pink sand beaches Bermuda, St George's Bermuda, Hamilton Bermuda cruise, Crystal Caves Bermuda, Bermuda fish sandwich, Bermuda ferry schedule, Bermuda bus routes cruise, Bermuda shore excursions, Dark n Stormy Bermuda, Bermuda with kids, Bermuda transportation pass",
  openGraph: {
    title: "Bermuda Cruise Port Guide 2025 | Complete Shore Excursion Guide",
    description: "Expert guide to Bermuda's three cruise ports. Pink sand beaches, Crystal Caves, historic St. George's, ferry tips, and the best fish sandwich spots.",
    type: "article",
    url: "https://www.zipsea.com/guides/bermuda",
    images: [
      {
        url: "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
        width: 1200,
        height: 800,
        alt: "Royal Naval Dockyard Bermuda with cruise ship and pastel buildings",
      },
    ],
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bermuda Cruise Port Guide 2025 | Zipsea",
    description: "Complete guide to Bermuda's cruise ports, pink sand beaches, Crystal Caves, transportation, and must-try fish sandwiches.",
    images: ["https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg"],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/bermuda",
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

export default function BermudaGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TravelGuide",
            "name": "Bermuda Cruise Port Guide 2025",
            "description": "Comprehensive guide to Bermuda cruise ports including Royal Naval Dockyard, beaches, caves, and transportation",
            "url": "https://www.zipsea.com/guides/bermuda",
            "author": {
              "@type": "Organization",
              "name": "Zipsea",
              "url": "https://www.zipsea.com"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Zipsea",
              "url": "https://www.zipsea.com"
            },
            "datePublished": "2025-01-01",
            "dateModified": "2025-01-29",
            "about": {
              "@type": "Place",
              "name": "Bermuda",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "BM"
              }
            },
            "mentions": [
              {
                "@type": "TouristAttraction",
                "name": "Royal Naval Dockyard",
                "description": "Main cruise port with shopping, museums, and restaurants"
              },
              {
                "@type": "TouristAttraction",
                "name": "Horseshoe Bay Beach",
                "description": "Famous pink sand beach with facilities and lifeguards"
              },
              {
                "@type": "TouristAttraction",
                "name": "Crystal & Fantasy Caves",
                "description": "Stunning underground caves with crystal-clear lakes"
              },
              {
                "@type": "TouristAttraction",
                "name": "St. George's Town",
                "description": "UNESCO World Heritage Site, oldest British settlement"
              },
              {
                "@type": "TouristAttraction",
                "name": "Hamilton",
                "description": "Capital city with shopping and dining"
              }
            ]
          }),
        }}
      />
      {children}
    </>
  );
}
