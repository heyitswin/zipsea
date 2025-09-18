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
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-[calc(720px-220px)] px-4 pt-[60px]">
          {/* Main Heading - Responsive */}
          <h1 className="text-sunshine text-[48px] md:text-[72px] font-whitney uppercase text-center leading-none tracking-tight mb-3 md:mb-5">
            The smartest
            <br />
            way to cruise
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
            className="bg-[#0E1B4D] hover:bg-[#0E1B4D]/90 text-white px-8 py-4 rounded-full text-[20px] font-geograph font-medium tracking-tight transition-all duration-200 flex items-center gap-2"
            style={{ boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 19L14.65 14.65"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Find my cruise
          </button>

          {/* Trust Indicators */}
          <div className="mt-[75px] flex flex-col items-center gap-2">
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
                  fill="#F7F170"
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
              incentives to sell their sailings. Most agencies keep it as
              commission. At Zipsea, we give most of it back to you.
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
              <p className="text-[#2F2F2F] text-[12px] font-geograph font-bold uppercase tracking-[0.1em]">
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
              <p className="text-[#2F2F2F] text-[12px] font-geograph font-bold uppercase tracking-[0.1em]">
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
              <p className="text-[#2F2F2F] text-[12px] font-geograph font-bold uppercase tracking-[0.1em]">
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
              style={{ shapeRendering: "geometricPrecision" }}
            >
              <g clipPath="url(#clip0_573_3612)">
                <path
                  d="M38.4687 49.648L35.7206 48.9646L37.3152 42.5522C37.9504 39.989 37.8041 37.2943 36.8953 34.8148C35.9865 32.3354 34.3567 30.1845 32.2156 28.6388C34.8312 28.2759 37.2785 27.1389 39.2428 25.374C41.2071 23.6091 42.5986 21.297 43.2383 18.7349L44.833 12.3226L47.5812 13.006C48.0671 13.1269 48.5811 13.0497 49.0101 12.7916C49.4391 12.5335 49.748 12.1155 49.8689 11.6296C49.9897 11.1437 49.9126 10.6297 49.6544 10.2006C49.3963 9.77159 48.9783 9.46268 48.4924 9.34184L17.3467 1.59625C16.8608 1.47541 16.3468 1.55254 15.9178 1.81068C15.4888 2.06882 15.1799 2.48682 15.059 2.97272C14.9382 3.45863 15.0153 3.97263 15.2735 4.40166C15.5316 4.83069 15.9496 5.1396 16.4355 5.26044L19.1836 5.94388L17.589 12.3562C16.9541 14.9195 17.1005 17.614 18.0092 20.0935C18.918 22.5729 20.5477 24.7238 22.6886 26.2696C20.0729 26.6323 17.6255 27.7692 15.6611 29.5341C13.6968 31.2991 12.3054 33.6113 11.6659 36.1735L10.0712 42.5858L7.32304 41.9024C6.83713 41.7816 6.32313 41.8587 5.8941 42.1168C5.46507 42.375 5.15615 42.793 5.03532 43.2789C4.91448 43.7648 4.99161 44.2788 5.24975 44.7078C5.50789 45.1368 5.92589 45.4458 6.41179 45.5666L37.5575 53.3122C38.0434 53.433 38.5574 53.3559 38.9864 53.0978C39.4154 52.8396 39.7243 52.4216 39.8452 51.9357C39.966 51.4498 39.8889 50.9358 39.6307 50.5068C39.3726 50.0777 38.9546 49.7688 38.4687 49.648ZM22.7864 16.4112C23.0148 16.1494 23.311 15.9556 23.6424 15.8513C23.9738 15.747 24.3276 15.7362 24.6648 15.8201L35.3642 18.4809C35.7012 18.565 36.0085 18.7404 36.2522 18.9878C36.4959 19.2352 36.6667 19.5451 36.7457 19.8833C36.8247 20.2215 36.8088 20.5749 36.6999 20.9047C36.591 21.2345 36.3932 21.5278 36.1284 21.7525C35.0797 22.6448 33.8334 23.2744 32.4929 23.5891C31.1524 23.9039 29.7562 23.8947 28.42 23.5624C27.0837 23.2301 25.8458 22.5842 24.8089 21.6782C23.772 20.7722 22.9659 19.6322 22.4573 18.3526C22.3282 18.0301 22.2906 17.6782 22.3487 17.3356C22.4067 16.9931 22.5582 16.6732 22.7864 16.4112ZM16.9564 37.7421L23.871 33.75C24.5077 33.4096 25.248 33.3176 25.9487 33.4919C26.6493 33.6661 27.2603 34.0942 27.6634 34.6931L31.9012 41.4568C32.1985 41.9225 32.3362 42.4723 32.2936 43.0232C32.251 43.5741 32.0304 44.0962 31.6651 44.5107C31.3276 44.8836 30.8946 45.1571 30.4129 45.3017C29.9312 45.4463 29.4191 45.4564 28.9321 45.3309L17.7764 42.5566C17.2883 42.4411 16.8409 42.1945 16.4825 41.8435C16.1242 41.4924 15.8684 41.0503 15.7428 40.5646C15.6112 40.0262 15.6584 39.4595 15.8773 38.9503C16.0963 38.4411 16.475 38.017 16.9564 37.7421Z"
                  fill="#0E1B4D"
                />
              </g>
              <defs>
                <clipPath id="clip0_573_3612">
                  <rect
                    width="45.3097"
                    height="45.3097"
                    fill="white"
                    transform="translate(10.9351) rotate(13.9655)"
                  />
                </clipPath>
              </defs>
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
