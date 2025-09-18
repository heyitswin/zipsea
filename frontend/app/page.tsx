"use client";

import Image from "next/image";
import OptimizedImage from "../lib/OptimizedImage";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchShips,
  Ship,
  searchCruises,
  Cruise,
  fetchLastMinuteDeals,
  LastMinuteDeals,
  fetchAvailableSailingDates,
  AvailableSailingDate,
  normalizeCruiseData,
} from "../lib/api";
import { createSlugFromCruise } from "../lib/slug";
import { useAlert } from "../components/GlobalAlertProvider";
import Navigation from "./components/Navigation";
import SearchResultsModal from "./components/SearchResultsModal";
import { trackSearch, trackEngagement } from "../lib/analytics";

interface FilterOption {
  id: number;
  name: string;
  count?: number;
}

// Separate component to handle URL params (needs to be wrapped in Suspense)
function HomeWithParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();

  // Last minute deals states
  const [lastMinuteDeals, setLastMinuteDeals] = useState<LastMinuteDeals[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);

  // Handle post-authentication redirects
  useEffect(() => {
    if (typeof window !== "undefined") {
      const redirectUrl = sessionStorage.getItem("redirectAfterSignIn");
      const hasPendingQuote = sessionStorage.getItem("pendingQuote");

      if (
        redirectUrl &&
        redirectUrl !== "/" &&
        redirectUrl !== window.location.pathname
      ) {
        // Clear the redirect URL and navigate to the stored path
        sessionStorage.removeItem("redirectAfterSignIn");
        // Add a small delay to ensure the redirect works properly
        setTimeout(() => {
          router.replace(redirectUrl);
        }, 100);
        return;
      }

      // If we're on the homepage but have a pending quote, it means we came back from auth
      // but the redirect URL was the homepage, so we should stay here
      if (hasPendingQuote && window.location.pathname === "/") {
        console.log("User returned to homepage after auth with pending quote");
        // The quote processing will be handled by the QuoteModalNative component
        // if they open a quote modal again
      }
    }
  }, [router]);

  // Load last minute deals on component mount
  useEffect(() => {
    const loadLastMinuteDeals = async () => {
      setIsLoadingDeals(true);
      try {
        const deals = await fetchLastMinuteDeals();
        setLastMinuteDeals(deals);
      } catch (err) {
        console.error("Failed to load last minute deals:", err);
        showAlert("Failed to load last minute deals. Please try again later.");
        setLastMinuteDeals([]);
      } finally {
        setIsLoadingDeals(false);
      }
    };

    loadLastMinuteDeals();
  }, []);

  // Handle cruise card clicks for last minute deals
  const handleCruiseClick = (cruise: Cruise) => {
    try {
      const slug = createSlugFromCruise(cruise);
      // Track the engagement
      trackEngagement("cruise_card_click", {
        label: cruise.name || `Cruise ${cruise.id}`,
        cruiseId: cruise.id,
        cruiseLine: cruise.cruiseLine?.name || "Unknown",
        ship: cruise.ship?.name || "Unknown",
        from: "last_minute_deals",
      });
      router.push(`/cruise/${slug}`);
    } catch (error) {
      console.error("Error navigating to cruise:", error);
      showAlert(
        "Sorry, we couldn't open this cruise. Please try again or search for it manually.",
      );
    }
  };

  const handleSearchClick = () => {
    router.push("/search");
  };

  return (
    <>
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-[#0E1B4D] overflow-hidden h-[720px] md:h-[720px]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E1B4D]/70 via-[#0E1B4D]/50 to-[#0E1B4D]/70 z-[5]" />
          <div className="absolute inset-0">
            <OptimizedImage
              src="/images/homepage-hero.webp"
              alt="Cruise ship on ocean"
              fill
              priority
              quality={85}
              sizes="100vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-[calc(720px-100px)] px-4 -mt-[80px]">
          {/* Main Heading - Responsive */}
          <h1 className="text-sunshine text-[48px] md:text-[72px] font-whitney uppercase text-center leading-none tracking-tight mb-6 md:mb-10">
            The smartest way to cruise
          </h1>

          {/* Subheading - Responsive */}
          <p
            className="text-white text-[18px] md:text-[18px] font-medium font-geograph tracking-tight text-center w-full max-w-[900px] mb-8 md:mb-12"
            style={{ lineHeight: "1.75" }}
          >
            More value. Zero hassle. All for you.
          </p>

          {/* CTA Button */}
          <button
            onClick={handleSearchClick}
            className="bg-sunshine hover:bg-sunshine/90 text-dark-blue px-8 py-4 rounded-full text-[20px] font-geograph font-medium tracking-tight transition-all duration-200 flex items-center gap-2"
            style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
          >
            <Image
              src="/images/search-icon.svg"
              alt=""
              width={20}
              height={20}
            />
            Find my cruise
          </button>

          {/* Trust Indicators */}
          <div className="mt-[100px] flex flex-col items-center gap-3">
            <p className="text-white text-[10px] font-geograph font-bold uppercase tracking-[0.1em]">
              TRUSTED BY HUNDREDS OF CRUISERS
            </p>
            <div className="flex items-center gap-[6px]">
              {[...Array(5)].map((_, i) => (
                <Image
                  key={i}
                  src="/images/small-star.svg"
                  alt=""
                  width={16}
                  height={16}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section Separator */}
      <div
        className="h-[4px] md:h-[6px] bg-contain"
        style={{
          backgroundImage: 'url("/images/separator-7.png")',
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
        }}
      />

      {/* Why Zipsea Section */}
      <section className="bg-white py-[80px] md:py-[120px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption */}
          <p className="text-center text-[#2238C3] text-[10px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
            WHY BOOK WITH ZIPSEA?
          </p>

          {/* Headline */}
          <h2 className="text-center text-[#0E1B4D] text-[36px] md:text-[52px] font-whitney uppercase leading-none tracking-[-0.02em] mb-8">
            Same Ship. Same Price.
            <br />
            More to spend onboard
          </h2>

          {/* Body Copy */}
          <div className="max-w-[700px] mx-auto mb-12">
            <p className="text-[#0E1B4D] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em] text-center">
              Most cruisers don't realize this: When you book directly with a
              cruise line, you're paying the standard fare… and that's it. No
              extras.
            </p>
          </div>

          {/* Why Zipsea Image */}
          <div className="flex justify-center mb-12">
            <Image
              src="/images/why-zipsea.png"
              alt="Why Zipsea"
              width={550}
              height={400}
              className="max-w-full h-auto"
            />
          </div>

          {/* More Body Copy */}
          <div className="max-w-[700px] mx-auto mb-16">
            <p className="text-[#0E1B4D] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em] text-center">
              But here's the inside scoop: cruise lines offer agencies
              incentives to sell their sailings. Some agencies keep those perks.
              <br />
              At Zipsea, we pass them straight to you.
            </p>
          </div>

          {/* Section Headline */}
          <h3 className="text-center text-[#0E1B4D] text-[28px] md:text-[32px] font-whitney uppercase leading-none tracking-[-0.02em] mb-8">
            More Onboard Credit,
            <br />
            Unlimited Possibilities
          </h3>

          {/* OBC Options Image */}
          <div className="flex justify-center">
            <Image
              src="/images/obc-options.png"
              alt="Onboard Credit Options"
              width={620}
              height={400}
              className="max-w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Why Zipsea Section Separator */}
      <div
        className="h-[4px] md:h-[6px] bg-contain"
        style={{
          backgroundImage: 'url("/images/separator-8.png")',
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
        }}
      />

      {/* How It Works Section */}
      <section className="bg-[#0E1B4D] py-[80px] md:py-[120px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption */}
          <p className="text-center text-white text-[10px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
            HOW IT WORKS
          </p>

          {/* Headline */}
          <h2 className="text-center text-[#E9B4EB] text-[36px] md:text-[52px] font-whitney uppercase leading-none tracking-[-0.02em] mb-16">
            Booking with
            <br />
            zipsea is simple
          </h2>

          {/* Step Cards */}
          <div className="space-y-8 max-w-[880px] mx-auto">
            {/* Step 1 */}
            <div className="flex rounded-[10px] overflow-hidden">
              <div className="bg-white rounded-tl-[10px] rounded-bl-[10px] p-[40px] md:p-[54px] flex-1 min-w-0 md:min-w-[440px]">
                <p className="text-[#2238C3] text-[14px] font-geograph uppercase tracking-[0.1em] mb-2">
                  STEP 1
                </p>
                <h3 className="text-[#0E1B4D] text-[28px] md:text-[32px] font-whitney uppercase tracking-[-0.02em] mb-4">
                  Browse cruises
                </h3>
                <p className="text-[#2F2F2F] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em]">
                  See live sailings, cabin types with starting prices, and an
                  estimate of how much onboard credit you'll earn. Prices based
                  on double occupancy and subject to change.
                </p>
              </div>
              <div className="hidden md:block">
                <Image
                  src="/images/step-1.png"
                  alt="Step 1"
                  width={440}
                  height={300}
                  className="h-full object-cover rounded-tr-[10px] rounded-br-[10px]"
                />
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex rounded-[10px] overflow-hidden">
              <div className="bg-white rounded-tl-[10px] rounded-bl-[10px] p-[40px] md:p-[54px] flex-1 min-w-0 md:min-w-[440px]">
                <p className="text-[#2238C3] text-[14px] font-geograph uppercase tracking-[0.1em] mb-2">
                  STEP 2
                </p>
                <h3 className="text-[#0E1B4D] text-[28px] md:text-[32px] font-whitney uppercase tracking-[-0.02em] mb-4">
                  Request a quote
                </h3>
                <p className="text-[#2F2F2F] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em]">
                  A Zipsea advisor takes your unique booking requirements and
                  gets you a quote directly from the cruise line with our added
                  onboard credit on top.
                </p>
              </div>
              <div className="hidden md:block">
                <Image
                  src="/images/step-2.png"
                  alt="Step 2"
                  width={440}
                  height={300}
                  className="h-full object-cover rounded-tr-[10px] rounded-br-[10px]"
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex rounded-[10px] overflow-hidden">
              <div className="bg-white rounded-tl-[10px] rounded-bl-[10px] p-[40px] md:p-[54px] flex-1 min-w-0 md:min-w-[440px]">
                <p className="text-[#2238C3] text-[14px] font-geograph uppercase tracking-[0.1em] mb-2">
                  STEP 3
                </p>
                <h3 className="text-[#0E1B4D] text-[28px] md:text-[32px] font-whitney uppercase tracking-[-0.02em] mb-4">
                  Book with us
                </h3>
                <p className="text-[#2F2F2F] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em]">
                  If you like what you see, we'll handle the booking for you at
                  the exact same price as the cruise line — except you'll get
                  hundreds more in onboard credit.
                </p>
              </div>
              <div className="hidden md:block">
                <Image
                  src="/images/step-3.png"
                  alt="Step 3"
                  width={440}
                  height={300}
                  className="h-full object-cover rounded-tr-[10px] rounded-br-[10px]"
                />
              </div>
            </div>
          </div>

          {/* Everything Else Section */}
          <div className="max-w-[880px] mx-auto mt-16">
            <h3 className="text-white text-[28px] md:text-[32px] font-whitney uppercase tracking-[-0.02em] mb-6">
              Everything else works the same
            </h3>
            <p className="text-[#E9B4EB] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em]">
              Your deposit, payment windows, and final balance all follow the
              cruise line's rules. You can manage your reservation directly with
              the line, or let Zipsea help along the way.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section Separator */}
      <div
        className="h-[4px] md:h-[6px] bg-contain"
        style={{
          backgroundImage: 'url("/images/separator-9.png")',
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
        }}
      />

      {/* Best of Both Worlds Section */}
      <section className="bg-white py-[80px] md:py-[120px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption */}
          <p className="text-center text-[#2238C3] text-[10px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
            THE BEST OF BOTH WORLDS
          </p>

          {/* Headline */}
          <h2 className="text-center text-[#0E1B4D] text-[36px] md:text-[52px] font-whitney uppercase leading-none tracking-[-0.02em] mb-8">
            Part tech
            <br />
            part travel experts
          </h2>

          {/* Body Copy */}
          <div className="max-w-[700px] mx-auto mb-16">
            <p className="text-[#0E1B4D] text-[18px] md:text-[20px] font-geograph leading-[1.5] tracking-[-0.02em] text-center">
              All the convenience of booking online, plus the hidden perks only
              agencies can unlock — and we pass them straight to you.
            </p>
          </div>

          {/* Logo Section */}
          <div className="flex items-center justify-center gap-8 mb-[150px]">
            <div className="text-center">
              <Image
                src="/images/royal.png"
                alt="Royal Caribbean"
                width={140}
                height={60}
                className="mb-2"
              />
              <p className="text-[#2F2F2F] text-[12px] font-geograph uppercase tracking-[0.1em]">
                LICENSED HOST AGENCY
              </p>
            </div>
            <Image src="/images/small-star.svg" alt="" width={16} height={16} />
            <div className="text-center">
              <Image
                src="/images/carnival.png"
                alt="Carnival"
                width={155}
                height={60}
                className="mb-2"
              />
              <p className="text-[#2F2F2F] text-[12px] font-geograph uppercase tracking-[0.1em]">
                LICENSED HOST AGENCY
              </p>
            </div>
            <Image src="/images/small-star.svg" alt="" width={16} height={16} />
            <div className="text-center">
              <Image
                src="/images/norwegian.png"
                alt="Norwegian"
                width={180}
                height={60}
                className="mb-2"
              />
              <p className="text-[#2F2F2F] text-[12px] font-geograph uppercase tracking-[0.1em]">
                LICENSED HOST AGENCY
              </p>
            </div>
          </div>

          {/* Logo Strip Marquee */}
          <div className="overflow-hidden -mx-8">
            <div className="flex animate-marquee">
              <Image
                src="/images/logos-strip.png"
                alt=""
                width={4755}
                height={60}
                className="mr-0"
              />
              <Image
                src="/images/logos-strip.png"
                alt=""
                width={4755}
                height={60}
                className="mr-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Best of Both Worlds Section Separator */}
      <div
        className="h-[4px] md:h-[6px] bg-contain"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
        }}
      />

      {/* Last Minute Deals Section - Mobile Responsive */}
      <section className="bg-sand py-[100px] md:py-[100px] relative pt-[100px] md:pt-[200px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption - Responsive */}
          <p className="text-center text-dark-blue text-[10px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
            DON'T MISS OUT
          </p>

          {/* Headline - Responsive */}
          <h2 className="text-center text-dark-blue text-[36px] md:text-[52px] font-whitney uppercase leading-none tracking-[-0.02em] mb-[80px]">
            Last Minute Deals
          </h2>

          {/* Deals Grid */}
          {isLoadingDeals ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-dark-blue"></div>
              <p className="mt-4 text-gray-600 font-geograph">
                Loading last minute deals...
              </p>
            </div>
          ) : lastMinuteDeals && lastMinuteDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lastMinuteDeals.slice(0, 6).map((deal) => {
                const normalizedCruise = normalizeCruiseData(deal);
                return (
                  <div
                    key={deal.id}
                    className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={() => handleCruiseClick(normalizedCruise)}
                  >
                    {/* Image Container */}
                    <div className="relative h-[200px] w-full overflow-hidden rounded-t-lg">
                      <Image
                        src={
                          normalizedCruise.ship?.defaultShipImage ||
                          "/images/cruise-placeholder.jpg"
                        }
                        alt={normalizedCruise.name || "Cruise"}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Cruise Line & Ship */}
                      <p className="text-gray-600 text-sm font-geograph mb-2">
                        {normalizedCruise.cruiseLine?.name || "Cruise Line"} •{" "}
                        {normalizedCruise.ship?.name || "Ship"}
                      </p>

                      {/* Title */}
                      <h3 className="text-dark-blue text-xl font-bold font-geograph mb-3 line-clamp-2">
                        {normalizedCruise.name || "Cruise Vacation"}
                      </h3>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-gray-600 text-sm">
                          <Image
                            src="/images/calendar-icon.svg"
                            alt=""
                            width={16}
                            height={16}
                            className="mr-2"
                          />
                          <span>
                            {new Date(
                              normalizedCruise.sailingDate,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600 text-sm">
                          <Image
                            src="/images/clock-icon.svg"
                            alt=""
                            width={16}
                            height={16}
                            className="mr-2"
                          />
                          <span>{normalizedCruise.nights || 0} nights</span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-gray-500 text-sm">From</p>
                          <p className="text-dark-blue text-2xl font-bold">
                            $
                            {normalizedCruise.cheapestPrice ||
                              normalizedCruise.interiorPrice ||
                              "N/A"}
                          </p>
                        </div>
                        <span className="text-[#0E1B4D] font-medium group-hover:translate-x-1 transition-transform duration-200">
                          View →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-600 font-geograph">
                No last minute deals available at the moment.
              </p>
            </div>
          )}

          {/* View All Button */}
          {lastMinuteDeals && lastMinuteDeals.length > 6 && (
            <div className="text-center mt-12">
              <button
                onClick={() => router.push("/search?deals=true")}
                className="bg-dark-blue hover:bg-dark-blue/90 text-white px-8 py-4 rounded-full text-[18px] font-geograph font-medium tracking-tight transition-all duration-200"
              >
                View All Deals
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// Main component wrapped with Suspense
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeWithParams />
    </Suspense>
  );
}
