import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Barcelona Cruise Port Guide 2025 | Sagrada Familia, Park Güell & Las Ramblas",
  description: "Complete Barcelona cruise port guide for 2025. Navigate terminals, visit Gaudí masterpieces (Sagrada Familia, Park Güell), explore Gothic Quarter, enjoy tapas tours, and get insider tips for your perfect Mediterranean port day.",
  keywords: "Barcelona cruise port, Barcelona cruise terminal, Sagrada Familia from cruise port, Park Güell tickets, Las Ramblas Barcelona, La Boqueria market, Gothic Quarter Barcelona, Barcelona cruise excursions, Adossat Quay terminals, World Trade Centre terminals, Barcelona port transportation, cruise bus Barcelona, Gaudí architecture tour, Barcelona with kids, tapas tours Barcelona",
  openGraph: {
    title: "Barcelona Cruise Port Guide 2025 | Complete Shore Excursion Guide",
    description: "Expert guide to Barcelona's cruise port. Gaudí architecture, Gothic Quarter walks, family attractions, tapas tours, and money-saving transportation tips.",
    type: "article",
    url: "https://www.zipsea.com/guides/barcelona",
    images: [
      {
        url: "https://images.pexels.com/photos/18602897/pexels-photo-18602897.jpeg",
        width: 1200,
        height: 800,
        alt: "Sagrada Familia Barcelona with intricate facades against blue sky",
      },
    ],
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Cruise Port Guide 2025 | Zipsea",
    description: "Complete guide to Barcelona's cruise terminals, Gaudí sites, Gothic Quarter, tapas tours, and insider tips for your Mediterranean cruise stop.",
    images: ["https://images.pexels.com/photos/18602897/pexels-photo-18602897.jpeg"],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/barcelona",
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

export default function BarcelonaGuideLayout({
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
            "name": "Barcelona Cruise Port Guide 2025",
            "description": "Comprehensive guide to Barcelona cruise port including Gaudí architecture, Gothic Quarter, transportation, and dining",
            "url": "https://www.zipsea.com/guides/barcelona",
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
              "name": "Barcelona",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "ES",
                "addressLocality": "Barcelona",
                "addressRegion": "Catalonia"
              }
            },
            "mentions": [
              {
                "@type": "TouristAttraction",
                "name": "Sagrada Familia",
                "description": "Gaudí's iconic basilica under construction for over a century"
              },
              {
                "@type": "TouristAttraction",
                "name": "Park Güell",
                "description": "Colorful mosaic park with panoramic city views"
              },
              {
                "@type": "TouristAttraction",
                "name": "Las Ramblas",
                "description": "Famous pedestrian promenade through the city center"
              },
              {
                "@type": "TouristAttraction",
                "name": "Gothic Quarter",
                "description": "Medieval neighborhood with narrow winding streets"
              },
              {
                "@type": "TouristAttraction",
                "name": "La Boqueria Market",
                "description": "Historic food market on Las Ramblas"
              }
            ]
          }),
        }}
      />
      {children}
    </>
  );
}
