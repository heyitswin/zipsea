"use client";
import Image from "next/image";
import Link from "next/link";

export default function JuneauCruiseGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelGuide",
    name: "Juneau Alaska Cruise Port Guide",
    description:
      "Complete guide to Juneau cruise port. Discover Mendenhall Glacier, Mount Roberts Tramway, whale watching tours, and authentic Alaskan cuisine in Alaska's capital.",
    url: "https://www.zipsea.com/guides/juneau",
    image: [
      "https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg",
      "https://images.pexels.com/photos/15778747/pexels-photo-15778747.jpeg",
      "https://images.pexels.com/photos/9500926/pexels-photo-9500926.jpeg",
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
      "Juneau cruise port, Mendenhall Glacier, Mount Roberts Tramway, Alaska whale watching, Juneau Alaska, Tracy's King Crab Shack",
    mainEntity: {
      "@type": "Place",
      name: "Juneau Cruise Port",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Juneau",
        addressRegion: "Alaska",
        addressCountry: "US",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 58.3019,
        longitude: -134.4197,
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
            The Ultimate Cruise Guide to Juneau
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Alaska's Capital of Adventure Accessible Only by Air or Sea
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
                alt="Cruise ship docked in Juneau with Gastineau Channel and mountains"
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
                Stepping off a cruise ship in Juneau is unlike arriving at any
                other port of call. Nestled at the northern end of Alaska's
                Inside Passage, Juneau is a state capital with a singular
                identity, defined by its profound connection to the surrounding
                wilderness. This charming city is accessible only by air or sea,
                with its back to steep mountains and vast tracts of roadless
                wilderness. While Caribbean ports greet visitors with tropical
                warmth, Juneau offers a different adventure—a frontier town
                where gold-mining history still echoes along Gold Creek.
              </p>

              {/* Your Arrival At The Port */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Arrival in Juneau: A Port Day Primer
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The city's cruise ship docks are situated at the southern end of
                downtown, offering convenient and immediate connection to the
                heart of the city. Multiple berths accommodate both large and
                small ships, all connected by a wide, well-maintained boardwalk.
                You're perfectly positioned to begin exploring on foot the
                moment you disembark.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[18px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Port & Immediate Downtown Orientation
                </h3>
                <ul
                  className="font-geograph text-[14px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Port Location:</strong> Southern end of downtown
                    area
                  </li>
                  <li>
                    <strong>Docking/Tendering:</strong> Typically docking,
                    tendering possible when busy
                  </li>
                  <li>
                    <strong>Key Landmarks:</strong> Juneau Visitor Center, Mount
                    Roberts Tramway, Marine Park
                  </li>
                  <li>
                    <strong>Main Street:</strong> South Franklin Street connects
                    docks to downtown
                  </li>
                </ul>
              </div>

              {/* Getting Around */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around: From the Docks to the Wilderness
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Juneau's compact downtown core means many key attractions are
                easily accessible on foot. For those venturing to Mendenhall
                Glacier, several transportation options offer distinct
                cost-to-convenience ratios.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Transportation to Mendenhall Glacier
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0E1B4D]">
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Method
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Cost (Round-Trip)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Time (One-Way)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Walk Required
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Public Bus</td>
                      <td className="py-3 px-4">$4</td>
                      <td className="py-3 px-4">~1 hour</td>
                      <td className="py-3 px-4">1.5 miles to visitor center</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Private Shuttle</td>
                      <td className="py-3 px-4">$45-79</td>
                      <td className="py-3 px-4">~30 minutes</td>
                      <td className="py-3 px-4">Direct drop-off</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">Taxi</td>
                      <td className="py-3 px-4">$50-56</td>
                      <td className="py-3 px-4">15-20 minutes</td>
                      <td className="py-3 px-4">Direct drop-off</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* CTA 1 - After Transport Table */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Explore Alaska's Capital?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Discover glaciers, whales, and gold rush history in Juneau.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Alaska Cruises
                </a>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Pro Tip:</strong> Public bus requires exact cash fare
                  ($2 adult, $1 youth). The bus stop is 1.5 miles from glacier
                  visitor center - plan for 30-minute walk on flat,
                  wheelchair-accessible path.
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
                  src="https://images.pexels.com/photos/15778747/pexels-photo-15778747.jpeg"
                  alt="Panoramic view from Mount Roberts Tramway showing Juneau and Gastineau Channel"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders: Free & Low-Cost Adventures
              </h3>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Downtown Walking Distance
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>State Capitol:</strong> 15-min walk (free tours)
                    </li>
                    <li>
                      • <strong>St. Nicholas Church:</strong> 10-min walk
                    </li>
                    <li>
                      • <strong>Red Dog Saloon:</strong> Historic bar on
                      Franklin
                    </li>
                    <li>
                      • <strong>Juneau Seawalk:</strong> Waterfront boardwalk
                    </li>
                    <li>
                      • <strong>Whale Statue:</strong> Life-size breaching
                      humpback
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Mount Roberts Tramway
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Location:</strong> Directly across from
                      terminals
                    </li>
                    <li>
                      • <strong>Adult Ticket:</strong> ~$60 round-trip
                    </li>
                    <li>
                      • <strong>Child (3-12):</strong> ~$45 round-trip
                    </li>
                    <li>
                      • <strong>Features:</strong> 1,800ft elevation, trails,
                      eagle display
                    </li>
                    <li>
                      • <strong>Duration:</strong> 6-minute ride each way
                    </li>
                  </ul>
                </div>
              </div>

              {/* CTA 2 - After Mount Roberts */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Experience Juneau's Natural Wonders
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  From glaciers to wildlife, Juneau offers unforgettable Alaska
                  adventures.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Browse Alaska Cruises
                </a>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                High-Octane Alaskan Adventures
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/9500926/pexels-photo-9500926.jpeg"
                  alt="Humpback whale tail emerging from water during whale watching tour"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="space-y-6 mb-8">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">
                    Mendenhall Glacier Experience
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D] mb-2">
                    Visit the visitor center, walk to Photo Point, or hike 1.5
                    miles round-trip to Nugget Falls. Wildlife sightings include
                    black bears, porcupines, and mountain goats.
                  </p>
                  <p className="font-geograph text-[14px] font-bold text-[#0E1B4D]">
                    Entry: $15/adult at visitor center
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">
                    Whale Watching Tours
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D] mb-2">
                    Prime time June-August for humpback whales actively feeding.
                    Many operators offer "whale sighting guarantee."
                  </p>
                  <p className="font-geograph text-[14px] font-bold text-[#0E1B4D]">
                    Cost: $159-459/person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-2">
                    Helicopter & Dogsledding
                  </h4>
                  <p className="font-geograph text-[14px] text-[#0E1B4D] mb-2">
                    Ultimate bucket-list adventure on glaciers. Weight
                    restrictions apply (surcharge over 250lbs). No
                    bags/tablets/selfie sticks allowed.
                  </p>
                  <p className="font-geograph text-[14px] font-bold text-[#0E1B4D]">
                    Cost: $688-869/person
                  </p>
                </div>
              </div>

              {/* Sip & Savor */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Alaskan Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/831084/pexels-photo-831084.jpeg"
                  alt="Fresh Alaskan King Crab legs served with melted butter"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Juneau's culinary scene is heavily focused on fresh, local
                seafood. The city boasts well-regarded restaurants within easy
                walking distance of the cruise port, making it simple to get a
                true taste of Alaska.
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
                      • <strong>King Crab:</strong> Sweet, tender meat with
                      butter
                    </li>
                    <li>
                      • <strong>Halibut Tacos:</strong> Fresh Alaskan halibut
                    </li>
                    <li>
                      • <strong>Seafood Chowder:</strong> Crab, halibut, and
                      clams
                    </li>
                    <li>
                      • <strong>Reindeer Sausage:</strong> Savory, smoky flavor
                    </li>
                    <li>
                      • <strong>Wild Salmon:</strong> Freshly caught local
                      salmon
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
                      • <strong>Tracy's King Crab Shack:</strong> 2-5 min walk
                    </li>
                    <li>
                      • <strong>Hangar on the Wharf:</strong> Waterfront dining
                    </li>
                    <li>
                      • <strong>Rookery Cafe:</strong> Local ingredients, 7 min
                    </li>
                    <li>
                      • <strong>Alaskan Brewing Co:</strong> Local craft beers
                    </li>
                    <li>
                      • <strong>Red Dog Saloon:</strong> Historic atmosphere
                    </li>
                  </ul>
                </div>
              </div>

              {/* Weather Essentials */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Weather Essentials & The Art of Layering
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg"
                  alt="Traveler dressed in layers on scenic Juneau trail with misty mountains"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The single most important rule for a successful day in Juneau is
                to be prepared for weather. Alaska's climate is famously
                unpredictable, with conditions that can change drastically
                throughout the day. Dressing in layers is not just a suggestion
                but a necessity.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Juneau Monthly Weather & Key Insights
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0E1B4D]">
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Month
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Avg High (°F)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Rainfall (in)
                      </th>
                      <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">
                        Key Trends
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-geograph text-[14px]">
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">May</td>
                      <td className="py-3 px-4">58</td>
                      <td className="py-3 px-4">2.4</td>
                      <td className="py-3 px-4">Driest month, mid-50s temps</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">June</td>
                      <td className="py-3 px-4">63</td>
                      <td className="py-3 px-4">2.0</td>
                      <td className="py-3 px-4">Longer days, ideal weather</td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">July</td>
                      <td className="py-3 px-4">64</td>
                      <td className="py-3 px-4">2.3</td>
                      <td className="py-3 px-4">
                        Peak season, warm, abundant wildlife
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">August</td>
                      <td className="py-3 px-4">64</td>
                      <td className="py-3 px-4">3.0</td>
                      <td className="py-3 px-4">
                        Wettest summer month, bears active
                      </td>
                    </tr>
                    <tr className="border-b border-[#E5E5E5]">
                      <td className="py-3 px-4 font-bold">September</td>
                      <td className="py-3 px-4">57</td>
                      <td className="py-3 px-4">4.4</td>
                      <td className="py-3 px-4">
                        Rainiest month, cooler, fewer crowds
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Essential Packing List for Juneau
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Waterproof rain jacket with hood</li>
                    <li>• Fleece or puffer jacket</li>
                    <li>• Long and short-sleeved shirts</li>
                    <li>• Comfortable walking shoes (waterproof)</li>
                  </ul>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Moisture-wicking or wool socks</li>
                    <li>• Scarf, hat, and gloves</li>
                    <li>• Polarized sunglasses</li>
                    <li>• Small daypack for layers</li>
                  </ul>
                </div>
              </div>

              {/* Insider Tips */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Zipsea Survival Guide: Insider Tips & Essentials
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/12311020/pexels-photo-12311020.jpeg"
                  alt="Juneau cruise ship boardwalk with tour vendor booths and Mount Roberts Tramway"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Currency & Tipping
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• US Dollar - no exchange needed</li>
                    <li>• Tour guides: $40-60/day typical</li>
                    <li>• Restaurant: 15-20% standard</li>
                    <li>• Cash needed for public bus</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Safety Tips
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Dress in layers to avoid hypothermia</li>
                    <li>• Respect helicopter weight limits</li>
                    <li>• Stay on marked trails</li>
                    <li>• Bear awareness in wilderness</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-geograph font-bold text-[20px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Strategic Planning Tips
                </h3>
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>June-July:</strong> Best weather and longest
                    daylight but peak prices and crowds.
                  </li>
                  <li>
                    <strong>Late August-September:</strong> More rain but lower
                    prices, fewer crowds, active wildlife preparing for winter.
                  </li>
                  <li>
                    <strong>Book Early:</strong> Popular excursions like
                    helicopter tours sell out weeks in advance.
                  </li>
                  <li>
                    <strong>Downtown First:</strong> If weather turns bad, save
                    indoor activities for later.
                  </li>
                </ul>
              </div>

              {/* CTA Section */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg text-center mt-12">
                <h2
                  className="font-whitney font-black text-[32px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready for Your Alaskan Adventure?
                </h2>
                <p
                  className="font-geograph text-[18px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Find your perfect Alaska cruise with stops in Juneau
                </p>
                <Link
                  href="/cruises?region=alaska"
                  className="inline-block bg-[#0E1B4D] text-white px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-opacity-90 transition-all"
                >
                  Search Alaska Cruises →
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
                A day in Juneau offers a remarkable blend of convenience and
                adventure, from a stroll through historic downtown to a
                thrilling helicopter ride over a glacier. The city's unique
                geography and welcoming atmosphere empower travelers to create a
                day that perfectly aligns with their interests and budget.
                Whether you choose the value-driven path of public
                transportation and self-guided walks or the premium experience
                of private shuttles and high-end excursions, the key is making
                an informed choice aligned with your personal travel style. By
                understanding the logistical nuances, preparing for
                unpredictable weather, and embracing the local culture, your day
                in Juneau will be a memorable highlight of any Alaskan cruise.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
