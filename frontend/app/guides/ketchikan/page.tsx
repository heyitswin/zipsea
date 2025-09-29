"use client";
import Image from "next/image";
import Link from "next/link";

export default function KetchikanCruiseGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelGuide",
    "name": "Ketchikan Cruise Port Guide",
    "description": "Complete guide to Ketchikan cruise port, Alaska's First City. Discover Creek Street, totem poles, salmon runs, and Misty Fjords on your port day.",
    "url": "https://www.zipsea.com/guides/ketchikan",
    "image": [
      "https://images.pexels.com/photos/326227/pexels-photo-326227.jpeg",
      "https://images.pexels.com/photos/2026315/pexels-photo-2026315.jpeg",
      "https://images.pexels.com/photos/1123250/pexels-photo-1123250.jpeg"
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
    "keywords": "Ketchikan cruise port, Creek Street Alaska, totem poles Ketchikan, Misty Fjords tour, salmon capital, Ward Cove terminal, Alaska First City",
    "mainEntity": {
      "@type": "Place",
      "name": "Ketchikan Cruise Port",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Ketchikan",
        "addressRegion": "Alaska",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 55.3422,
        "longitude": -131.6461
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
            The Ultimate Cruise Guide to Ketchikan
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Alaska's First City: Totem Poles, Salmon & Creek Street
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
                src="https://images.pexels.com/photos/326227/pexels-photo-326227.jpeg"
                alt="Scenic shot of Creek Street in Ketchikan with colorful wooden buildings on stilts over salmon-filled creek"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Introduction */}
            <div className="prose prose-lg max-w-none">
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Welcome to the "First City"
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A cruise port day in Ketchikan presents a unique logistical consideration that
                fundamentally shapes the entire experience. It is a city that earns its moniker,
                the "First City," not only because it is the first major port of call for many
                Alaskan cruises, but also because it is a vibrant gateway to the region's rich
                history, Native culture, and abundant wildlife. From the historic boardwalks of
                Creek Street to the towering totem poles that dot its landscape, Ketchikan is
                a destination that promises a memorable day, but it is one that requires a
                strategic approach.
              </p>

              {/* Your Arrival at the Port */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Arrival at the Port
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Your port day begins with the most critical piece of information: your ship's
                docking location. Ketchikan operates six primary cruise berths across two
                distinct locations, and understanding which one you arrive at is key to
                planning your day.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The two main landing spots are the downtown berths and the Ward Cove Terminal.
                The downtown berths, designated as 1 through 4, are situated along Tongass
                Narrows and offer immediate and direct walking access to the city's downtown
                core, shops, and key attractions. For most cruise lines, docking at one of
                these downtown berths is the standard procedure. For passengers on these
                vessels, the day's adventure begins the moment they step off the gangway.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                In contrast, the Ward Cove Terminal is a private facility located 3 miles
                north of downtown and is used exclusively by Norwegian Cruise Line (NCL) ships.
                For guests arriving at Ward Cove, a complimentary shuttle service to downtown
                is a necessary first step. This shuttle takes approximately 15 to 20 minutes
                and requires budgeting for a total travel time of 45 to 60 minutes each way,
                including potential wait times. This distinction is critical for time management
                and excursion planning.
              </p>

              {/* Port Overview Table */}
              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan Port Overview
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr
                      className="bg-gray-100"
                      style={{ borderBottom: "2px solid #0E1B4D" }}
                    >
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Feature
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Downtown Berths (1-4)
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Ward Cove Terminal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Location</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Along Tongass Narrows, downtown Ketchikan
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        3 miles north of downtown
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Primary User</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Most cruise lines
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Norwegian Cruise Line (NCL)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Transportation to Downtown</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Immediate walking access
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Free shuttle, 15-20 minute ride
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Best For</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Self-guided walking tours
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Pre-booked tours with Ward Cove pickup
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* CTA 1 - After Port Info */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Explore Alaska's First City?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book your Alaska cruise and discover Ketchikan's totem poles and salmon runs.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Alaska Cruises
                </a>
              </div>

              {/* Your Day, Your Way */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Day, Your Way: Curated Adventures
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan's compact downtown layout is one of its most appealing features,
                allowing for a rich, immersive day without the need for additional transportation.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders: Free & Foundational Experiences
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A self-guided walking tour is a highly recommended and rewarding experience,
                especially for a traveler docking at one of the downtown berths.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-4 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Creek Street:</strong> At the heart of downtown lies Creek Street,
                  a historic boardwalk built on stilts over Ketchikan Creek. Once the city's
                  infamous red-light district, it is now home to quaint shops, art galleries,
                  and restaurants. The history of the area can be explored at Dolly's House
                  Museum. However, the true spectacle of Creek Street is a dynamic ecological
                  drama that unfolds from July to September. During these months, thousands
                  of salmon fight their way upstream to spawn, a display that attracts predators
                  such as bald eagles, harbor seals, and, on occasion, black bears.
                </li>
                <li>
                  <strong>Downtown Landmarks:</strong> Other notable downtown sites are easily
                  accessible on foot. The Southeast Alaska Discovery Center, located just a block
                  from the cruise port, is an excellent first stop, serving as a state-of-the-art
                  facility with interactive exhibits and a free movie about the region's diverse
                  ecosystems. It also provides a welcome, air-conditioned respite from the
                  often-rainy weather. The nearby Tongass Historical Museum offers a deeper look
                  into the city's past, from its fishing industry to its local art scene.
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan's Totems: A Guide to the Parks
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan is widely known as the "Totem Pole Capital of the World," and a visit
                to one of the city's totem parks is a quintessential Alaskan experience.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-4 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Totem Heritage Center:</strong> The most convenient option is the
                  Totem Heritage Center, which is a 15-minute walk from the port. It features
                  a unique collection of "ancient totem poles" recovered from abandoned villages
                  in the region.
                </li>
                <li>
                  <strong>Saxman Native Village:</strong> Located 2 miles south of downtown,
                  this is a "living Native village" that offers visitors a rare opportunity to
                  witness traditional songs and dances, and learn about carving and canoe making.
                  Independent travel to Saxman is possible via a public bus for $2 per person,
                  or by taxi for a fare of $18 to $22.
                </li>
                <li>
                  <strong>Totem Bight State Historical Park:</strong> For travelers prioritizing
                  natural scenery, this park is located about 10 miles north of downtown and
                  features hiking trails through an old-growth rainforest. Admission is $5.
                </li>
              </ul>

              {/* CTA 2 - After Totems */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Experience Native Alaskan Culture
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Discover the world's largest collection of totem poles on your Alaska cruise.
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
                Excursions Beyond the Port: High-Impact Adventures
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/2026315/pexels-photo-2026315.jpeg"
                  alt="Floatplane flying over the stunning misty fjords with kayakers visible on the water below"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For those with a bigger budget or a desire for a more structured experience,
                Ketchikan offers a range of high-impact excursions.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-4 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>The Great Alaskan Lumberjack Show:</strong> This is a highly popular
                  and family-friendly option. The show features world-champion athletes competing
                  in events like speed climbing, powersaw races, and log rolling. The stadium is
                  covered with heaters and padded seats, making it an excellent choice regardless
                  of the weather. While a ticket may cost around $60 through a cruise line, a
                  traveler can save money by purchasing a ticket in town for approximately $37.
                </li>
                <li>
                  <strong>Misty Fjords Flightseeing Tour:</strong> The Misty Fjords National
                  Monument is often referred to as the "Yosemite of the North" and spans 3,570
                  square miles of pristine wilderness. A flightseeing tour is the only way to
                  fully appreciate this vast and spectacular landscape during a single port day.
                  The cost is significant, ranging from $359 to $409 per person.
                </li>
                <li>
                  <strong>Wildlife Encounters:</strong> Bear viewing is highly dependent on the
                  salmon run, which attracts bears to the creeks. Therefore, peak bear-viewing
                  opportunities are typically limited to the months from late July to September.
                  Tours to locations like Traitor's Cove cost around $450 to $489 per person.
                </li>
              </ul>

              {/* The Ketchikan Table */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Ketchikan Table: A Culinary Expedition
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/1123250/pexels-photo-1123250.jpeg"
                  alt="Perfectly battered and fried halibut fish and chips served with coleslaw"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan's self-proclaimed title as the "Salmon Capital of the World" promises
                an exceptional culinary experience centered around fresh seafood. A traveler can
                find a wide range of options, from high-cost delicacies to more affordable, local fare.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A few dishes are considered essential for any visitor's palate:
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>King Crab:</strong> A true Alaskan experience, King Crab comes with a
                  significant price tag. A two-pound portion at one restaurant can cost around
                  $219.95, while a single "killer claw" can be over $100.
                </li>
                <li>
                  <strong>Halibut Fish & Chips:</strong> This classic Alaskan pub fare is a
                  staple and can be found for around $30 to $35.
                </li>
                <li>
                  <strong>Local Seafood:</strong> A variety of other local seafood is available,
                  including salmon, often prepared as fish and chips, tacos, or chowder.
                </li>
              </ul>

              {/* CTA 3 - After Food */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Taste Alaska's Seafood Capital
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  From fresh salmon to king crab, experience Ketchikan's legendary seafood.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  View Alaska Itineraries
                </a>
              </div>

              {/* Survival Guide */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Ketchikan Survival Guide
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Getting Around Like a Pro: A Transportation Guide
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Taxis:</strong> Taxis are plentiful, but most do not use a meter.
                  It is a recommended practice to agree on the fare with the driver before
                  beginning the journey. A taxi ride to Saxman Village costs between $18 and $22.
                </li>
                <li>
                  <strong>Public Bus:</strong> The public bus system, known as the "jitney," is
                  an excellent and affordable alternative. A free downtown shuttle runs every 20
                  minutes, while other routes service rural areas of the city. A single bus fare
                  is $2 for an adult, with a day pass available for $5.
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Weathering the "Liquid Sunshine"
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg"
                  alt="Traveler dressed in layers with waterproof jacket on a misty scenic trail in Ketchikan's rainforest"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan has earned the moniker of the "Rain Capital of Alaska," with an average
                annual rainfall of 141 inches. A traveler should understand that embracing the rain
                is key to a successful visit. Packing a waterproof jacket and layered clothing is
                essential. The city's weather also makes indoor activities, such as museum visits
                or the covered Lumberjack Show stadium, excellent choices for a port day.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Staying Savvy & Safe
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan is generally considered a safe destination for cruise passengers. As with
                any tourist destination, a traveler should exercise common sense and situational
                awareness. It is advisable to stick to well-traveled areas and to keep valuable
                items out of sight. A simple but crucial tip is to avoid displaying the cruise ship
                lanyard, which can make a person a target.
              </p>

              {/* Perfect Day Itineraries */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Perfect Day: Crafted Itineraries
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Itinerary 1: The Self-Guided History Buff
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This itinerary is for the independent traveler who docks downtown and values
                culture, history, and a low-cost, walkable experience.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Morning:</strong> Upon disembarking, begin with a visit to the Southeast
                    Alaska Discovery Center. Then, stroll to the nearby Tongass Historical Museum.
                  </li>
                  <li>
                    <strong>Midday:</strong> Walk to Creek Street to explore the historic boardwalk
                    and Dolly's House Museum.
                  </li>
                  <li>
                    <strong>Afternoon:</strong> Continue the walk to the Totem Heritage Center to see
                    the collection of preserved totem poles. For lunch, enjoy an authentic and affordable
                    meal of halibut fish and chips at a local eatery.
                  </li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Itinerary 2: The Family Thrill-Seeker
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This plan combines a high-energy show with a scenic stroll, offering a balance of
                entertainment and nature. This can work for travelers from both downtown and Ward Cove.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Morning:</strong> The day's first stop is the Great Alaskan Lumberjack Show.
                    For those arriving at Ward Cove, take the shuttle to downtown first. A traveler can
                    save money by purchasing tickets independently upon arrival.
                  </li>
                  <li>
                    <strong>Midday:</strong> Following the show, take a stroll on Creek Street, walking
                    to the upper end to find the fish ladder for a potential glimpse of the salmon run.
                    Enjoy a quick and delicious lunch at a local spot.
                  </li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Itinerary 3: The All-In Adventurer
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This itinerary is for the traveler seeking a premier, high-impact excursion. It is
                best suited for those who have pre-booked their main tour.
              </p>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Morning:</strong> After arriving via the Ward Cove shuttle or walking from
                    downtown, board a pre-arranged floatplane tour to the Misty Fjords National Monument.
                    For those visiting in late summer, a bear-viewing tour is an excellent alternative.
                  </li>
                  <li>
                    <strong>Midday:</strong> After the tour, a traveler can take a taxi or bus to Saxman
                    Native Village for a cultural experience.
                  </li>
                  <li>
                    <strong>Evening:</strong> Conclude the day with a high-end dinner. A stop at a
                    restaurant specializing in King Crab offers the opportunity to enjoy an authentic
                    Alaskan delicacy as the day's memorable splurge.
                  </li>
                </ul>
              </div>

              {/* CTA 4 - After Itineraries */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Plan Your Perfect Ketchikan Day
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Get the best deals and onboard credit when you book your Alaska cruise with Zipsea.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Your Alaska Cruise
                </a>
              </div>

              {/* Before You Sail Away */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Before You Sail Away
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A day in Ketchikan presents a series of strategic choices that dictate the traveler's
                experience. The most critical decision is determined by the ship's docking location,
                which establishes whether the day will begin with immediate, walkable exploration or
                a required shuttle ride to the downtown core. From there, a traveler can customize
                their visit to align with their interests and budget. Options range from free,
                self-guided walking tours of a city rich in history and local art to high-cost
                excursions offering access to the region's vast and unparalleled natural wilderness.
                The city's unique climate, with its constant "liquid sunshine," is not a hindrance
                but a part of its identity, creating a verdant rainforest ecosystem that is central
                to the area's charm and wildlife. Ultimately, with a clear understanding of the
                logistics and a tailored itinerary, a day in Ketchikan can be a deeply rewarding
                and unforgettable part of any Alaskan cruise.
              </p>

              {/* Final CTA */}
              <div
                className="mt-12 p-8 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h2
                  className="font-whitney font-black uppercase text-[32px] mb-4"
                  style={{ color: "#0E1B4D", lineHeight: 1 }}
                >
                  Ready to Explore Ketchikan?
                </h2>
                <p
                  className="font-geograph text-[18px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Discover Alaska's First City on your next cruise adventure. Book with Zipsea
                  for exclusive deals and maximum onboard credit.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-8 py-4 bg-[#0E1B4D] text-white font-bold text-[18px] rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Start Planning Your Alaska Cruise
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
