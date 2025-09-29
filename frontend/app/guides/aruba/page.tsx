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
            The Ultimate Cruise Guide to Aruba
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Port Day Guide to One Happy Island
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
                src="https://images.unsplash.com/photo-1585061016539-ed9b2bd5f29e?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="A stunning, vibrant photo of a colorful street in Oranjestad with the clear Caribbean water in the background"
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
                Welcome to Aruba, the crown jewel of the Southern Caribbean and
                a destination affectionately known as "One Happy Island." This
                arid, sun-drenched paradise, a proud member of the ABC islands
                (Aruba, Bonaire, and Curaçao), is a study in delightful
                contrasts. On one side, a dramatic, desert-like landscape of
                cacti and rugged formations awaits the adventurous explorer. On
                the other, the tranquil western coast is a postcard-perfect
                vision of powdery white-sand beaches and calm, turquoise waters.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This unique blend of natural beauty and Dutch heritage offers a
                compelling day ashore for every type of cruiser, from the sun
                worshipper to the urban explorer. Zipsea is here to help
                navigate this incredible island with confidence, offering
                insider tips and a breakdown of the best ways to make the most
                of every moment.
              </p>

              {/* Your Arrival At The Port */}
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
                A port day in Aruba begins the moment a ship pulls into the
                Oranjestad cruise port. The experience is immediately welcoming,
                as the Aruba Cruise Terminal is a modern and well-equipped
                facility. Unlike some other ports with multiple, far-flung
                terminals, all three of Aruba's docks share the same modern
                cruise facilities, ensuring a consistent and straightforward
                disembarkation process for all visitors.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The most significant advantage of the Aruba port is its prime
                location. Situated on the northern side of downtown Oranjestad,
                the port is exceptionally walkable. This is a crucial detail for
                cruisers, as it means the city's heart is just a five- to
                ten-minute stroll away, depending on the specific dock. This
                direct, step-off-the-ship access to the capital is a major
                departure from many other destinations where a taxi or shuttle
                is necessary to reach the main city center.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Once travelers step into the terminal, they will find a
                welcoming, air-conditioned space offering a variety of
                amenities. These include restrooms, a Port-of-call Center for
                tourist information, and shops selling a wide array of goods,
                from local handicrafts and souvenirs to Dutch delicacies and
                Delft items. An ATM is also located within the terminal,
                dispensing both American dollars and the local Aruban florin.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Accessibility Notes: Navigating the Port and Beyond
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba has made significant efforts to ensure a welcoming
                experience for travelers with mobility needs. Within the Aruba
                Cruise Terminal, the facilities offer wheelchair and step-free
                accessibility, providing a smooth path from the ship to the port
                exit. However, navigating the island beyond the port requires
                some advance planning.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Important:</strong> While wheelchair-accessible vans
                  and taxis are available at the port, the supply of these
                  specialized vehicles can be limited. It is highly recommended
                  that travelers with mobility needs book accessible
                  transportation and tours well in advance, even weeks or months
                  ahead of their trip.
                </p>
              </div>

              {/* Top Adventures & Excursions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Day, Your Way: Top Adventures & Excursions
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba is a playground of options, from budget-friendly walks
                through the capital to thrilling off-road adventures. The
                island's compact size and diverse landscape mean that a wide
                variety of experiences are accessible, allowing travelers to
                tailor their day to their unique interests and budget.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders: Free & Low-Cost Adventures
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                One of the most appealing aspects of a port day in Aruba is the
                ability to have a rich, immersive experience without spending a
                dollar on transportation. The port's direct connection to
                downtown Oranjestad makes it incredibly easy to start a
                self-guided walking tour.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Free Streetcar/Trolley:</strong> Provides
                  complimentary narrated transportation in a loop from the
                  cruise terminal to downtown. Operates daily 10 AM - 5 PM
                  (except Sundays).
                </li>
                <li>
                  <strong>Renaissance Mall & Marketplace:</strong> Browse for
                  deals and duty-free shopping within walking distance.
                </li>
                <li>
                  <strong>Archaeological Museum:</strong> Free entry to explore
                  Aruba's indigenous history and culture.
                </li>
                <li>
                  <strong>Aruba Aloe Museum:</strong> Complimentary tour of this
                  major local industry with unique souvenir opportunities.
                </li>
                <li>
                  <strong>Wilhelmina Park:</strong> Features a dedicated play
                  area for kids, offering shaded respite from the tropical sun.
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
                  src="https://images.unsplash.com/photo-1615039836704-6c3829789d0a?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Photo of Eagle Beach with the famous Fofoti trees"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba is world-renowned for its pristine beaches, and choosing
                the right one depends entirely on the desired atmosphere. A taxi
                or the local bus system is the best way to get to most of them.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Eagle Beach:</strong> Consistently ranked as one of
                    the best beaches in the world, perfect for families with its
                    powdery white sand and calm waters. Home to the island's
                    most photographed Fofoti trees.
                  </li>
                  <li>
                    <strong>Baby Beach:</strong> Located on the southern tip,
                    this shallow, sheltered lagoon is ideal for families and
                    beginner snorkelers with knee- to waist-deep water.
                  </li>
                  <li>
                    <strong>Palm Beach:</strong> The island's hub of activity,
                    lined with high-rise hotels and offering watersports
                    including banana boat rides, paddleboarding, and kayaking.
                  </li>
                  <li>
                    <strong>Mangel Halto & Surfside Beach:</strong> For a
                    quieter, more local experience. Mangel Halto is great for
                    snorkeling, while Surfside is family-friendly with shallow
                    waters.
                  </li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Splash-Tastic Escapes: Resorts & Waterparks
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For cruisers who prefer a full-day, all-inclusive experience,
                Aruba offers several resort and private island day passes.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>De Palm Island:</strong> All-inclusive private coral
                  reef island
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Walk-in: $109 adults/teens, $94 children (3-9)</li>
                  <li>
                    • With transportation: $129 adults/teens, $109 children
                  </li>
                  <li>
                    • Includes: lunch buffet, open bar, snorkel gear, banana
                    boat rides
                  </li>
                  <li>
                    • Features: kids' waterpark, splash park, flamingo
                    encounters (with cabana)
                  </li>
                  <li>• Tip: Bring water shoes for the rocky coral shores</li>
                </ul>
                <p
                  className="font-geograph text-[16px] mt-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>RIU Palace:</strong> Day passes from $162 adults, $80
                  children, with access to Palm Beach and swim-up bar
                </p>
              </div>

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
                  <strong>Arikok National Park:</strong> Explore rugged
                  landscapes, ancient caves, and the Natural Pool. Jeep/ATV
                  tours from $89-$99 per person, or rent a Jeep for $299 (8
                  hours, up to 5 people).
                </li>
                <li>
                  <strong>Submarine Tours:</strong> Atlantis Submarine explores
                  two wrecks up to 130 feet below surface for about $120 per
                  person.
                </li>
                <li>
                  <strong>Catamaran & Sailing Cruises:</strong> Snorkel cruises
                  from $69 per person, dinner cruises from $155 per person.
                </li>
                <li>
                  <strong>Animal Sanctuaries:</strong> Philip's Animal Garden
                  and the Aruba Donkey Sanctuary (free entry, $1 to feed
                  donkeys).
                </li>
              </ul>

              {/* CTA 1 */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Explore Aruba?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book through Zipsea to get maximum onboard credit and the best
                  deals on your Caribbean cruise.
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Caribbean Cruises
                </a>
              </div>

              {/* Dining */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Aruban Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://plus.unsplash.com/premium_photo-1753126769826-e6b78dac47c3?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Photo of Aruban cuisine or waterfront dining"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A visit to Aruba is incomplete without indulging in its diverse
                and flavorful culinary scene. Aruban cuisine is a tasty mix of
                flavors, spices, and herbs, and its dishes often reflect the
                island's rich colonial past.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Traditional Dishes & Local Libations
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Must-Try Dishes:</strong>
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1 mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • <strong>Keshi Yena:</strong> National dish - cheese ball
                    stuffed with spiced meat
                  </li>
                  <li>
                    • <strong>Pastechi:</strong> Flaky, deep-fried pastry with
                    cheese, meat, or seafood
                  </li>
                  <li>
                    • <strong>Pan Bati:</strong> Sweet, fluffy cornbread perfect
                    with stews
                  </li>
                </ul>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Signature Drinks:</strong>
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • <strong>Aruba Ariba:</strong> Bold cocktail with rum,
                    vodka, and local liqueur
                  </li>
                  <li>
                    • <strong>Balashi Beer:</strong> Local beer brewed with
                    desalinated water
                  </li>
                  <li>
                    • <strong>Awa di Lamunchi:</strong> Refreshing lime water
                    (non-alcoholic)
                  </li>
                </ul>
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
                  <strong>Driftwood:</strong> Downtown Oranjestad, known for
                  fresh seafood with an "Aruban touch" in a rustic driftwood
                  dining room.
                </li>
                <li>
                  <strong>Pinchos Grill & Bar:</strong> Over-water dining on a
                  pier with ideal sunset views.
                </li>
                <li>
                  <strong>El Gaucho:</strong> Famous for charcoal-grilled
                  Argentinean steaks.
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
                Aruba is a destination that is exceptionally welcoming to
                families, with a wide range of activities that appeal to all
                ages. Many of the city's key attractions are within walking
                distance of the port, which saves both time and money on
                transportation, an important consideration for families with
                small children.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Best Beaches for Kids:</strong> Baby Beach and Eagle
                  Beach offer calm, shallow waters safe for little ones.
                </li>
                <li>
                  <strong>Butterfly Farm:</strong> Interactive learning about
                  dozens of butterfly species.
                </li>
                <li>
                  <strong>Animal Sanctuaries:</strong> Philip's Animal Garden
                  and Aruba Donkey Sanctuary (free entry) offer responsible
                  animal interactions.
                </li>
                <li>
                  <strong>Free Museums:</strong> Aruba Aloe Museum
                  (complimentary tour) and Archaeological Museum showcase island
                  history and culture.
                </li>
              </ul>

              {/* Weather & Survival Guide */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Weather Essentials: What to Expect
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba enjoys a tropical climate with warm temperatures
                year-round, making it a reliable destination regardless of the
                season. A significant point of reassurance for travelers is that
                Aruba is located below the main hurricane belt, which means the
                risk of major storms is low.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Sargassum Seaweed Alert (March-October):
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Seaweed can affect eastern and southern shores during these
                  months. The popular west-coast beaches (Eagle Beach, Palm
                  Beach) are typically unaffected, making them your best bet
                  during peak sargassum season.
                </p>
              </div>

              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Zipsea Survival Guide: Insider Tips & Essentials
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Money & Moolah: Navigating the Currency
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba's local currency is the florin (AWG), but the U.S. dollar
                is widely accepted everywhere, eliminating the need to exchange
                money for most purchases. While credit cards are accepted at
                most major establishments, cash is essential for smaller
                vendors, local markets, and especially for taxis and tipping.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Local Etiquette: Tipping & Phrases
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Tipping Guidelines:</strong>
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • Restaurants: 10-15% service charge often added; add 5-10%
                    cash for exceptional service
                  </li>
                  <li>• Taxi drivers: 10-15% of fare</li>
                  <li>• Tour guides: 10-20% for excellent tours</li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Getting Around: Quick Guide
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1581941388120-9761a5f61a47?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="Transportation options in Aruba including the colorful streetcar"
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
                        Convenience
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
                        Excellent
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Narrated downtown loop, passes major sites, 10 AM-5 PM
                        (not Sundays)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Arubus (Bus)</strong>
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
                        Good
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Budget-friendly, terminal across from port, reaches
                        popular beaches
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
                        Excellent
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Most convenient for beaches and Arikok National Park,
                        fixed rates
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Staying Safe, Staying Savvy
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Aruba is considered one of the safest destinations in the
                Caribbean, with a low violent crime rate and a local government
                that works to protect both residents and tourists. The main
                tourist areas are regularly patrolled by police, providing a
                sense of security. It is safe to walk after dark in most
                well-lit, populated areas.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Important Safety Note:
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Aruba's tap water comes from a reverse-osmosis plant and is
                  completely safe to drink - a significant advantage for
                  travelers!
                </p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Scooter Warning:
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Renting scooters is generally not recommended due to safety
                  concerns related to traffic. Stick to taxis or the local bus
                  service for safer transportation.
                </p>
              </div>

              {/* CTA 2 */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Plan Your Perfect Aruba Port Day
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Get the best deals and maximum onboard credit when you book
                  your Caribbean cruise with Zipsea.
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Browse Caribbean Cruises
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
                A day in Aruba offers a remarkable variety of experiences, from
                historic city strolls and tranquil beach escapes to thrilling
                off-road adventures. The island's unique blend of Dutch charm
                and Caribbean flair, combined with its prime port location,
                empowers travelers to explore with confidence.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                With a little planning, whether you choose a laid-back day on a
                serene beach, an adventurous trip into the rugged interior, or a
                deep dive into the local culture, your day here will be the
                perfect highlight of your cruise. With Zipsea, every port is an
                adventure waiting to happen.
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
