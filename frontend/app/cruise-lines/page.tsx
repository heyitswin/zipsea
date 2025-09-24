import { getCategoriesByType, categoryIndexPages } from "@/lib/cruise-categories";
import Link from "next/link";
import { Metadata } from "next";

const indexConfig = categoryIndexPages["cruise-lines"];

export const metadata: Metadata = {
  title: indexConfig.metaTitle,
  description: indexConfig.metaDescription,
  openGraph: {
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
    type: "website",
    url: `https://www.zipsea.com/cruise-lines`,
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
  },
  alternates: {
    canonical: `https://www.zipsea.com/cruise-lines`,
  },
};

export default function CruiseLinesPage() {
  const cruiseLines = getCategoriesByType("cruise-lines");

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

      {/* Cruise Lines Grid */}
      <section className="py-[60px] md:py-[100px]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cruiseLines.map((line) => (
              <Link
                key={line.slug}
                href={`/cruises/${line.slug}`}
                className="group"
              >
                <div className="bg-white rounded-[18px] border-2 border-transparent hover:border-[#2238C3] transition-all duration-300 overflow-hidden">
                  {/* Cruise Line Image Placeholder */}
                  <div className="h-[200px] bg-gradient-to-br from-[#F7F170] to-[#FFE55C] relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-whitney font-black text-[#0E1B4D] text-[48px] opacity-20 uppercase">
                        {line.name.charAt(0)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-whitney font-black uppercase text-[24px] text-[#0E1B4D] mb-3">
                      {line.name}
                    </h3>
                    <p className="font-geograph text-[16px] text-[#666] leading-relaxed mb-4">
                      {line.shortDescription}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-geograph font-semibold text-[#2238C3] group-hover:underline">
                        View {line.name} Deals →
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
            Choosing the Right Cruise Line
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Each cruise line has its own personality, style, and specialties. Understanding these differences helps you
              select the perfect match for your vacation preferences and travel companions.
            </p>
            <p>
              Royal Caribbean leads in innovation with features like surf simulators, rock climbing walls, and the tallest
              slides at sea. Carnival, known as the "Fun Ships," offers a casual atmosphere perfect for families and groups.
              Norwegian Cruise Line pioneered freestyle cruising with no fixed dining times or dress codes.
            </p>
            <p>
              For a more upscale experience, Celebrity Cruises delivers modern luxury with award-winning cuisine and
              contemporary design. Princess Cruises excels in destination expertise, particularly in Alaska. MSC Cruises
              brings Mediterranean elegance to seas worldwide.
            </p>
            <p>
              Regardless of which cruise line you choose, all Zipsea bookings include maximum onboard credit. This added
              value gives you extra spending money for specialty restaurants, beverage packages, spa treatments, and shore
              excursions, enhancing your cruise experience no matter which line you sail with.
            </p>
          </div>
        </div>
      </section>

      {/* Cruise Line Comparison Table */}
      <section className="py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-whitney font-black uppercase text-[28px] text-[#0E1B4D] mb-8 text-center">
            Quick Cruise Line Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-[10px] overflow-hidden">
              <thead className="bg-[#0E1B4D]">
                <tr>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">Cruise Line</th>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">Best For</th>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">Key Features</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">Royal Caribbean</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Active families</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Innovation, activities, entertainment</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">Carnival</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Budget-conscious fun</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Casual atmosphere, value pricing</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">Norwegian</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Flexible travelers</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Freestyle cruising, no dress code</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">Celebrity</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Upscale experiences</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Modern luxury, fine dining</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">Princess</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Mature travelers</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Destination focus, enrichment</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-geograph font-semibold">MSC</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">International style</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">Mediterranean elegance, family-friendly</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-[40px] md:py-[60px] bg-[#F6F3ED]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-4 text-center">
            Browse Cruise Lines:
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {cruiseLines.map((line) => (
              <Link
                key={line.slug}
                href={`/cruises/${line.slug}`}
                className="inline-block px-6 py-2 bg-white border border-[#E5E5E5] rounded-full hover:bg-[#2238C3] hover:text-white transition-colors font-geograph text-[14px]"
              >
                {line.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
