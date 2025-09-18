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
      <section className="relative h-[720px] bg-light-blue pt-[120px] md:pt-[100px] pb-[50px] md:pb-[100px] overflow-visible z-20">
        {/* Floating Swimmers - Behind all content - Hidden on mobile */}
        <div className="absolute inset-0 z-0 hidden md:block">
          {/* Swimmer 1 */}
          <div
            className="absolute swimmer-float-1"
            style={{
              top: "15%",
              left: "8%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-1.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{
                width: "140px",
                height: "auto",
              }}
            />
          </div>

          {/* Swimmer 2 */}
          <div
            className="absolute swimmer-float-2"
            style={{
              top: "15%",
              right: "5%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-2.png"
              alt=""
              width={200}
              height={100}
              className="opacity-100"
              style={{
                width: "160px",
                height: "auto",
              }}
            />
          </div>

          {/* Swimmer 3 */}
          <div
            className="absolute swimmer-float-3"
            style={{
              bottom: "20%",
              left: "10%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-3.png"
              alt=""
              width={160}
              height={80}
              className="opacity-100"
              style={{
                width: "120px",
                height: "auto",
              }}
            />
          </div>

          {/* Swimmer 4 */}
          <div
            className="absolute swimmer-float-4"
            style={{
              bottom: "25%",
              right: "8%",
              width: "auto",
              height: "auto",
            }}
          >
            <OptimizedImage
              src="/images/swimmer-4.png"
              alt=""
              width={160}
              height={80}
              className="opacity-100"
              style={{
                width: "140px",
                height: "auto",
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-[calc(720px-220px)] px-4">
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
            className="bg-[#0E1B4D] hover:bg-[#0E1B4D]/90 text-sunshine px-8 py-4 rounded-full text-[20px] font-geograph font-medium tracking-tight transition-all duration-200 flex items-center gap-2"
            style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
          >
            <Image src="/images/search.svg" alt="" width={20} height={20} />
            Find my cruise
          </button>

          {/* Trust Indicators */}
          <div className="mt-[50px] flex flex-col items-center gap-3">
            <p className="text-white text-[10px] font-geograph font-bold uppercase tracking-[0.1em]">
              TRUSTED BY HUNDREDS OF CRUISERS
            </p>
            <div className="flex items-center gap-[6px]">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="#F4AC38"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-7.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Why Zipsea Section */}
      <section className="bg-white py-[80px] md:py-[120px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption */}
          <p className="text-center text-[#2238C3] text-[14px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
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
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-8.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* How It Works Section */}
      <section className="bg-[#0E1B4D] py-[80px] md:py-[120px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption */}
          <p className="text-center text-white text-[14px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
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
                <p className="text-[#2238C3] text-[14px] font-geograph font-bold uppercase tracking-[0.1em] mb-2">
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
                <p className="text-[#2238C3] text-[14px] font-geograph font-bold uppercase tracking-[0.1em] mb-2">
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
                <p className="text-[#2238C3] text-[14px] font-geograph font-bold uppercase tracking-[0.1em] mb-2">
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
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-9.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Best of Both Worlds Section */}
      <section className="bg-white py-[80px] md:py-[100px] overflow-hidden">
        <div className="max-w-7xl mx-auto px-8">
          {/* Caption */}
          <p className="text-center text-[#2238C3] text-[14px] font-geograph font-bold uppercase tracking-[0.1em] mb-4">
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
          <div className="flex items-center justify-center gap-8 mb-[100px]">
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#F4AC38"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#F4AC38"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
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
        </div>

        {/* Logo Strip Marquee - Full Width */}
        <div className="w-full overflow-hidden">
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
      </section>

      {/* Best of Both Worlds Section Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Last Minute Deals Section - Mobile Responsive */}
      <section className="bg-sand py-[100px] md:py-[100px] relative pt-[100px] md:pt-[200px]">
        <div className="max-w-7xl mx-auto px-8">
          {/* Headline with Hourglass Icon - Mobile Responsive */}
          <div className="flex items-center justify-center mb-[80px]">
            <svg
              width="36"
              height="36"
              viewBox="0 0 55 55"
              fill="none"
              className="mr-4 md:mr-6 md:w-12 md:h-12"
            >
              <path
                d="M42.7282 12.2502V10.084C42.7282 8.10861 41.1195 6.50002 39.144 6.50002H15.8563C13.8809 6.50002 12.2722 8.10861 12.2722 10.084V12.2502C12.2722 19.4316 15.5299 24.9918 20.1458 27.5001C15.5299 30.0083 12.2722 35.5686 12.2722 42.75V44.9162C12.2722 46.8916 13.8809 48.5002 15.8563 48.5002H39.144C41.1195 48.5002 42.7282 46.8916 42.7282 44.9162V42.75C42.7282 35.5686 39.4704 30.0083 34.8545 27.5001C39.4704 24.9918 42.7282 19.4316 42.7282 12.2502Z"
                stroke="#0E1B4D"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20.1892 12.2502C20.1892 12.2502 20.1892 23.083 34.0227 27.4998"
                stroke="#0E1B4D"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className="text-center text-dark-blue text-[36px] md:text-[52px] font-whitney uppercase leading-none tracking-[-0.02em]">
              Last Minute Deals
            </h2>
          </div>

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
        </div>
      </section>

      {/* Last Minute Deals Section Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />
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
