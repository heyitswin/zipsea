import { getCategoriesByType, categoryIndexPages } from "@/lib/cruise-categories";
import Link from "next/link";
import { Metadata } from "next";

const indexConfig = categoryIndexPages["top-destinations"];

export const metadata: Metadata = {
  title: indexConfig.metaTitle,
  description: indexConfig.metaDescription,
  openGraph: {
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
    type: "website",
    url: `https://www.zipsea.com/top-destinations`,
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
  },
  alternates: {
    canonical: `https://www.zipsea.com/top-destinations`,
  },
};

export default function TopDestinationsPage() {
  const destinations = getCategoriesByType("destinations");

  return (
    <main>
      {/* Hero Section */}
      <section
        className="py-[80px] md:py-[120px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[42px] md:text-[72px]"
            style={{ letterSpacing: "-0.02em", lineHeight: 1, color: "#F7F170" }}
          >
            {indexConfig.h1}
          </h1>
          <h2 className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            {indexConfig.description}
          </h2>
        </div>
      </section>

      {/* Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-5.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Destinations Grid */}
      <section className="py-[60px] md:py-[100px]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {destinations.map((destination) => (
              <Link
                key={destination.slug}
                href={`/cruises/${destination.slug}`}
                className="group"
              >
                <div className="bg-white rounded-[18px] border-2 border-transparent hover:border-[#2238C3] transition-all duration-300 overflow-hidden">
                  {/* Destination Image Placeholder */}
                  <div className="h-[200px] bg-gradient-to-br from-[#2238C3] to-[#5A4BDB] relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-whitney font-black text-white text-[48px] opacity-20 uppercase">
                        {destination.name.charAt(0)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-whitney font-black uppercase text-[24px] text-[#0E1B4D] mb-3">
                      {destination.title}
                    </h3>
                    <p className="font-geograph text-[16px] text-[#666] leading-relaxed mb-4">
                      {destination.shortDescription}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-geograph font-semibold text-[#2238C3] group-hover:underline">
                        View {destination.name} Cruises →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-[60px] bg-[#F6F3ED]">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-whitney font-black uppercase text-[32px] text-[#0E1B4D] mb-6 text-center">
            Why Choose Your Cruise by Destination?
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Selecting your cruise by destination ensures you experience exactly what you're looking for in your vacation.
              Each region offers unique attractions, climates, and cultural experiences that shape your entire journey.
            </p>
            <p>
              Caribbean cruises provide year-round sunshine, pristine beaches, and vibrant island cultures. Alaska cruises
              showcase glaciers, wildlife, and dramatic landscapes. Mediterranean voyages combine history, cuisine, and
              stunning coastal scenery.
            </p>
            <p>
              Consider factors like travel time to ports, seasonal weather patterns, and the types of activities you enjoy.
              Beach lovers gravitate toward the Caribbean and Bahamas, while history enthusiasts prefer Mediterranean and
              European itineraries. Alaska attracts nature lovers and adventure seekers.
            </p>
            <p>
              All our cruise bookings include maximum onboard credit, giving you extra spending money for shore excursions,
              specialty dining, spa treatments, and more. This added value enhances your destination experience, allowing you
              to fully explore each port of call.
            </p>
          </div>
        </div>
      </section>

      {/* Popular Destinations Quick Links */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-4 text-center">
            Quick Links to Popular Destinations:
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {destinations.map((destination) => (
              <Link
                key={destination.slug}
                href={`/cruises/${destination.slug}`}
                className="inline-block px-6 py-2 bg-white border border-[#E5E5E5] rounded-full hover:bg-[#2238C3] hover:text-white transition-colors font-geograph text-[14px]"
              >
                {destination.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
