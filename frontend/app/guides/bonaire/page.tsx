"use client";
import Image from "next/image";

export default function BonaireCruiseGuide() {
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
            Bonaire Cruise Port Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Shore-Diving Capital of the World
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
                src="https://images.unsplash.com/photo-1685101260406-5c7ad28ca00b?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Aerial view of Kralendijk waterfront Bonaire"
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
                Welcome to Bonaire, where cruise ships dock right in the heart
                of Kralendijk! This enchanting island defies typical cruise port
                expectations as a premier eco-tourism hub and the shore-diving
                capital of the world. With 86 marked dive sites accessible from
                shore and pristine marine parks encompassing the entire
                coastline, Bonaire offers unmatched convenience with immediate
                walkable access to shops, restaurants, and historic sites.
              </p>

              {/* Port Overview */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Overview: Walkable Paradise
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1616788099418-8e79d076071d?q=80&w=1325&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Kralendijk waterfront with colorful buildings"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The cruise terminals (Town Pier and Customs Pier) are located
                directly in downtown Kralendijk, offering immediate walkable
                access. A five-minute walk from the pier leads to Kaya Grandi,
                the main shopping street. The flat terrain and compact layout
                make exploration effortless from the moment you disembark.
              </p>

              {/* Getting Around */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around Bonaire
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
                  <strong>Kaya Grandi:</strong> 5 minutes from pier - main
                  shopping street
                </li>
                <li>
                  <strong>Fort Oranje:</strong> 5 minutes - 17th-century
                  fortification
                </li>
                <li>
                  <strong>Wilhelmina Park:</strong> 7 minutes - artisan markets
                </li>
                <li>
                  <strong>Terramar Museum:</strong> 10 minutes - island heritage
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
                Bonaire has no public bus system. Taxis operate on
                government-regulated flat rates:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Eden Beach:</strong> $15 for up to 4 people
                </li>
                <li>
                  <strong>Sorobon Beach:</strong> $5 per person (minimum 4
                  people)
                </li>
                <li>
                  <strong>Klein Bonaire Water Taxi:</strong> $25 round-trip
                </li>
                <li>
                  <strong>Rental Pickup:</strong> $45-60/day for dive sites and
                  park access
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Important:</strong> Bonaire Nature Fee of $10 required
                  for cruise passengers using marine park (swimming, snorkeling,
                  kayaking). Children under 12 exempt.
                </p>
              </div>

              {/* Underwater Paradise */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Underwater Paradise
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1708649290066-5f617003b93f?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Underwater snorkeling in Bonaire's clear waters"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Top Dive & Snorkel Sites
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Klein Bonaire:</strong> Uninhabited island with
                  pristine reefs ($25 round-trip)
                </li>
                <li>
                  <strong>Tori's Reef:</strong> Perfect for beginners and
                  families
                </li>
                <li>
                  <strong>Salt Pier:</strong> Sea turtles and abundant marine
                  life
                </li>
                <li>
                  <strong>Andrea I & II:</strong> Popular sites with easy shore
                  access
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
                    Snorkel & BBQ Catamaran
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    All-inclusive with guided snorkeling, BBQ lunch, open bar
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    $125 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Full Island Tour
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Salt flats, pink water, flamingo sanctuary
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    2 hours - $53 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Guided Cave Adventure
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Explore 400+ magnificent caves
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    $129 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Donkey Sanctuary
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Drive-through experience with friendly donkeys
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    Free admission (donations welcome)
                  </p>
                </div>
              </div>

              {/* Local Cuisine */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Local Cuisine & Dining
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1578861256505-d3be7cb037d3?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Goat stew local cuisine in Bonaire"
                  fill
                  className="object-cover"
                />
              </div>

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
                  <strong>Kabritu Stobá:</strong> Slow-cooked goat stew with
                  buttery-soft meat
                </li>
                <li>
                  <strong>Fresh Fish Platters:</strong> Daily catch served
                  grilled or fried
                </li>
                <li>
                  <strong>Kite City Food Truck:</strong> Fish burgers and wraps
                  ($17-40)
                </li>
                <li>
                  <strong>It Rains Fishes:</strong> Upscale dining with ocean
                  views ($30+)
                </li>
              </ul>

              {/* Beach Life */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Beach Life & Family Fun
              </h2>

              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3
                    className="font-geograph font-bold text-[20px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Best Beaches
                  </h3>
                  <ul
                    className="font-geograph text-[16px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Sorobon Beach:</strong> Shallow, calm waters for
                      kids
                    </li>
                    <li>
                      • <strong>Eden Beach:</strong> Family-friendly with
                      facilities
                    </li>
                    <li>
                      • <strong>Lac Bay:</strong> Mangrove tours and kayaking
                    </li>
                    <li>
                      • <strong>No Name Beach:</strong> Klein Bonaire's pristine
                      shore
                    </li>
                  </ul>
                </div>
                <div>
                  <h3
                    className="font-geograph font-bold text-[20px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Land Adventures
                  </h3>
                  <ul
                    className="font-geograph text-[16px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Flamingo Sanctuary:</strong> Pink flamingos in
                      salt flats
                    </li>
                    <li>
                      • <strong>Washington-Slagbaai Park:</strong> Wildlife and
                      trails
                    </li>
                    <li>
                      • <strong>Donkey Sanctuary:</strong> Hundreds of friendly
                      donkeys
                    </li>
                    <li>
                      • <strong>Slave Huts:</strong> Historic white huts along
                      coast
                    </li>
                  </ul>
                </div>
              </div>

              {/* Final Images */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/5727780/pexels-photo-5727780.jpeg"
                    alt="Bonaire diving and marine life"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
                    alt="Flamingos in Bonaire salt flats"
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
                  Vehicle Safety Tip
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Leave rental cars unlocked at remote dive sites to prevent
                  window damage. Never leave valuables visible or unattended.
                  This is local practice due to petty theft concerns.
                </p>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Currency & Tipping
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  US dollars accepted everywhere. Carry small bills for markets
                  and taxis. Tips: 10-15% at restaurants. Inform staff of tip
                  amount before card is swiped.
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
                  Planning a Cruise to Bonaire?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Bonaire and get maximum
                  onboard credit with every booking!
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
