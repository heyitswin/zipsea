"use client";
import Image from "next/image";

export default function CaboSanLucasCruiseGuide() {
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
            Cabo San Lucas Cruise Port Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Where Pacific Meets Sea of Cortez
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
        style={{ backgroundColor: "#F6F3ED" }}
        className="py-[40px] md:py-[80px]"
      >
        <article className="max-w-4xl mx-auto px-8">
          <div className="bg-white rounded-lg p-8 md:p-12 shadow-sm">
            {/* Hero Image */}
            <div className="relative w-full h-[400px] mb-8 rounded-lg overflow-hidden">
              <Image
                src="https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg"
                alt="Aerial view of Cabo San Lucas Marina and Arch"
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
                Welcome to Cabo San Lucas, where dramatic desert landscapes meet
                pristine beaches at the southern tip of Mexico's Baja California
                Peninsula! This tender port destination offers everything from
                the iconic El Arco rock formation to world-class sport fishing
                and vibrant beach clubs. As cruise ships anchor in the bay,
                passengers are ferried to the marina, where downtown, beaches,
                and shopping are all within walking distance or a short water
                taxi ride.
              </p>

              {/* Port Overview */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Overview: Tender Port Paradise
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/9400836/pexels-photo-9400836.jpeg"
                  alt="Cabo San Lucas Marina with luxury yachts"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Cabo San Lucas is a tender port, meaning cruise ships anchor in
                the bay and passengers are transported to shore via tender
                boats. The tender ride takes approximately 10-15 minutes and
                drops you at the main marina pier. The marina area is
                immediately walkable upon arrival, with restaurants, shops, and
                tour operators all within a few minutes' walk.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Tender Priority:</strong> Book ship excursions or
                  arrive early at the tender meeting point for faster
                  disembarkation. The tender process can take 30-60 minutes
                  during peak times.
                </p>
              </div>

              {/* Getting Around */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around Cabo
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Transportation Options
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Water Taxi:</strong> $5-15 for Medano Beach or El Arco
                  tours (5-10 min)
                </li>
                <li>
                  <strong>Walking:</strong> Free - Marina and downtown within
                  10-20 minutes
                </li>
                <li>
                  <strong>Taxi:</strong> $10-30 to San José del Cabo or remote
                  beaches
                </li>
                <li>
                  <strong>Rental Car:</strong> $40-60/day for exploring the
                  corridor
                </li>
              </ul>

              {/* Iconic Cabo */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Iconic Cabo Experiences
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/4327790/pexels-photo-4327790.jpeg"
                  alt="El Arco rock formation at Land's End"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Must-See Attractions
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>El Arco (The Arch):</strong> Dramatic rock formation
                  at Land's End ($15-20 water taxi)
                </li>
                <li>
                  <strong>Lover's Beach:</strong> Hidden beach accessible only
                  by boat
                </li>
                <li>
                  <strong>Medano Beach:</strong> Main swimming beach with beach
                  clubs
                </li>
                <li>
                  <strong>Marina Cabo San Lucas:</strong> Luxury yachts and
                  waterfront dining
                </li>
              </ul>

              {/* Popular Excursions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Popular Shore Excursions
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Glass Bottom Boat to El Arco
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    See underwater marine life and rock formations
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    45 min - $25-35 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Sport Fishing
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    "Marlin Capital of the World"
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    Half-day charters from $400-600
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    ATV Desert & Beach Tour
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Adventure through desert trails to Pacific beaches
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    3 hours - $80-120 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Sunset Sailing
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Catamaran cruise with open bar
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    $60-80 per person
                  </p>
                </div>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Water Adventures
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Snorkeling:</strong> Pelican Rock and Santa Maria Bay
                  ($45-65/person)
                </li>
                <li>
                  <strong>Whale Watching:</strong> December-April humpback and
                  gray whales ($50-80)
                </li>
                <li>
                  <strong>Tequila Tasting:</strong> Learn about premium tequilas
                  ($45-65)
                </li>
                <li>
                  <strong>Zip Line Adventure:</strong> Canyon zip lines with
                  ocean views ($90-130)
                </li>
              </ul>

              {/* Beach Life */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Beach Life & Water Sports
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/2433868/pexels-photo-2433868.jpeg"
                  alt="Cabo San Lucas beach with resorts"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Best Beaches
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Medano Beach:</strong> Safe swimming, beach clubs,
                  water sports
                </li>
                <li>
                  <strong>Chileno Beach:</strong> Excellent snorkeling, calmer
                  waters
                </li>
                <li>
                  <strong>Santa Maria Bay:</strong> Protected cove for
                  snorkeling
                </li>
                <li>
                  <strong>Lover's Beach:</strong> Secluded, boat access only
                </li>
              </ul>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>⚠️ Swimming Safety:</strong> Pacific side beaches have
                  dangerous rip currents and are not safe for swimming. Stick to
                  Medano Beach or protected bays on the Sea of Cortez side.
                </p>
              </div>

              {/* Cabo Cuisine */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Cabo Cuisine & Dining
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Must-Try Local Dishes
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Fish Tacos:</strong> Battered or grilled with cabbage
                  slaw
                </li>
                <li>
                  <strong>Chocolate Clams:</strong> Local delicacy grilled with
                  garlic
                </li>
                <li>
                  <strong>Ceviche:</strong> Fresh fish marinated in lime juice
                </li>
                <li>
                  <strong>Margaritas:</strong> Cabo's signature cocktail
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Recommended Restaurants
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>The Office on the Beach:</strong> Beachfront dining
                  ($15-30)
                </li>
                <li>
                  <strong>Solomon's Landing:</strong> Marina views with seafood
                  ($20-35)
                </li>
                <li>
                  <strong>Cabo Wabo Cantina:</strong> Sammy Hagar's bar with
                  live music ($15-25)
                </li>
                <li>
                  <strong>Mi Casa:</strong> Authentic Mexican in courtyard
                  ($12-20)
                </li>
              </ul>

              {/* Family Fun */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Family-Friendly Activities
              </h2>

              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3
                    className="font-geograph font-bold text-[20px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Kid-Friendly Beaches
                  </h3>
                  <ul
                    className="font-geograph text-[16px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Medano Beach:</strong> Calm waters, rentals
                    </li>
                    <li>
                      • <strong>Chileno Beach:</strong> Snorkeling paradise
                    </li>
                    <li>
                      • <strong>Santa Maria:</strong> Protected cove
                    </li>
                  </ul>
                </div>
                <div>
                  <h3
                    className="font-geograph font-bold text-[20px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Family Adventures
                  </h3>
                  <ul
                    className="font-geograph text-[16px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Glass Bottom Boat:</strong> Marine viewing
                    </li>
                    <li>
                      • <strong>Camel Safari:</strong> Beach camel rides
                    </li>
                    <li>
                      • <strong>Dolphin Encounter:</strong> Interactive programs
                    </li>
                  </ul>
                </div>
              </div>

              {/* Final Images */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/889929/pexels-photo-889929.jpeg"
                    alt="Cabo San Lucas nightlife and bars"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
                    alt="Mexican pesos and US dollars currency"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Insider Tips */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Insider Tips
              </h2>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Currency & Vendors
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  US dollars widely accepted. Beach vendors persistent but
                  harmless - polite "no gracias" works. Negotiate souvenirs -
                  start at 50% of asking price. Small bills recommended for tips
                  and taxis.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Weather & Best Times
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Year-round sunshine with 350+ days of sun. October-May:
                  Perfect weather, whale watching season. June-September: Hot
                  and humid with occasional brief showers. Water temperature:
                  72-82°F year-round.
                </p>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Shopping Tips
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Puerto Paraiso Mall near marina for duty-free shopping. Local
                  markets for authentic crafts. Tequila and vanilla are good
                  values. Avoid buying prescription medications.
                </p>
              </div>

              {/* CTA Box */}
              <div
                className="bg-gray-50 p-8 rounded-lg mt-12 text-center"
                style={{ borderLeft: "4px solid #F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cabo?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of Mexican Riviera cruises and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises?region=mexico"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Mexican Riviera Cruises →
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
