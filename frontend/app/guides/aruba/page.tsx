"use client";
import Image from "next/image";

export default function ArubaCruiseGuide() {
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
            Aruba Cruise Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            One Happy Island in the Southern Caribbean
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
                src="https://source.unsplash.com/PCLabewO7eE/2000x1000"
                alt="A red trolley car traveling down a street next to palm trees in Oranjestad, Aruba"
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
                Welcome to Aruba, the crown jewel of the Southern Caribbean and a destination affectionately known as "One Happy Island." This arid, sun-drenched paradise, a proud member of the ABC islands (Aruba, Bonaire, and Curaçao), is a study in delightful contrasts. On one side, a dramatic, desert-like landscape of cacti and rugged formations awaits the adventurous explorer. On the other, the tranquil western coast is a postcard-perfect vision of powdery white-sand beaches and calm, turquoise waters.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This unique blend of natural beauty and Dutch heritage offers a compelling day ashore for every type of cruiser, from the sun worshipper to the urban explorer.
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
                A port day in Aruba begins the moment a ship pulls into the Oranjestad cruise port. The experience is immediately welcoming, as the Aruba Cruise Terminal is a modern and well-equipped facility. Unlike some other ports with multiple, far-flung terminals, all three of Aruba&apos;s docks share the same modern cruise facilities, ensuring a consistent and straightforward disembarkation process for all visitors.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The most significant advantage of the Aruba port is its prime location. Situated on the northern side of downtown Oranjestad, the port is exceptionally walkable. This is a crucial detail for cruisers, as it means the city&apos;s heart is just a five- to ten-minute stroll away, depending on the specific dock.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Port Facilities:</strong> Modern terminal with air conditioning, restrooms, Port-of-call Center, shops, and ATMs
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Location:</strong> 5-10 minute walk to downtown Oranjestad
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Currency:</strong> Both US dollars and Aruban florins accepted everywhere
                </p>
              </div>

              {/* Accessibility Notes */}
              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Accessibility Notes
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba has made significant efforts to ensure a welcoming experience for travelers with mobility needs. Within the Aruba Cruise Terminal, the facilities offer wheelchair and step-free accessibility. However, wheelchair-accessible vans and taxis can be limited, so it&apos;s recommended to book accessible transportation and tours well in advance.
              </p>

              {/* Top Adventures & Excursions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Day, Your Way: Top Adventures & Excursions
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders: Free & Low-Cost Adventures
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Free Downtown Streetcar:</strong> Double-decker trolley with 360-degree views, operates 10 AM - 5 PM (not Sundays)
                </li>
                <li>
                  <strong>Archaeological Museum:</strong> Free entry to explore island history
                </li>
                <li>
                  <strong>Aruba Aloe Museum:</strong> Complimentary tours of this local industry
                </li>
                <li>
                  <strong>Wilhelmina Park:</strong> Family-friendly park with play area in Oranjestad
                </li>
                <li>
                  <strong>Renaissance Mall & Marketplace:</strong> Shopping within walking distance
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Beachy Keen: Sun, Sand & Sea
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://source.unsplash.com/wS6ZkbMCRvQ/2000x1000"
                  alt="Eagle Beach with white sand and turquoise waters, featuring the famous Fofoti trees"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Eagle Beach:</strong> World-ranked beach with powdery white sand, calm waters, and famous Fofoti trees
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Baby Beach:</strong> Southern tip shallow lagoon, perfect for families (knee to waist deep)
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Palm Beach:</strong> Activity hub with watersports, banana boats, paddleboarding
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Mangel Halto:</strong> Hidden gem for snorkeling with mangrove-lined coast
                </p>
              </div>

              {/* CTA 1 */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Aruba?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book through Zipsea to get maximum onboard credit for your shore excursions and beach activities.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Aruba Cruises
                </a>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Splash-Tastic Escapes: Resorts & Waterparks
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>De Palm Island:</strong> All-inclusive private island - Adults $109 walk-in ($129 with transport), includes lunch buffet, open bar, snorkel gear, banana boat rides
                </li>
                <li>
                  <strong>RIU Palace Day Pass:</strong> Palm Beach access with swim-up bar - Adults $162, Children $80
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Beyond the Port: Must-Do Excursions
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Arikok National Park:</strong> Jeep/ATV tours from $89-99 per person, or rent a Jeep for $299/8 hours (up to 5 people)
                </li>
                <li>
                  <strong>Submarine Tours:</strong> Atlantis Submarine explores two wrecks 130 feet below - $120 per person
                </li>
                <li>
                  <strong>Catamaran Cruises:</strong> Snorkel cruises from $69, dinner cruises $155 per person
                </li>
                <li>
                  <strong>Animal Sanctuaries:</strong> Donkey Sanctuary (free entry, $1 to feed), Philip&apos;s Animal Garden
                </li>
              </ul>

              {/* Dining */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Aruban Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://source.unsplash.com/fPwp9hvL3AQ/2000x1000"
                  alt="Delicious seafood and side dishes ready to be served in Aruba"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Traditional Dishes
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Keshi Yena:</strong> National dish - cheese ball stuffed with spiced meat
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Pastechi:</strong> Flaky deep-fried pastry with cheese, meat, or seafood
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Pan Bati:</strong> Sweet, fluffy cornbread perfect with stews
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Aruba Ariba:</strong> Signature cocktail with rum, vodka, and local liqueur
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Dining Near the Port
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Driftwood:</strong> Downtown Oranjestad, fresh seafood with "Aruban touch"
                </li>
                <li>
                  <strong>Pinchos Grill & Bar:</strong> Over-water dining on a pier, perfect for sunset
                </li>
                <li>
                  <strong>El Gaucho:</strong> Famous for charcoal-grilled Argentinean steaks
                </li>
              </ul>

              {/* Family Section */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                For the Whole Crew: Aruba with Kids
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba is exceptionally welcoming to families, with many attractions within walking distance of the port. Baby Beach and Eagle Beach offer calm, shallow waters perfect for little ones.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Butterfly Farm:</strong> Learn about dozens of butterfly species
                </li>
                <li>
                  <strong>Donkey Sanctuary:</strong> Free entry, interact with rescued animals
                </li>
                <li>
                  <strong>Aruba Aloe Museum:</strong> Free tours showing the plant&apos;s healing properties
                </li>
                <li>
                  <strong>Archaeological Museum:</strong> No-fee option showcasing indigenous history
                </li>
              </ul>

              {/* Transportation */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around: Transportation Options
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://source.unsplash.com/ipZhj319X90/2000x1000"
                  alt="Red and white Arubus public transportation on the road"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Transportation Table */}
              <div className="overflow-x-auto mb-6">
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
                        Transportation Type
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Cost
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Highlights
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Free Streetcar</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Free
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Narrated downtown loop, passes major sites
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Arubus</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        $2.60 one-way, $15 day pass
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Budget-friendly, terminal across from port
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Taxis</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Starts at $7.00
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Most convenient, fixed fares
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Weather & Tips */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Zipsea Survival Guide: Insider Tips
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Weather Essentials
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba enjoys warm temperatures year-round and is located below the hurricane belt, meaning low storm risk. However, sargassum seaweed can affect some beaches from March to October, primarily on eastern and southern shores. West-coast beaches like Eagle Beach and Palm Beach are typically unaffected.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Money & Tipping
              </h3>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Tipping Guidelines:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Restaurants: 10-15% service charge often added; add 5-10% cash for exceptional service</li>
                  <li>• Taxi drivers: 10-15% of fare</li>
                  <li>• Tour guides: 10-20% for good service</li>
                  <li>• US dollars accepted everywhere, no need to exchange currency</li>
                  <li>• Credit cards accepted at major establishments, cash needed for smaller vendors</li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Staying Safe
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba is one of the safest Caribbean destinations with low crime rates. Main tourist areas are regularly patrolled by police. The tap water comes from a reverse-osmosis plant and is completely safe to drink. Practice common-sense precautions in busy areas.
              </p>

              {/* CTA 2 */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready for Your Aruba Adventure?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Get the best deals and maximum onboard credit for your Caribbean cruise with Zipsea.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Your Cruise
                </a>
              </div>

              {/* Closing Section */}
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
                A day in Aruba offers a remarkable variety of experiences, from historic city strolls and tranquil beach escapes to thrilling off-road adventures. The island&apos;s unique blend of Dutch charm and Caribbean flair, combined with its prime port location, empowers travelers to explore with confidence.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Whether you choose a laid-back day on a serene beach, an adventurous trip into the rugged interior, or a deep dive into the local culture, your day here will be the perfect highlight of your cruise.
              </p>

              {/* Return Link */}
              <div className="mt-12 pt-8 border-t border-gray-200 text-center">
                <a
                  href="/destination-port-guides"
                  className="font-geograph text-[16px] text-[#2238C3] hover:underline"
                >
                  ← Back to All Destination Guides
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
