"use client";
import Image from "next/image";

export default function KetchikanCruiseGuide() {
  return (
    <>
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
            Alaska's First City & The Salmon Capital of the World
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
                src="https://images.unsplash.com/photo-1559827260-dc66d52bef19"
                alt="Creek Street in Ketchikan, Alaska - colorful historic buildings on stilts over the water"
                fill
                className="object-cover"
              />
            </div>

            {/* Introduction */}
            <div className="prose prose-lg max-w-none">
              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Known as Alaska's "First City" and the "Salmon Capital of the
                World," Ketchikan offers cruise passengers an authentic glimpse
                into Southeast Alaska's rich cultural heritage and stunning
                natural beauty. This historic fishing town, built on stilts
                along the waterfront and climbing the steep hillsides, preserves
                both Native Alaskan traditions and the rowdy spirit of its
                frontier past.
              </p>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                With the world's largest collection of standing totem poles, the
                historic Creek Street boardwalk, and some of the best salmon
                fishing in Alaska, Ketchikan provides a perfect introduction to
                the Last Frontier. The town's compact downtown area is easily
                walkable from the cruise docks, making it convenient for
                independent exploration.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Population:</strong> Approximately 8,500 residents
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Annual Rainfall:</strong> 150+ inches (earning it the
                  nickname "Rain Capital of Alaska")
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Peak Season:</strong> May through September, with up
                  to 4 ships daily bringing 11,000+ visitors
                </p>
              </div>

              {/* Getting Around Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Getting Around Ketchikan
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan has four cruise ship berths, with most ships docking
                within walking distance of downtown. Berths 1 and 2 are closest
                to downtown (5-minute walk), Berth 3 is about 0.5 miles away,
                and Berth 4 at Ward Cove is 8 miles north with complimentary
                shuttles provided.
              </p>

              {/* Transportation Image */}
              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1580837119756-563d608dd119"
                  alt="Ketchikan waterfront with colorful buildings reflecting in the harbor"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Transportation Options
                </h3>
                <ul className="space-y-2">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Walking:</strong> Downtown is easily walkable from
                    Berths 1-3
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Local Bus:</strong> "The Bus" runs every 30
                    minutes ($2 fare)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Taxi:</strong> Available at the dock (about $20 to
                    Totem Bight)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Duck Tour:</strong> Amphibious vehicle tours
                    depart near the dock
                  </li>
                </ul>
              </div>

              {/* Top Attractions Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Top Attractions & Excursions
              </h2>

              {/* Misty Fjords Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1556075798-4825dfaaf498"
                  alt="Misty Fjords National Monument aerial view"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Misty Fjords National Monument
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Experience the breathtaking beauty of this 2.2-million-acre
                wilderness by floatplane or boat. Soar over dramatic fjords,
                pristine lakes, and 3,000-foot granite cliffs in what's often
                called the "Yosemite of the North." Floatplane tours often
                include a water landing on a remote mountain lake. Duration: 2-4
                hours, Price: $$$$, Activity Level: Easy
              </p>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Creek Street & Downtown Walking
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Walk the historic Creek Street boardwalk, once Ketchikan's
                red-light district, now home to shops, galleries, and
                restaurants built on stilts over Ketchikan Creek. Watch salmon
                jump up the creek (in season) and explore Married Man's Trail.
                Free to explore independently.
              </p>

              {/* Creek Street Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1614094082869-cd4e4b2905c7"
                  alt="Historic Creek Street boardwalk in Ketchikan"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Great Alaskan Lumberjack Show
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Watch professional lumberjacks compete in traditional timber
                    sports including log rolling, axe throwing, and speed
                    climbing. Perfect for families. Duration: 1.5 hours | Price:
                    $$
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Totem Bight State Park
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Explore 14 replica totem poles and a recreated Native clan
                    house. Learn about Tlingit and Haida cultures while walking
                    through coastal rainforest. Duration: 2.5 hours | Price: $$
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Alaska Rainforest Zipline
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Soar through the Tongass rainforest canopy on ziplines and
                    suspension bridges. Combines thrills with education about
                    the temperate rainforest ecosystem. Duration: 3 hours |
                    Price: $$$
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Bering Sea Crab Fishermen's Tour
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Board the Aleutian Ballad (featured on Deadliest Catch) for
                    a 3-hour adventure. Watch crab fishing demonstrations and
                    enjoy fresh Dungeness crab. Duration: 3 hours | Price: $$$
                  </p>
                </div>
              </div>

              {/* Dining Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Where to Eat & Drink
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan's dining scene celebrates its maritime heritage with
                fresh seafood taking center stage. From casual fish and chips to
                upscale dining with harbor views, there's something for every
                taste and budget.
              </p>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Must-Try Restaurants
                </h3>
                <ul className="space-y-3">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>The Fish House:</strong> Fresh Alaska seafood on
                    pilings over the water. Try the halibut and chips or king
                    crab legs.
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Bar Harbor Ale House:</strong> Local microbrews and
                    fresh halibut with harbor views. Great selection of Alaska
                    beers.
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Annabelle's Keg & Chowder House:</strong> Historic
                    saloon atmosphere with excellent seafood chowder and crab
                    cakes.
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Burger Queen (food truck):</strong> Near the tunnel
                    - amazing halibut burgers that locals swear by.
                  </li>
                </ul>
              </div>

              {/* Shopping Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Shopping & Souvenirs
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                While downtown has numerous shops catering to cruise passengers,
                look for authentic Alaska-made products. The best souvenirs are
                those that capture Ketchikan's unique character as a fishing and
                Native culture hub.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Authentic Local Products
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Smoked salmon from local processors
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Native art with authenticity certification
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Ulu knives (traditional cutting tool)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Alaska berry jams and preserves
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Where to Shop
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Soho Coho:</strong> Authentic local art
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Salmon Landing Market:</strong> Salmon products
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Creek Street shops:</strong> Various galleries
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Southeast Alaska Discovery Center:</strong>{" "}
                      Museum shop
                    </li>
                  </ul>
                </div>
              </div>

              {/* Wildlife Calendar Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Wildlife & Best Time to Visit
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan's wildlife viewing opportunities vary by season, with
                salmon runs being the highlight that attracts both tourists and
                local wildlife like bears and eagles.
              </p>

              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Seasonal Wildlife Calendar
                </h3>
                <ul className="space-y-3">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>May-July:</strong> King salmon runs, spring
                    wildflowers, migrating whales
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>June-August:</strong> Sockeye salmon, warmest
                    weather, longest days (18+ hours)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>July-September:</strong> Pink and chum salmon, black
                    bears fishing
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>August-October:</strong> Coho salmon, fall colors,
                    fewer tourists
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Year-round:</strong> Bald eagles (peak
                    November-January)
                  </li>
                </ul>
              </div>

              {/* Essential Tips Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Essential Tips
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    What to Wear
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Waterproof jacket and pants (essential!)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Comfortable waterproof walking shoes
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Layers - weather changes quickly
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Hat with brim for rain protection
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Money & Practical Info
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • US dollars only - no currency exchange needed
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • No sales tax in Alaska
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Free WiFi at Visitor Center
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Tipping: 15-20% for services
                    </li>
                  </ul>
                </div>
              </div>

              {/* Insider Secret */}
              <div className="bg-purple-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  🌟 Local Secret
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  For the best local experience, skip crowded Creek Street
                  during peak hours (10 AM - 2 PM) and visit early morning or
                  late afternoon. Head to Rotary Beach Park for a peaceful walk
                  and possible wildlife sightings - it's where locals go to
                  escape cruise crowds. Download an offline map before leaving
                  the ship as cell service can be spotty.
                </p>
              </div>

              {/* Weather Note */}
              <div className="bg-blue-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Note on Weather
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Ketchikan receives an average of 150+ inches of rain annually.
                  Pack rain gear regardless of when you visit - locals say "If
                  you can't see the mountain, it's raining. If you can see it,
                  it's about to rain!" The rain creates the lush Tongass
                  rainforest that makes Ketchikan special, so embrace it as part
                  of the experience.
                </p>
              </div>

              {/* Final Note */}
              <p
                className="font-geograph text-[18px] leading-relaxed mt-8"
                style={{ color: "#0E1B4D" }}
              >
                Ketchikan perfectly captures Alaska's frontier spirit while
                offering modern amenities for cruise visitors. Whether you're
                seeking adventure in Misty Fjords, cultural immersion at totem
                parks, or simply want to enjoy fresh seafood with harbor views,
                Alaska's First City delivers an authentic and memorable port
                experience.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
