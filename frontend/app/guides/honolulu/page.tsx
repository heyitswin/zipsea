"use client";
import Image from "next/image";
import Link from "next/link";

export default function HonoluluCruiseGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelGuide",
    name: "Honolulu Cruise Port Guide",
    description:
      "Complete guide to Honolulu cruise port. Discover Pearl Harbor, Waikiki Beach, Diamond Head, and authentic Hawaiian cuisine in downtown Honolulu.",
    url: "https://www.zipsea.com/guides/honolulu",
    image: [
      "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
      "https://images.pexels.com/photos/29447146/pexels-photo-29447146.jpeg",
      "https://images.pexels.com/photos/11874072/pexels-photo-11874072.jpeg",
    ],
    author: {
      "@type": "Organization",
      name: "Zipsea",
      url: "https://www.zipsea.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Zipsea",
      url: "https://www.zipsea.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.zipsea.com/logo.png",
      },
    },
    datePublished: "2024-09-29",
    dateModified: new Date().toISOString(),
    keywords:
      "Honolulu cruise port, Pearl Harbor tours, Waikiki Beach cruise, Diamond Head hike, Hawaiian plate lunch, Aloha Tower",
    mainEntity: {
      "@type": "Place",
      name: "Port of Honolulu",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Honolulu",
        addressRegion: "Hawaii",
        addressCountry: "US",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 21.3066,
        longitude: -157.8659,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section
        className="relative pt-[100px] pb-[80px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[42px] md:text-[72px]"
            style={{
              color: "#F7F170",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            The Ultimate Cruise Guide to Honolulu, Hawaiʻi
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Gateway to Paradise in the Heart of the Pacific
          </p>
        </div>
      </section>

      {/* Separator Image */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-5.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Main Content */}
      <main
        style={{ backgroundColor: "#E9B4EB" }}
        className="py-[40px] md:py-[80px]"
      >
        <article className="max-w-4xl mx-auto px-8">
          <div className="bg-white rounded-lg p-8 md:p-12 shadow-sm">
            {/* Hero Image */}
            <div className="relative w-full h-[400px] mb-8 rounded-lg overflow-hidden">
              <Image
                src="https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg"
                alt="Aerial view of Honolulu Harbor with cruise ship at Pier 2 terminal, city skyline and Diamond Head"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Introduction */}
            <div className="prose prose-lg max-w-none">
              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For the discerning cruiser, a port day in Honolulu is a journey
                into a vibrant city that serves as both a modern capital and the
                heart of an ancient kingdom. Unlike many cruise destinations
                where the port is geographically isolated from main attractions,
                the Port of Honolulu is strategically situated in the city's
                bustling downtown core. This unique positioning transforms your
                first steps ashore from a logistical puzzle into an immediate
                gateway to discovery.
              </p>

              {/* Your Arrival At The Port */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Arrival At The Port
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/29447146/pexels-photo-29447146.jpeg"
                  alt="View of the Aloha Tower at Pier 11 with Honolulu skyline"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Honolulu offers a distinctive and highly advantageous arrival
                experience. The Port of Honolulu, officially known as Honolulu
                Harbor, operates two primary cruise terminals - Pier 2 and Pier
                11 - located in close proximity in the heart of downtown. Most
                large cruise ships dock directly at the pier with walk-off
                access to the downtown area. The city unfolds just a short
                stroll from the gangway, allowing you to begin exploration
                immediately.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Pier 2 & Pier 11:</strong> Main cruise terminals in
                  downtown Honolulu with direct walkable access to city
                  attractions.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Aloha Tower:</strong> Adjacent to Pier 11, offers free
                  panoramic views of harbor and city skyline.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Downtown Location:</strong> Immediate access to
                  Chinatown, historic sites, and public transportation.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Move: Your Transportation Compass
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0E1B4D]">
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Destination
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Mode
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Cost
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold" rowSpan={3}>
                        Waikiki Beach
                      </td>
                      <td className="py-3 px-4">Taxi/Rideshare</td>
                      <td className="py-3 px-4">$19-25</td>
                      <td className="py-3 px-4">6-7 min</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4">TheBus</td>
                      <td className="py-3 px-4">$3</td>
                      <td className="py-3 px-4">14-21 min</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4">Shuttle</td>
                      <td className="py-3 px-4">~$22</td>
                      <td className="py-3 px-4">15-20 min</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold" rowSpan={2}>
                        Diamond Head
                      </td>
                      <td className="py-3 px-4">Taxi/Rideshare</td>
                      <td className="py-3 px-4">$27-35</td>
                      <td className="py-3 px-4">10-11 min</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4">TheBus</td>
                      <td className="py-3 px-4">$3</td>
                      <td className="py-3 px-4">28-42 min</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Pearl Harbor</td>
                      <td className="py-3 px-4">Taxi/Tour</td>
                      <td className="py-3 px-4">$57-114</td>
                      <td className="py-3 px-4">20-30 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Top Adventures & Excursions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Day, Your Way: Top Adventures & Excursions
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/11874072/pexels-photo-11874072.jpeg"
                  alt="USS Arizona Memorial at Pearl Harbor with American flag"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                A Journey Through History: Pearl Harbor
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For many visitors, Pearl Harbor is a non-negotiable part of
                their Honolulu visit. This site of profound reverence and
                historical significance offers free admission to the memorial,
                though boat shuttle tickets are often booked far in advance.
                Guided tours include round-trip transportation and guaranteed
                USS Arizona Memorial tickets.
              </p>

              <div className="bg-yellow-50 p-6 rounded-lg mb-6">
                <h4
                  className="font-geograph font-bold text-[18px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Pearl Harbor Tips
                </h4>
                <ul
                  className="font-geograph text-[14px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • Book memorial tickets at recreation.gov weeks in advance
                  </li>
                  <li>
                    • Cruise excursion: ~$114/person with guaranteed access
                  </li>
                  <li>• Independent tour: ~$57/adult with transportation</li>
                  <li>• No bags allowed - storage available for $7</li>
                  <li>• Audio tours available in multiple languages</li>
                </ul>
              </div>

              {/* CTA 1 - After Pearl Harbor */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready for Paradise?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Experience Hawaii's capital on your Pacific cruise adventure.
                </p>
                <a
                  href="/cruises?region=hawaii"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Hawaii Cruises
                </a>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders: Downtown Honolulu
              </h3>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Walking Distance from Port
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Aloha Tower:</strong> Adjacent - free views
                    </li>
                    <li>
                      • <strong>Iolani Palace:</strong> 15 min - only US royal
                      palace
                    </li>
                    <li>
                      • <strong>Chinatown:</strong> 15 min - cultural hub
                    </li>
                    <li>
                      • <strong>King Kamehameha Statue:</strong> 10 min walk
                    </li>
                    <li>
                      • <strong>Hawaii State Art Museum:</strong> 12 min - free
                      admission
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Beach Options
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Waikiki:</strong> Famous 2-mile beach, gentle
                      waves
                    </li>
                    <li>
                      • <strong>Ala Moana:</strong> Closer, relaxed atmosphere
                    </li>
                    <li>
                      • <strong>Hanauma Bay:</strong> Premier snorkeling
                      (reserve ahead)
                    </li>
                    <li>
                      • <strong>Lanikai:</strong> Pristine, less crowded
                    </li>
                  </ul>
                </div>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Perspectives From Above: Diamond Head
              </h3>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Diamond Head State Monument offers unparalleled panoramic
                  views of Waikiki and the coastline from an ancient volcanic
                  crater summit.
                </p>
                <ul
                  className="font-geograph text-[14px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • <strong>Reservation Required:</strong> Book online up to
                    30 days ahead
                  </li>
                  <li>
                    • <strong>Entry Fee:</strong> $5/person plus $10 parking
                  </li>
                  <li>
                    • <strong>Hike Duration:</strong> 1.5-2 hours round trip
                  </li>
                  <li>
                    • <strong>Difficulty:</strong> Moderate with 560ft elevation
                    gain
                  </li>
                  <li>
                    • <strong>Best Time:</strong> Early morning to avoid heat
                    and crowds
                  </li>
                </ul>
              </div>

              {/* Sip & Savor */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Hawaiian Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/2433868/pexels-photo-2433868.jpeg"
                  alt="Classic Hawaiian plate lunch with kalua pig, rice, and macaroni salad"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Honolulu's culinary scene reflects its diverse culture, blending
                traditional Hawaiian flavors with Asian and Pacific influences.
                The quintessential local meal is the plate lunch - a satisfying
                dish with meat, two scoops rice, and macaroni salad.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Must-Try Local Dishes
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Poke:</strong> Raw ahi tuna with seasonings
                    </li>
                    <li>
                      • <strong>Kalua Pig:</strong> Smoky slow-cooked pork
                    </li>
                    <li>
                      • <strong>Loco Moco:</strong> Rice, burger, egg, gravy
                    </li>
                    <li>
                      • <strong>Malasada:</strong> Portuguese sugar donut
                    </li>
                    <li>
                      • <strong>Saimin:</strong> Hawaiian ramen noodles
                    </li>
                    <li>
                      • <strong>Shave Ice:</strong> Fluffy ice with syrups
                    </li>
                  </ul>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Recommended Dining
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Nico's Pier 38:</strong> Seafood near port
                    </li>
                    <li>
                      • <strong>Pig & The Lady:</strong> Vietnamese-fusion in
                      Chinatown
                    </li>
                    <li>
                      • <strong>Rainbow Drive Inn:</strong> Classic plate lunch
                    </li>
                    <li>
                      • <strong>Helena's Hawaiian Food:</strong> James Beard
                      winner
                    </li>
                    <li>
                      • <strong>Leonard's Bakery:</strong> Famous malasadas
                    </li>
                  </ul>
                </div>
              </div>

              {/* For the Whole Crew */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                For the Whole Crew: Honolulu with Kids
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/1142984/pexels-photo-1142984.jpeg"
                  alt="Family playing on white sand beach"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Honolulu is widely regarded as a family-friendly destination
                with a welcoming attitude toward children and wealth of engaging
                activities. The walkability of downtown is a major advantage for
                families.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Family Beaches
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Waikiki's calm waters and Ala Moana's protected lagoon
                    perfect for kids.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Honolulu Zoo
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    42-acre zoo between Waikiki and Diamond Head. Adults $21,
                    Kids $13.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Waikiki Aquarium
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Hawaiian marine life exhibits. Adults $12, Children $5.
                  </p>
                </div>
              </div>

              {/* Insider Tips & Essentials */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Honolulu Survival Guide: Insider Tips & Essentials
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/4386465/pexels-photo-4386465.jpeg"
                  alt="US currency with Waikiki Beach in background"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Ground: Currency & Tipping
              </h3>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Currency:</strong> US Dollar - credit cards widely
                    accepted, carry small bills for tips and local markets.
                  </li>
                  <li>
                    <strong>Restaurant Tipping:</strong> 15-20% standard for
                    good service.
                  </li>
                  <li>
                    <strong>Bar Tipping:</strong> $1-2 per drink for simple
                    orders.
                  </li>
                  <li>
                    <strong>Tour Guides:</strong> 10-20% of tour cost or
                    $5-20/person.
                  </li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Weather Essentials: What to Expect
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0E1B4D]">
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Season
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Avg High (°F)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Avg Low (°F)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Key Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Summer (Jun-Aug)</td>
                      <td className="py-3 px-4">87-89</td>
                      <td className="py-3 px-4">74-76</td>
                      <td className="py-3 px-4">
                        Peak season, hottest and sunniest
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Autumn (Sep-Nov)</td>
                      <td className="py-3 px-4">84-88</td>
                      <td className="py-3 px-4">72-75</td>
                      <td className="py-3 px-4">
                        Ideal exploration, fewer crowds
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Winter (Dec-Feb)</td>
                      <td className="py-3 px-4">81-82</td>
                      <td className="py-3 px-4">67-69</td>
                      <td className="py-3 px-4">Coolest and wettest months</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Spring (Mar-May)</td>
                      <td className="py-3 px-4">81-85</td>
                      <td className="py-3 px-4">68-72</td>
                      <td className="py-3 px-4">Perfect sightseeing weather</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Staying Savvy, Staying Safe
              </h3>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Honolulu is one of the safest major US cities with low violent
                  crime. Follow these common-sense precautions:
                </p>
                <ul
                  className="font-geograph text-[14px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Leave valuables in ship's safe</li>
                  <li>• Be aware of surroundings in tourist areas</li>
                  <li>• Respect ocean conditions - heed lifeguard warnings</li>
                  <li>• Use reef-safe sunscreen (required by law)</li>
                  <li>• Stay hydrated - tropical sun is intense</li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Essential Gear: What to Wear
              </h3>

              <div className="bg-yellow-50 p-6 rounded-lg mb-8">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Dress Code:</strong> Casual island style - Aloha
                    shirts appropriate for any occasion.
                  </li>
                  <li>
                    <strong>Footwear:</strong> Comfortable walking shoes
                    essential, especially for Diamond Head hike.
                  </li>
                  <li>
                    <strong>Sun Protection:</strong> Hat, sunglasses, and
                    reef-safe sunscreen mandatory.
                  </li>
                  <li>
                    <strong>Beach Gear:</strong> Most beaches have minimal shade
                    - bring or rent an umbrella.
                  </li>
                </ul>
              </div>

              {/* CTA Section */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg text-center mt-12">
                <h2
                  className="font-whitney font-black text-[32px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Experience the Aloha Spirit?
                </h2>
                <p
                  className="font-geograph text-[18px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Find your perfect Hawaii cruise with stops in Honolulu
                </p>
                <Link
                  href="/cruises?region=hawaii"
                  className="inline-block bg-[#0E1B4D] text-white px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-opacity-90 transition-all"
                >
                  Search Hawaii Cruises →
                </Link>
              </div>

              {/* Before You Sail Away */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Before You Sail Away
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed italic"
                style={{ color: "#0E1B4D" }}
              >
                A day in Honolulu seamlessly blends deep dives into Hawaiian
                history with relaxing escapes into nature. The city's distinct
                advantage of a centrally located cruise port provides the
                perfect starting point for strategic and independent
                exploration. By understanding transportation options, curating a
                day that aligns with your interests, and applying key practical
                advice, you can craft an experience that is both authentic and
                deeply memorable. With a bit of planning, your day here is not
                just a visit; it's an adventure that captures the essence of the
                aloha spirit.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
