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

      {/* Special Cruises Grid */}
      <section className="py-[60px] md:py-[100px]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            {specialCruises.map((cruise) => (
              <Link
                key={cruise.slug}
                href={`/cruises/${cruise.slug}`}
                className="group"
              >
                <div className="bg-white rounded-[18px] border-2 border-transparent hover:border-[#2238C3] transition-all duration-300 overflow-hidden">
                  {/* Special Cruise Image Placeholder */}
                  <div className="h-[200px] bg-gradient-to-br from-[#FFE55C] to-[#F7F170] relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Different icons for different special cruise types */}
                      {cruise.slug === "7-night" && (
                        <span className="font-whitney font-black text-[#0E1B4D] text-[72px] opacity-20">7</span>
                      )}
                      {cruise.slug === "3-5-nights" && (
                        <span className="font-whitney font-black text-[#0E1B4D] text-[60px] opacity-20">3-5</span>
                      )}
                      {cruise.slug === "cheap" && (
                        <span className="font-whitney font-black text-[#0E1B4D] text-[60px] opacity-20">$</span>
                      )}
                      {cruise.slug === "last-minute" && (
                        <span className="font-whitney font-black text-[#0E1B4D] text-[48px] opacity-20">60</span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-whitney font-black uppercase text-[24px] text-[#0E1B4D] mb-3">
                      {cruise.title}
                    </h3>
                    <p className="font-geograph text-[16px] text-[#666] leading-relaxed mb-4">
                      {cruise.shortDescription}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-geograph font-semibold text-[#2238C3] group-hover:underline">
                        View {cruise.name} →
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

      {/* Special Deals Highlights */}
      <section className="py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-whitney font-black uppercase text-[28px] text-[#0E1B4D] mb-8 text-center">
            Why Book Special Cruise Deals with Zipsea?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[10px] p-6 text-center">
              <div className="w-16 h-16 bg-[#F7F170] rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="font-whitney font-black text-[#0E1B4D] text-[24px]">$</span>
              </div>
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">Maximum Onboard Credit</h4>
              <p className="font-geograph text-[14px] text-[#666]">
                Every booking includes the maximum onboard credit allowed, giving you extra spending money
              </p>
            </div>
            <div className="bg-white rounded-[10px] p-6 text-center">
              <div className="w-16 h-16 bg-[#F7F170] rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="font-whitney font-black text-[#0E1B4D] text-[24px]">✓</span>
              </div>
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">Price Match Guarantee</h4>
              <p className="font-geograph text-[14px] text-[#666]">
                We match any lower price you find, ensuring you get the best deal possible
              </p>
            </div>
            <div className="bg-white rounded-[10px] p-6 text-center">
              <div className="w-16 h-16 bg-[#F7F170] rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="font-whitney font-black text-[#0E1B4D] text-[24px]">★</span>
              </div>
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">Expert Support</h4>
              <p className="font-geograph text-[14px] text-[#666]">
                Our cruise experts help you find and book the perfect cruise for your needs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-[40px] md:py-[60px] bg-[#F6F3ED]">
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
