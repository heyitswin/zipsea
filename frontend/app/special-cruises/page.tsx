import { getCategoriesByType, categoryIndexPages } from "@/lib/cruise-categories";
import Link from "next/link";
import { Metadata } from "next";

const indexConfig = categoryIndexPages["special-cruises"];

export const metadata: Metadata = {
  title: indexConfig.metaTitle,
  description: indexConfig.metaDescription,
  openGraph: {
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
    type: "website",
    url: `https://www.zipsea.com/special-cruises`,
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: indexConfig.metaTitle,
    description: indexConfig.metaDescription,
  },
  alternates: {
    canonical: `https://www.zipsea.com/special-cruises`,
  },
};

export default function SpecialCruisesPage() {
  const specialCruises = getCategoriesByType("special-cruises");

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
          backgroundImage: 'url("/images/separator-2.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Special Cruises List */}
      <section className="py-[60px] md:py-[100px]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="space-y-4">
            {specialCruises.map((cruise) => (
              <Link
                key={cruise.slug}
                href={`/cruises/${cruise.slug}`}
                className="block bg-white rounded-[10px] border border-[#E5E5E5] p-6 hover:shadow-lg transition-all duration-200 hover:border-[#2238C3]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-whitney font-black uppercase text-[24px] text-[#0E1B4D] mb-2">
                      {cruise.title}
                    </h3>
                    <p className="font-geograph text-[16px] text-[#666] leading-relaxed">
                      {cruise.shortDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-6">
                    <span className="font-geograph font-semibold text-[#2238C3]">
                      View {cruise.name}
                    </span>
                    <svg className="w-5 h-5 text-[#2238C3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-[60px]">
        <div className="max-w-4xl mx-auto px-4 bg-white rounded-[10px] p-8">
          <h2 className="font-whitney font-black uppercase text-[32px] text-[#0E1B4D] mb-6 text-center">
            Find the Perfect Cruise Deal for You
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Whether you're looking for a quick weekend escape or planning ahead for the best value, our special cruise
              categories help you find exactly what you need. Each category is designed to match specific travel needs and
              budgets.
            </p>
            <p>
              <strong>7-Night Cruises</strong> offer the ideal balance for most travelers - enough time to truly relax and
              explore multiple destinations without requiring extended time off work. These week-long voyages are the industry's
              most popular length for good reason.
            </p>
            <p>
              <strong>Short Cruises (3-5 Nights)</strong> are perfect for first-time cruisers wanting to test the waters, or
              experienced cruisers needing a quick escape. These voyages typically visit the Bahamas or Mexico's Caribbean coast
              and offer excellent value.
            </p>
            <p>
              <strong>Cheap Cruises Under $500</strong> prove that amazing cruise vacations don't have to break the bank. These
              budget-friendly options include all meals, entertainment, and accommodations, plus maximum onboard credit from Zipsea.
            </p>
            <p>
              <strong>Last Minute Cruises</strong> departing within 60 days offer some of the best values in cruising. Cruise
              lines discount remaining cabins significantly, perfect for spontaneous travelers with flexible schedules.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links */
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-4 text-center">
            Browse Special Cruise Deals:
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {specialCruises.map((cruise) => (
              <Link
                key={cruise.slug}
                href={`/cruises/${cruise.slug}`}
                className="inline-block px-6 py-2 bg-white border border-[#E5E5E5] rounded-full hover:bg-[#2238C3] hover:text-white transition-colors font-geograph text-[14px]"
              >
                {cruise.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
