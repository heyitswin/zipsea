"use client";
import Image from "next/image";
import Link from "next/link";

export default function HongKongCruiseGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelGuide",
    "name": "Hong Kong Cruise Port Guide",
    "description": "Complete guide to Hong Kong cruise ports. Discover Victoria Peak, dim sum, Star Ferry, and navigate between Ocean Terminal and Kai Tak terminals.",
    "url": "https://www.zipsea.com/guides/hong-kong",
    "image": [
      "https://images.pexels.com/photos/5607794/pexels-photo-5607794.jpeg",
      "https://images.pexels.com/photos/18093534/pexels-photo-18093534.jpeg",
      "https://images.pexels.com/photos/2725479/pexels-photo-2725479.jpeg"
    ],
    "author": {
      "@type": "Organization",
      "name": "Zipsea",
      "url": "https://www.zipsea.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Zipsea",
      "url": "https://www.zipsea.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.zipsea.com/logo.png"
      }
    },
    "datePublished": "2024-09-29",
    "dateModified": new Date().toISOString(),
    "keywords": "Hong Kong cruise port, Ocean Terminal Tsim Sha Tsui, Kai Tak Cruise Terminal, Victoria Peak, dim sum Hong Kong, Star Ferry, Avenue of Stars",
    "mainEntity": {
      "@type": "Place",
      "name": "Hong Kong Cruise Ports",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Hong Kong",
        "addressCountry": "HK"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 22.2936,
        "longitude": 114.1699
      }
    }
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
            The Ultimate Cruise Guide to Hong Kong
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Where East Meets West in the Pearl of the Orient
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
                src="https://images.pexels.com/photos/5607794/pexels-photo-5607794.jpeg"
                alt="Panoramic shot of Hong Kong skyline at night with laser light show illuminating Victoria Harbour"
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
                Hong Kong is a city that captures the imagination, a vibrant metropolis
                that seamlessly blends its historic roots with modern, cosmopolitan energy.
                For cruise passengers, a day here offers an unparalleled opportunity to
                explore a world-class destination. However, Hong Kong operates two distinct
                cruise terminals, each presenting a fundamentally different starting point
                for exploration. This guide provides a strategic framework for navigating
                your port day, empowering you to maximize every minute ashore, regardless
                of your arrival point.
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
                  src="https://images.pexels.com/photos/18093534/pexels-photo-18093534.jpeg"
                  alt="View from ferry approaching Victoria Harbour with cruise terminals"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The first and most critical step for any cruise passenger arriving in
                Hong Kong is to identify which of the two terminals your ship will be
                using. This determination dictates your entire strategy for the day,
                distinguishing between a direct, walkable exploration and one that
                requires an initial transportation decision.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Ocean Terminal (OPT): Your Walkable Gateway
              </h3>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Location:</strong> Tsim Sha Tsui District, Kowloon Peninsula -
                  the heart of Hong Kong's shopping and entertainment.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Advantage:</strong> Direct walkable access to Harbour City
                  (largest shopping complex), Avenue of Stars, and major attractions.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Best For:</strong> Larger cruise vessels; passengers wanting
                  immediate city immersion without transfers.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Kai Tak Cruise Terminal (KTCT): A Strategic Start
              </h3>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Location:</strong> Former Kai Tak Airport runway in Victoria
                  Harbour - newer, larger facility but requires transportation.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Transportation Required:</strong> Minibus, bus, or taxi to
                  reach main attractions (14-30 minutes to city center).
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Best For:</strong> Newer mega-ships; passengers comfortable
                  with Hong Kong's public transport system.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Hong Kong Cruise Port Transportation Guide
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0E1B4D]">
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Mode
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Cost
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Time
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Terminal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Walk</td>
                      <td className="py-3 px-4">Free</td>
                      <td className="py-3 px-4">0-15 min</td>
                      <td className="py-3 px-4">Ocean Terminal only</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Taxi</td>
                      <td className="py-3 px-4">HK$22-260 (US$3-34)</td>
                      <td className="py-3 px-4">5-40 min</td>
                      <td className="py-3 px-4">Both terminals</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Green Minibus #86</td>
                      <td className="py-3 px-4">HK$7.10 (US$0.90)</td>
                      <td className="py-3 px-4">Varies</td>
                      <td className="py-3 px-4">Kai Tak to MTR</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Bus 20A</td>
                      <td className="py-3 px-4">HK$7.50 (US$1)</td>
                      <td className="py-3 px-4">Varies</td>
                      <td className="py-3 px-4">Kai Tak Terminal</td>
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
                  src="https://images.pexels.com/photos/2725479/pexels-photo-2725479.jpeg"
                  alt="View from Victoria Peak overlooking Hong Kong skyline and harbour at sunset"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders of Kowloon (Ocean Terminal Exclusive)
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For those arriving at Ocean Terminal, the surrounding area is a
                destination in itself. The terminal is part of Harbour City complex,
                featuring countless shops, restaurants, and entertainment venues.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Walking Distance from OPT
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• <strong>Avenue of Stars:</strong> 5-min waterfront promenade</li>
                    <li>• <strong>Clock Tower:</strong> Historic Kowloon Station remnant</li>
                    <li>• <strong>Space Museum:</strong> 10-min walk</li>
                    <li>• <strong>Cultural Centre:</strong> 8-min walk</li>
                    <li>• <strong>Star Ferry Pier:</strong> 10-min to Central</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Must-Do Experiences
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• <strong>Victoria Peak Tram:</strong> Iconic funicular railway</li>
                    <li>• <strong>Star Ferry:</strong> Classic harbour crossing</li>
                    <li>• <strong>Symphony of Lights:</strong> 8pm laser show</li>
                    <li>• <strong>Temple Street Market:</strong> Night market experience</li>
                    <li>• <strong>Ladies' Market:</strong> Shopping paradise</li>
                  </ul>
                </div>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Beyond the Port: The Best of Hong Kong
              </h3>

              <div className="space-y-6 mb-8">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">
                    Victoria Peak
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Take the Peak Tram for spectacular panoramic views. The journey itself
                    is an adventure as the funicular climbs at a 27-degree angle. Sky Terrace
                    428 offers 360-degree views.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">
                    Cultural Heritage Sites
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Man Mo Temple (oldest temple), Chi Lin Nunnery (Buddhist complex with
                    gardens), and Wong Tai Sin Temple (good fortune prayers).
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">
                    Street Markets
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Ladies' Market (clothing/souvenirs), Temple Street Night Market
                    (evening street food), Fa Yuen Street (authentic local shopping).
                  </p>
                </div>
              </div>

              {/* Sip & Savor */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Hong Kong Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/5409017/pexels-photo-5409017.jpeg"
                  alt="Steaming bamboo baskets of assorted dim sum with chopsticks and dipping sauce"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Hong Kong's culinary scene is a celebration of fresh ingredients, with
                emphasis on Cantonese cuisine, dim sum, and international flavors. The
                food culture is deeply ingrained in daily life, and exploring local
                eateries is an essential part of the experience.
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
                    <li>• <strong>Dim Sum:</strong> Small steamer basket dishes</li>
                    <li>• <strong>Wonton Noodle Soup:</strong> Classic comfort food</li>
                    <li>• <strong>Roast Goose:</strong> Crispy skin, tender meat</li>
                    <li>• <strong>Fish Balls:</strong> Street snack with curry</li>
                    <li>• <strong>Egg Tarts:</strong> Flaky pastry dessert</li>
                    <li>• <strong>Pineapple Bun:</strong> Sweet breakfast pastry</li>
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
                    <li>• <strong>Tim Ho Wan:</strong> World's cheapest Michelin star</li>
                    <li>• <strong>Jumbo Kingdom:</strong> Floating restaurant</li>
                    <li>• <strong>Mak's Noodle:</strong> Authentic wonton soup</li>
                    <li>• <strong>Yung Kee:</strong> Famous roast goose</li>
                    <li>• <strong>Australia Dairy Co:</strong> Local breakfast</li>
                  </ul>
                </div>
              </div>

              {/* For the Whole Crew */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                For the Whole Crew: Hong Kong with Kids
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/4543714/pexels-photo-4543714.jpeg"
                  alt="Family at Hong Kong Disneyland with child waving to Disney character"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Hong Kong is fantastic for families, offering activities that appeal to
                all ages. The city's efficient public transport system makes navigating
                with children a breeze.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Peak Tram Adventure
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Journey is an adventure with Madame Tussauds and interactive exhibits
                    at Peak Tower.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Ocean Park
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Marine life exhibits, animal encounters, and thrill rides for all ages.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Hong Kong Disneyland
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Short MTR ride from city center with classic rides and character meets.
                  </p>
                </div>
              </div>

              {/* Insider Tips & Essentials */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Zipsea Survival Guide: Insider Tips & Essentials
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/30310429/pexels-photo-30310429.jpeg"
                  alt="Hand using Octopus card at MTR station turnstile"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Ground: Currency and Commerce
              </h3>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Currency:</strong> Hong Kong Dollar (HKD) pegged to US$ at
                    approximately HK$7.80 to US$1. Credit cards widely accepted.
                  </li>
                  <li>
                    <strong>Octopus Card:</strong> Essential for public transport and many
                    shops. Buy at airport or MTR stations for HK$150 (includes HK$100 credit).
                  </li>
                  <li>
                    <strong>Tipping:</strong> 10% service charge often added automatically.
                    Round up taxi fares. Not expected at casual eateries.
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
                      <td className="py-3 px-4 font-bold">Spring (Mar-May)</td>
                      <td className="py-3 px-4">70-80</td>
                      <td className="py-3 px-4">60-75</td>
                      <td className="py-3 px-4">Mild and pleasant, rising humidity</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Summer (Jun-Aug)</td>
                      <td className="py-3 px-4">85-90</td>
                      <td className="py-3 px-4">78-82</td>
                      <td className="py-3 px-4">Hot, humid, typhoon risk</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Autumn (Sep-Nov)</td>
                      <td className="py-3 px-4">70-80</td>
                      <td className="py-3 px-4">60-75</td>
                      <td className="py-3 px-4">Best season - sunny, low humidity</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Winter (Dec-Feb)</td>
                      <td className="py-3 px-4">65-70</td>
                      <td className="py-3 px-4">58-65</td>
                      <td className="py-3 px-4">Cool and dry, low rain chance</td>
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
                  Hong Kong is very safe for tourists with low crime rates and polite,
                  orderly society. Be aware of:
                </p>
                <ul
                  className="font-geograph text-[14px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Pickpocketing in crowded tourist areas</li>
                  <li>• Phone theft - keep devices secure</li>
                  <li>• Public demonstrations may disrupt transport</li>
                  <li>• Always carry umbrella during summer months</li>
                  <li>• Download offline maps before leaving ship</li>
                </ul>
              </div>

              {/* Quick Reference */}
              <div className="bg-yellow-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-geograph font-bold text-[20px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Quick Reference for Your Hong Kong Day
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-geograph font-bold text-[16px] mb-2" style={{ color: "#0E1B4D" }}>
                      From Ocean Terminal
                    </h4>
                    <ul className="font-geograph text-[14px] space-y-1" style={{ color: "#0E1B4D" }}>
                      <li>• Walk to Avenue of Stars (5 min)</li>
                      <li>• Star Ferry to Central (HK$3)</li>
                      <li>• Peak Tram from Central</li>
                      <li>• Return via Symphony of Lights (8pm)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-geograph font-bold text-[16px] mb-2" style={{ color: "#0E1B4D" }}>
                      From Kai Tak Terminal
                    </h4>
                    <ul className="font-geograph text-[14px] space-y-1" style={{ color: "#0E1B4D" }}>
                      <li>• Green Minibus #86 to MTR (HK$7)</li>
                      <li>• Taxi to Central (HK$140-170)</li>
                      <li>• Allow 30 min extra travel time</li>
                      <li>• Buy Octopus Card at terminal</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* CTA Section */}
              <div
                className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg text-center mt-12"
              >
                <h2
                  className="font-whitney font-black text-[32px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Explore Hong Kong?
                </h2>
                <p
                  className="font-geograph text-[18px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Find your perfect Asia cruise with stops in Hong Kong
                </p>
                <Link
                  href="/cruises?region=asia"
                  className="inline-block bg-[#0E1B4D] text-white px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-opacity-90 transition-all"
                >
                  Search Asia Cruises →
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
                A day in Hong Kong is a journey through a vibrant, dynamic city that
                effortlessly combines iconic man-made landmarks with spectacular natural
                beauty. By understanding the unique logistical challenges of the city's
                two-port system and utilizing its transparent and efficient public
                transport network, you can craft a day that is both ambitious and
                seamless. With a bit of pre-planning, your day in this magnificent
                city will not just be a visit, but a cherished highlight of any cruise.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
