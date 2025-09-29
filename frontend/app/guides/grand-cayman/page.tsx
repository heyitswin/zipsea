"use client";
import Image from "next/image";
import Link from "next/link";

export default function GrandCaymanCruiseGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelGuide",
    name: "Grand Cayman Cruise Port Guide",
    description:
      "Complete guide to Grand Cayman cruise port. Discover Seven Mile Beach, Stingray City, tender process tips, and the best shore excursions in George Town.",
    url: "https://www.zipsea.com/guides/grand-cayman",
    image: [
      "https://images.pexels.com/photos/1269805/pexels-photo-1269805.jpeg",
      "https://images.pexels.com/photos/144237/cruise-ship-cruiser-cruise-ship-144237.jpeg",
      "https://images.pexels.com/photos/1142984/pexels-photo-1142984.jpeg",
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
      "Grand Cayman cruise port, Seven Mile Beach, Stingray City, George Town cruise terminal, Grand Cayman tender port, Caribbean cruise excursions",
    mainEntity: {
      "@type": "Place",
      name: "Grand Cayman Cruise Port",
      address: {
        "@type": "PostalAddress",
        addressLocality: "George Town",
        addressCountry: "KY",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 19.2866,
        longitude: -81.3674,
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
            The Ultimate Cruise Guide to Grand Cayman
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Port Day Guide to Seven Mile Beach & Stingray City
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
                src="https://images.pexels.com/photos/1269805/pexels-photo-1269805.jpeg"
                alt="Panoramic drone shot of cruise ship anchored off George Town with tender boats and Seven Mile Beach"
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
                Welcome to Grand Cayman, an island that consistently ranks as a
                top cruise destination for its world-class beaches, unparalleled
                marine encounters, and understated sophistication. Unlike the
                bustling, dockside chaos of some Caribbean ports, Grand Cayman
                offers a serene, upscale, and impeccably clean experience.
                However, its unique logistical reality—being a tender
                port—requires a bit of insider knowledge to navigate
                successfully. This guide will provide you with the essential
                information to transform a limited port call into a rich,
                personalized adventure.
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
                  src="https://images.pexels.com/photos/144237/cruise-ship-cruiser-cruise-ship-144237.jpeg"
                  alt="View of tender terminals at George Town with shuttles and taxis"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Tender Process: A Cruiser's Reality Check
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Grand Cayman is a "tender port," which means cruise ships must
                anchor in the harbor, and passengers are ferried to one of the
                three small terminals in George Town on smaller boats called
                tenders. This process can take 45 minutes to an hour from queue
                to shore, making pre-planning essential. The tender process can
                also present unique challenges for those with mobility devices,
                as transfers may require navigating steps.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Royal Watler Terminal:</strong> Main tender terminal
                  in George Town with immediate access to shops and
                  transportation.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Time to Shore:</strong> Expect 45-60 minutes from ship
                  queue to stepping on land during peak times.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Priority Tender:</strong> Book ship excursions or
                  suite guests often receive priority tender tickets.
                </p>
              </div>

              {/* CTA 1 - After Tender Info */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Explore Grand Cayman?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Discover crystal-clear waters and world-class beaches on your
                  Caribbean cruise.
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Caribbean Cruises
                </a>
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
                        Mode of Transport
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Estimated Cost
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Convenience & Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Shared Shuttle</td>
                      <td className="py-3 px-4">~$6 per person, one-way</td>
                      <td className="py-3 px-4">
                        Common option for cruisers, can be crowded. Keep ticket
                        for return.
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">
                        Public Bus (Jitney)
                      </td>
                      <td className="py-3 px-4">~$3 per person, one-way</td>
                      <td className="py-3 px-4">
                        Most cost-effective, authentic experience. Look for blue
                        plates.
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Private Taxi</td>
                      <td className="py-3 px-4">~$27-35 per car, one-way</td>
                      <td className="py-3 px-4">
                        Fastest and most comfortable, ideal for groups.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Important:</strong> Uber and ride-sharing services are
                  not available on Grand Cayman. Plan your transportation
                  accordingly.
                </p>
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
                  src="https://images.pexels.com/photos/1142984/pexels-photo-1142984.jpeg"
                  alt="Family playing on the white sand of Seven Mile Beach"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Seven Mile Beach: The Heart of the Island
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Seven Mile Beach is not merely a destination; it's a global
                icon. A long crescent of soft coral sand set against electric
                turquoise waters, it's consistently ranked among the world's
                best beaches. As with all Cayman beaches, it's public property,
                allowing anyone to walk its full length without restriction.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4
                    className="font-geograph font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Public Access Points
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Public Beach:</strong> Central hub with
                      facilities
                    </li>
                    <li>
                      • <strong>Governor's Beach:</strong> Quieter alternative
                    </li>
                    <li>
                      • <strong>Cemetery Beach:</strong> Excellent snorkeling
                    </li>
                  </ul>
                </div>
                <div>
                  <h4
                    className="font-geograph font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Resort Day Passes
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Hampton by Hilton:</strong> ~$40 with pool
                      access
                    </li>
                    <li>
                      • <strong>Holiday Inn:</strong> $70 adults/$45 kids + $35
                      credit
                    </li>
                    <li>
                      • <strong>Grand Caymanian:</strong> ~$70 quieter beach
                    </li>
                  </ul>
                </div>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Beyond the Sand: Curated Adventures & Iconic Excursions
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0E1B4D]">
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Excursion Name
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Adult Price (USD)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Key Highlight
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">
                        Stingray City Tour
                      </td>
                      <td className="py-3 px-4">~$60</td>
                      <td className="py-3 px-4">
                        Interact with stingrays in waist-deep water
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Turtle Centre</td>
                      <td className="py-3 px-4">~$47</td>
                      <td className="py-3 px-4">
                        Hold baby sea turtles, conservation focus
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Resort Day Pass</td>
                      <td className="py-3 px-4">$40-70</td>
                      <td className="py-3 px-4">
                        Pool, beach, and resort amenities
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Stingray City Highlight */}
              <div className="bg-yellow-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  A Classic Encounter: Stingray City
                </h3>
                <p
                  className="font-geograph text-[16px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Grand Cayman's most famous attraction - a series of shallow
                  sandbars where you stand in waist-deep water to interact with,
                  feed, and photograph friendly Southern Stingrays. This unique
                  experience typically includes other stops like Starfish Point.
                </p>
                <p
                  className="font-geograph text-[14px] italic"
                  style={{ color: "#0E1B4D" }}
                >
                  Pro Tip: Book early or through your cruise line for guaranteed
                  spots, as this popular excursion sells out quickly.
                </p>
              </div>

              {/* CTA 2 - After Stingray City */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Book Your Grand Cayman Adventure
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Swim with stingrays and relax on Seven Mile Beach.
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Browse Caribbean Cruises
                </a>
              </div>

              {/* Sip & Savor */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Authentic Cayman
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/2067418/pexels-photo-2067418.jpeg"
                  alt="Local Caymanian-style beef with rice and fried plantains"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Caymanian cuisine is a delightful blend of local traditions and
                strong Jamaican influences. Engaging with the local food scene
                is an essential part of the cultural experience.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Must-Try Dishes
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Conch:</strong> Delicate, clam-like seafood
                    </li>
                    <li>
                      • <strong>Jerk Chicken:</strong> Island's most popular
                      street food
                    </li>
                    <li>
                      • <strong>Cayman-Style Beef:</strong> Slow-cooked stewed
                      beef
                    </li>
                    <li>
                      • <strong>Heavy Cake:</strong> Dense cassava pudding
                      dessert
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Where to Eat
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Champion House:</strong> George Town institution
                    </li>
                    <li>
                      • <strong>Heritage Kitchen:</strong> Classic dishes with
                      sea view
                    </li>
                    <li>
                      • <strong>Local BBQ spots:</strong> Combo plate ~CI$25
                    </li>
                  </ul>
                </div>
              </div>

              {/* For the Whole Crew */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                For the Whole Crew: Grand Cayman with Kids
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/889929/pexels-photo-889929.jpeg"
                  alt="Family interacting with a stingray at Stingray City"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Grand Cayman is a fantastic port for families, offering a blend
                of cultural experiences, natural wonders, and interactive
                learning perfect for all ages. The key to a successful family
                day is embracing both the urban and natural sides of the island.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Stingray City
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Children will be mesmerized by interacting with gentle
                    creatures in shallow water.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Turtle Centre
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Educational experience with hands-on turtle encounters in
                    touch tanks.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[16px] text-[#0E1B4D] mb-2">
                    Seven Mile Beach
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D]">
                    Calm waters and soft sand provide safe environment for
                    family fun.
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
                  src="https://images.pexels.com/photos/4386465/pexels-photo-4386465.jpeg"
                  alt="Wallet with Cayman Islands and U.S. currency with cruise ship background"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Ground: Currency, Tipping, and Getting Around
              </h3>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Currency:</strong> Cayman Islands Dollar (CI$) is
                    official, but US$ widely accepted at roughly 1:1 rate. Carry
                    small US bills.
                  </li>
                  <li>
                    <strong>Tipping:</strong> 10-15% is standard for good
                    service. Check bills as service charge often included.
                  </li>
                  <li>
                    <strong>Credit Cards:</strong> Widely accepted at major
                    establishments, but have cash for smaller vendors.
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
                      <td className="py-3 px-4 font-bold">
                        Dry Season (Nov-Apr)
                      </td>
                      <td className="py-3 px-4">84-88</td>
                      <td className="py-3 px-4">74-76</td>
                      <td className="py-3 px-4">
                        Near-constant sunshine, minimal rainfall
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">
                        Wet Season (May-Oct)
                      </td>
                      <td className="py-3 px-4">85-89</td>
                      <td className="py-3 px-4">77-78</td>
                      <td className="py-3 px-4">
                        Warmer, humid, frequent afternoon showers
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Sea temperature remains a comfortable 79-81°F year-round.
                Hurricane season runs from June to November, though direct hits
                are rare.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Staying Savvy, Staying Safe
              </h3>

              <div className="bg-red-50 p-6 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Critical Legal Note:</strong> Local laws are strictly
                  enforced, especially regarding firearms and ammunition. Even
                  an inadvertently misplaced single bullet in luggage can lead
                  to arrest and imprisonment.
                </p>
                <p
                  className="font-geograph text-[14px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Grand Cayman is very safe with low crime rates. Most common
                  issues are petty theft - keep valuables secured on ship and be
                  aware of surroundings.
                </p>
              </div>

              {/* CTA Section */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg text-center mt-12">
                <h2
                  className="font-whitney font-black text-[32px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Explore Grand Cayman?
                </h2>
                <p
                  className="font-geograph text-[18px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Find your perfect Caribbean cruise with stops in Grand Cayman
                </p>
                <Link
                  href="/cruises?region=caribbean"
                  className="inline-block bg-[#0E1B4D] text-white px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-opacity-90 transition-all"
                >
                  Search Caribbean Cruises →
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
                A day in Grand Cayman requires a bit of foresight but rewards
                the savvy traveler with an unforgettable experience. While the
                tender process may present an initial challenge, it's also the
                first step of a unique adventure. By understanding the
                logistical realities and the spectrum of experiences
                available—from the lively public hubs of Seven Mile Beach to
                serene resort hideaways—you can make informed choices that
                perfectly align with your travel style and budget. Whether you
                choose to unwind on tranquil white sand, embark on a thrilling
                encounter with stingrays, or simply explore the laid-back charm
                of George Town, your day ashore can be everything you want it to
                be.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
