"use client";
import Image from "next/image";

export default function BridgetownCruiseGuide() {
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
            Bridgetown Cruise Port Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            UNESCO World Heritage & Caribbean Paradise
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
                alt="Aerial view of Bridgetown Cruise Port Barbados"
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
                Welcome to Bridgetown, Barbados – where UNESCO World Heritage
                architecture meets powder-soft beaches and crystal-clear waters!
                The Deep Water Harbour sits just 1 mile from downtown, providing
                exceptional convenience for independent exploration. This
                vibrant capital offers cruise passengers an immediate entry into
                both relaxation and cultural enrichment, with world-class
                beaches, rum heritage, and the warmth of Bajan hospitality.
              </p>

              {/* Port Overview */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Overview: Gateway to Barbados
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/7241849/pexels-photo-7241849.jpeg"
                  alt="Barbados Parliament Buildings with clock tower"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The Barbados Cruise Port sits strategically 1-1.24 miles west of
                downtown Bridgetown. A complimentary shuttle runs between ships
                and the terminal. The 20-minute walk along Trevor's Way
                oceanside footpath leads directly to historic shopping areas and
                Pelican Craft Centre, making self-guided exploration both
                pleasant and budget-friendly.
              </p>

              {/* Getting Around */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around Bridgetown
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Walking Distance Attractions
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Downtown via Trevor's Way:</strong> 20-25 minutes
                  scenic walk
                </li>
                <li>
                  <strong>Pelican Craft Centre:</strong> 15 minutes from pier
                </li>
                <li>
                  <strong>Broad Street Shopping:</strong> 25 minutes walk
                </li>
                <li>
                  <strong>Parliament Buildings:</strong> 30 minutes through town
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Transportation Options
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Multiple options cater to different budgets and preferences:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Cruise Shuttle:</strong> Often complimentary, 5-10
                  minutes to town
                </li>
                <li>
                  <strong>Taxi:</strong> ~$6 USD to downtown (5 minutes)
                </li>
                <li>
                  <strong>ZR Bus (Minibus):</strong> ~$1.75 USD - authentic
                  local experience
                </li>
                <li>
                  <strong>Walk:</strong> Free - 20-25 minutes along oceanside
                  path
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Taxi Tip:</strong> Always agree on fare and currency
                  (BBD or USD) before starting. ZR buses require exact change in
                  local currency.
                </p>
              </div>

              {/* Beaches */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Beach Paradise
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/5255297/pexels-photo-5255297.jpeg"
                  alt="Carlisle Bay with catamaran and swimmers"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Top Beach Destinations
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Carlisle Bay:</strong> Marine park with 6 shipwrecks,
                  sea turtle swimming ($30-50/person)
                </li>
                <li>
                  <strong>Accra Beach:</strong> Family-friendly south coast with
                  gentle waves
                </li>
                <li>
                  <strong>West Coast Beaches:</strong> Calm, warm waters ideal
                  for swimming
                </li>
                <li>
                  <strong>Brownes Beach:</strong> Closest to port, easy access
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
                    Atlantis Submarine
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Real submarine dive to see marine life
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    2-2.5 hours - $120-159 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Harrison's Cave
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Underground tram tour through stalactite caverns
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    $90-185 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Catamaran Cruise
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Swim with turtles, snorkel shipwrecks, open bar
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    $95 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Mount Gay Rum Tour
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Birthplace of rum tasting experience
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    $27.50-60 per person
                  </p>
                </div>
              </div>

              {/* Historic Bridgetown */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Historic Bridgetown Walking Tour
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The UNESCO-listed historic center rewards self-guided
                exploration with duty-free shopping on Broad Street and local
                crafts at Pelican Village:
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Parliament Buildings:</strong> Striking clock tower
                  and Gothic architecture
                </li>
                <li>
                  <strong>National Heroes Square:</strong> Historic heart of the
                  city
                </li>
                <li>
                  <strong>St. Michael's Cathedral:</strong> Standing since the
                  18th century
                </li>
                <li>
                  <strong>Independence Square:</strong> Waterfront dining along
                  the river
                </li>
              </ul>

              {/* Bajan Cuisine */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Bajan Cuisine & Dining
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/2374946/pexels-photo-2374946.jpeg"
                  alt="Flying Fish and Cou Cou national dish"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Must-Try National Dishes
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Flying Fish & Cou Cou:</strong> National dish with
                  steamed fish and cornmeal-okra polenta
                </li>
                <li>
                  <strong>Pudding & Souse:</strong> Traditional Saturday meal of
                  pickled pork
                </li>
                <li>
                  <strong>Bajan Macaroni Pie:</strong> Unique local take on mac
                  and cheese
                </li>
                <li>
                  <strong>Fish Cakes & Cutters:</strong> Street food staples
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Where to Eat
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Oistins Fish Fry:</strong> Weekend market with grilled
                  fish ($10-25)
                </li>
                <li>
                  <strong>Cuz's Fish Shack:</strong> Best fish cutters on
                  Carlisle Bay ($8-15)
                </li>
                <li>
                  <strong>Brown Sugar Restaurant:</strong> All-you-can-eat
                  Planters Buffet ($35-45)
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
                      • <strong>Carlisle Bay:</strong> Calm waters, close to
                      port
                    </li>
                    <li>
                      • <strong>Accra Beach:</strong> Gentle waves for children
                    </li>
                    <li>
                      • <strong>Turtle Swimming:</strong> Safe, guided
                      experiences
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
                      • <strong>Wildlife Reserve:</strong> Green monkeys &
                      tortoises
                    </li>
                    <li>
                      • <strong>Atlantis Submarine:</strong> Safe underwater
                      adventure
                    </li>
                    <li>
                      • <strong>Glass Bottom Boat:</strong> Marine life viewing
                    </li>
                  </ul>
                </div>
              </div>

              {/* Final Images */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/8925997/pexels-photo-8925997.jpeg"
                    alt="Family playing on Barbados beach"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
                    alt="Mix of Barbadian and US currency"
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

              <div className="bg-yellow-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  ⚠️ Important Legal Note
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Wearing camouflage clothing of any kind is ILLEGAL in Barbados
                  and can result in fines or detention.
                </p>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Currency & Payment
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Barbados Dollar (BBD) is official, but USD widely accepted at
                  2:1 fixed rate. Credit cards accepted at major venues, cash
                  needed for street vendors and buses. 10-15% service charge
                  often included in bills.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Weather & What to Wear
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Year-round 84-88°F with warm sea temperatures. Dry season
                  (Dec-May): Low humidity. Wet season (Jun-Nov): Hot, humid with
                  showers. Bring comfortable walking shoes, sun protection, and
                  swimwear.
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
                  Planning a Cruise to Barbados?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Bridgetown and get
                  maximum onboard credit with every booking!
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Caribbean Cruises →
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
