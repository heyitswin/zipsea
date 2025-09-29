import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Aruba Cruise Port Guide 2025 | Complete Shore Excursion & Beach Guide",
  description:
    "The ultimate Aruba cruise port guide for 2025. Discover the best beaches (Eagle Beach, Baby Beach), free activities in Oranjestad, local cuisine, family attractions, and insider tips for your perfect port day in One Happy Island.",
  keywords:
    "Aruba cruise port, Oranjestad cruise terminal, Eagle Beach Aruba, Baby Beach Aruba, Palm Beach Aruba, Aruba shore excursions, Aruba port guide, things to do in Aruba cruise, Arikok National Park, De Palm Island, Aruba with kids, Aruba beaches, Aruba restaurants cruise port, free streetcar Aruba, Aruba cruise tips",
  openGraph: {
    title:
      "Aruba Cruise Port Guide 2025 | Complete Shore Excursion & Beach Guide",
    description:
      "Discover everything you need for your Aruba port day: walkable downtown Oranjestad, world-famous beaches, family activities, local cuisine, and insider money-saving tips.",
    type: "article",
    url: "https://www.zipsea.com/guides/aruba",
    images: [
      {
        url: "https://images.unsplash.com/photo-1585061016539-ed9b2bd5f29e?q=80&w=1374&auto=format&fit=crop",
        width: 1374,
        height: 916,
        alt: "Colorful buildings in downtown Oranjestad, Aruba with Caribbean waters",
      },
    ],
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aruba Cruise Port Guide 2025 | Zipsea",
    description:
      "Your complete guide to Aruba's cruise port. Best beaches, free activities, local food, and insider tips for the perfect Caribbean port day.",
    images: [
      "https://images.unsplash.com/photo-1585061016539-ed9b2bd5f29e?q=80&w=1374&auto=format&fit=crop",
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
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function ArubaGuideLayout({
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
            name: "Aruba Cruise Port Guide 2025",
            description:
              "Complete guide to Aruba's cruise port including beaches, excursions, dining, and transportation",
            url: "https://www.zipsea.com/guides/aruba",
            author: {
              "@type": "Organization",
              name: "Zipsea",
              url: "https://www.zipsea.com",
            },
            publisher: {
              "@type": "Organization",
              name: "Zipsea",
              url: "https://www.zipsea.com",
            },
            datePublished: "2025-01-01",
            dateModified: "2025-01-29",
            about: {
              "@type": "Place",
              name: "Aruba",
              address: {
                "@type": "PostalAddress",
                addressCountry: "AW",
                addressLocality: "Oranjestad",
              },
            },
            mentions: [
              {
                "@type": "TouristAttraction",
                name: "Eagle Beach",
                description:
                  "One of the world's best beaches with powdery white sand",
              },
              {
                "@type": "TouristAttraction",
                name: "Baby Beach",
                description:
                  "Shallow lagoon perfect for families and snorkeling",
              },
              {
                "@type": "TouristAttraction",
                name: "Arikok National Park",
                description:
                  "Rugged landscapes, ancient caves, and natural pools",
              },
              {
                "@type": "TouristAttraction",
                name: "Downtown Oranjestad",
                description:
                  "Walkable city center with Dutch colonial architecture",
              },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
