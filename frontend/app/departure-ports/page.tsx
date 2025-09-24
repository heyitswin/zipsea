import {
  getCategoriesByType,
  categoryIndexPages,
} from "@/lib/cruise-categories";
import Link from "next/link";
import { Metadata } from "next";

const indexConfig = categoryIndexPages["departure-ports"];

export const metadata: Metadata = {
  title: indexConfig.metaTitle,
  description: indexConfig.metaDescription,
  openGraph: {
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
    type: "website",
    url: `https://www.zipsea.com/departure-ports`,
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
  },
  alternates: {
    canonical: `https://www.zipsea.com/departure-ports`,
  },
};

export default function DeparturePortsPage() {
  const departurePorts = getCategoriesByType("departure-ports");

  return (
    <main style={{ backgroundColor: "#F6F3ED" }}>
      {/* Hero Section */}
      <section
        className="py-[80px] md:py-[120px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[42px] md:text-[72px]"
            style={{
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "#F7F170",
            }}
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
          backgroundImage: 'url("/images/separator-2.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Departure Ports List */}
      <section className="py-[60px] md:py-[100px]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="space-y-4">
            {departurePorts.map((port) => (
              <Link
                key={port.slug}
                href={`/cruises/${port.slug}`}
                className="group block"
              >
                <div className="bg-white rounded-[10px] border border-[#E5E5E5] p-6 hover:border-[#2238C3] transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="font-whitney font-black uppercase text-[20px] text-[#0E1B4D] mb-2">
                        {port.title}
                      </h3>
                      <p className="font-geograph text-[14px] text-[#666] leading-relaxed">
                        {port.shortDescription}
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className="font-geograph font-semibold text-[#2238C3] group-hover:underline whitespace-nowrap">
                        View Cruises →
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
      <section className="py-[60px]">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-whitney font-black uppercase text-[32px] text-[#0E1B4D] mb-6 text-center">
            Choosing Your Departure Port
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Selecting the right departure port can significantly impact your
              cruise experience. Consider proximity to your home, available
              flight connections, and pre-cruise accommodation options when
              making your choice.
            </p>
            <p>
              Florida ports like Miami and Fort Lauderdale offer year-round
              Caribbean departures with excellent airport connections. Galveston
              provides convenient access for Texas and central U.S. travelers
              heading to the Western Caribbean. New York allows Northeast
              cruisers to avoid flights while accessing Bermuda, Canada, and
              transatlantic routes.
            </p>
            <p>
              Seattle serves as the primary West Coast gateway to Alaska,
              eliminating the need for international travel to Vancouver. Each
              port city also offers unique pre-cruise attractions - explore
              South Beach in Miami, visit Pike Place Market in Seattle, or see
              the Statue of Liberty when departing from New York.
            </p>
            <p>
              Consider arriving a day early to avoid travel delays and explore
              the departure city. Many ports offer convenient park-and-cruise
              packages or hotel shuttle services. With maximum onboard credit
              included in every Zipsea booking, you'll have extra funds to
              enhance your cruise experience from the moment you board.
            </p>
          </div>
        </div>
      </section>

      {/* Port Information Table */}
      <section className="py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-whitney font-black uppercase text-[28px] text-[#0E1B4D] mb-8 text-center">
            Departure Port Quick Facts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-[10px] overflow-hidden">
              <thead className="bg-[#0E1B4D]">
                <tr>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">
                    Port
                  </th>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">
                    Main Destinations
                  </th>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">
                    Airport
                  </th>
                  <th className="px-6 py-4 text-left font-geograph font-bold text-white">
                    Distance to Port
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">
                    Miami
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    Caribbean, Bahamas
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">MIA</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    8 miles
                  </td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">
                    Fort Lauderdale
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    Caribbean, Transatlantic
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">FLL</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    2 miles
                  </td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">
                    Galveston
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    Western Caribbean
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">IAH</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    70 miles
                  </td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="px-6 py-4 font-geograph font-semibold">
                    New York
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    Bermuda, Canada, Caribbean
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    JFK/LGA/EWR
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    15-35 miles
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-geograph font-semibold">
                    Seattle
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    Alaska Inside Passage
                  </td>
                  <td className="px-6 py-4 font-geograph text-[#666]">SEA</td>
                  <td className="px-6 py-4 font-geograph text-[#666]">
                    13 miles
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-4 text-center">
            Find Cruises by Departure Port:
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {departurePorts.map((port) => (
              <Link
                key={port.slug}
                href={`/cruises/${port.slug}`}
                className="inline-block px-6 py-2 bg-white border border-[#E5E5E5] rounded-full hover:bg-[#2238C3] hover:text-white transition-colors font-geograph text-[14px]"
              >
                {port.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
