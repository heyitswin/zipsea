"use client";
import Image from "next/image";

export default function BermudaCruiseGuide() {
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
            The Ultimate Cruise Guide to Bermuda
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Port Day Guide to Pink Sand Beaches & British Charm
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
                alt="A stunning aerial shot of a cruise ship docked at the historic Royal Naval Dockyard, with the pastel-colored buildings of the Clocktower Mall in the background"
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
                Bermuda is a destination that defies simple categorization. It is not a typical
                Caribbean island; rather, it is a British Overseas Territory in the North Atlantic
                that has cultivated a unique identity blending British sophistication, a relaxed
                island lifestyle, and the convenience of a modern tourist hub. For the cruise
                traveler, the experience is shaped from the very first moment ashore by a key
                distinction from other destinations: a triad of distinct cruise ports, each
                offering a fundamentally different arrival experience.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Royal Naval Dockyard:</strong> The largest and busiest port, handling
                  over 500,000 tourists annually. Features Kings Wharf and Heritage Wharf with
                  shopping, museums, restaurants, and pubs right at the pier.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>City of Hamilton:</strong> Offers a more intimate experience for smaller
                  ships with immediate immersion in Bermuda's sophisticated island culture.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Town of St. George's:</strong> UNESCO World Heritage Site on the eastern
                  end, welcoming small and medium ships with centuries-old architecture.
                </p>
              </div>

              {/* Your Arrival At The Port */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Arrival At The Port
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/8017046/pexels-photo-8017046.jpeg"
                  alt="A view of the ferry in Hamilton Harbour, with the colorful pastel buildings of Front Street in the background"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Arrival at Royal Naval Dockyard
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For the majority of cruise passengers, the day begins at the Royal Naval Dockyard.
                This former naval base, which once served as a vital British stronghold, has been
                transformed into a modern, 24-acre tourist hub. Upon disembarking, travelers find
                themselves in a bustling complex that offers a wide array of amenities directly at
                the pier. These include the Bermuda National Museum, boutiques, cafes, and a variety
                of recreational activities.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The Dockyard is considered a walkable destination, with a full stroll from one end
                to the other taking less than 30 minutes. For many, the critical first decision is
                whether to stay within the Dockyard's convenient confines or to venture out to
                explore the central or eastern parts of the island.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Getting Around: Taxis, Buses & Ferries
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                One of the most defining characteristics of a Bermuda port day is the need for
                efficient transportation. Taxis are ubiquitous but expensive. The island's robust
                public transportation network becomes not just a utility but a central, enjoyable
                part of the island experience.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Transportation Pass - Best Value:
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  A one-day pass costs approximately $19 and offers unlimited travel on both buses
                  and ferries. Can be purchased at Visitor Information Centres at the Dockyard or
                  Hamilton Ferry Terminal. Some cruise lines (like Norwegian) provide complimentary
                  ferry service to St. George's.
                </p>
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
                        Destination
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Mode of Transport
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
                        Time
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Value Proposition
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                        rowSpan={3}
                      >
                        <strong>Hamilton City</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Ferry (Blue Route)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        $5 one-way
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        20 min
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Fastest and most scenic
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Bus (Route #8)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        $5 one-way
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~60 min
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Most direct bus route
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Taxi
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~$54 one-way
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~45 min
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Door-to-door, best for groups
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                        rowSpan={2}
                      >
                        <strong>Horseshoe Bay</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Bus (Route #7)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~$5 one-way
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~30 min
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Scenic ride, multiple beach stops
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Taxi/Shuttle
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~$38 taxi / $16 shuttle
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        ~20 min
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Shuttle from Dockyard available
                      </td>
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
                  src="https://images.pexels.com/photos/1209029/pexels-photo-1209029.jpeg"
                  alt="A view of Horseshoe Bay's pink sand and turquoise water, with a cruise ship visible in the distance"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Bermuda's key attractions are not clustered in a single area, which means a
                traveler's day is defined by a focused choice: will it be a day on the beach,
                a journey through history, or an island-wide exploration? The island offers
                distinct experiences that are geographically separated from the main cruise port,
                requiring a strategic approach to time and transportation.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Royal Naval Dockyard:</strong> A destination in itself with the Bermuda
                  National Museum, boutiques, cafes, and pubs all within walking distance.
                </li>
                <li>
                  <strong>Town of St. George's:</strong> UNESCO World Heritage Site, oldest
                  continuously occupied British settlement in the New World. Features King's Square,
                  Bermuda Old State House (1620), and St. Peter's Church.
                </li>
                <li>
                  <strong>Fort St. Catherine:</strong> Historic fort with stunning views and
                  centuries of military history.
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Beachy Keen: Sun, Sand & Sea
              </h3>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Horseshoe Bay Beach - The Must-Visit:
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Famous for its pink sand created by crushed coral and shell particles. Amenities
                  include lifeguards, restrooms, showers, and concession stand. Lounge chairs:
                  $10-$18, Umbrellas: $15. Pro tip: Walk east or west to find quieter coves like
                  Jobson's Cove, Stonehole Bay, and Warwick Long Bay.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Beyond the Port: Must-Do Excursions
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Crystal & Fantasy Caves:</strong> Awe-inspiring geological formations
                discovered in the early 1900s, featuring stunning stalagmites and delicate
                limestone formations suspended over a crystal-clear underground lake. Admission:
                $24 for single cave, $35 for combination ticket (transportation not included).
              </p>

              {/* Water Excursions Table */}
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
                        Excursion Type
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Cost (per person)
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Key Highlights
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Glass-Bottom Boat & Snorkel</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        $79.99 Adult / $59.99 Child
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        View shipwrecks and coral reefs
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Rising Son Catamaran</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        $95 Adult / $75 Child
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Sail, snorkel, and water sports
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Hartley's Helmet Diving</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        $150 Adult / $130 Child
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Walk on seabed, no swimming required
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                  Planning Your Bermuda Port Day?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book through Zipsea to get maximum onboard credit for your
                  Bermuda cruise adventure.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Bermuda Cruises
                </a>
              </div>

              {/* Dining */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Bermudian Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/32974315/pexels-photo-32974315.jpeg"
                  alt="A close-up shot of a classic Bermuda fish sandwich on raisin bread, with a side of fries"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Bermuda's culinary scene is rooted in its maritime history and has evolved to
                create dishes that are distinct to the island. Engaging with the local food
                scene is an essential part of the cultural experience.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Recommended Dining
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Art Mel's Spicy Dicy:</strong> Home of Bermuda's famous fish sandwich,
                  serving hefty fillets on soft raisin bread with homemade tartar sauce.
                </li>
                <li>
                  <strong>The Swizzle Inn:</strong> Historic pub known for traditional English food,
                  famous fish sandwich, and signature Rum Swizzle cocktail.
                </li>
                <li>
                  <strong>Frog & Onion Pub:</strong> Located in the Dockyard, Bermuda's only brewpub
                  with traditional fare and local beers brewed on-site.
                </li>
              </ul>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Must-Try Local Specialties:
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• <strong>The Ultimate Fish Sandwich:</strong> Fried local fish (wahoo, snapper,
                  or grouper) on sweet raisin bread with tartar sauce, coleslaw, and hot sauce</li>
                  <li>• <strong>Bermuda Fish Chowder:</strong> National dish with Gosling's Black Seal
                  Rum and Outerbridge's Sherry Peppers Sauce</li>
                  <li>• <strong>Dark 'n Stormy:</strong> Gosling's Black Seal Rum with ginger beer</li>
                  <li>• <strong>Rum Swizzle:</strong> Sweet and fruity rum cocktail</li>
                </ul>
              </div>

              {/* Family Section */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                For the Whole Crew: Bermuda with Kids
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
                  alt="A family playing on the pink sand of a quiet beach"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Bermuda is a fantastic port for families, offering a blend of historic adventures
                and natural wonders that are perfect for all ages. The key to a successful family
                day is finding a balance between convenience and engaging activities.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Royal Naval Dockyard:</strong> Mini-golf, interactive tours, and the Bermuda
                  National Museum all within walking distance.
                </li>
                <li>
                  <strong>Crystal & Fantasy Caves:</strong> An awe-inspiring real-life adventure with
                  glowing underground lakes and delicate formations.
                </li>
                <li>
                  <strong>St. George's:</strong> Frame the historic town as a treasure hunt for young
                  explorers with preserved forts and centuries-old architecture.
                </li>
                <li>
                  <strong>Horseshoe Bay Beach:</strong> Lifeguards and concession stand provide a secure
                  environment. Jobson's Cove offers calm, secluded swimming for families.
                </li>
              </ul>

              {/* Survival Guide */}
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
                On the Ground: Currency, Tipping, and Getting Around
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Currency:</strong> Bermudian dollar (BD$) is pegged to U.S. dollar at 1:1.
                  U.S. currency accepted everywhere. Carry small U.S. bills for minor purchases and
                  tipping.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Tipping:</strong> Many restaurants automatically include 17% service charge.
                  Check your bill to prevent double-tipping. For other services, 10-15% is standard
                  for taxi drivers.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Electric Mini-Cars:</strong> Non-residents cannot rent regular cars, but can
                  rent two-passenger electric vehicles (Twizy or YoYo) for $130-$190 per day.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Weather Essentials: What to Expect
              </h3>

              {/* Weather Table */}
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
                        Season
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Avg High (°F)
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Avg Low (°F)
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Key Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>High Season</strong> (Jun-Sep)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        82-85
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        74-78
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Hottest, perfect for beach days
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Cool Season</strong> (Dec-Apr)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        68-71
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        60-64
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Mild, ideal for sightseeing
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Spring/Autumn</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        70-81
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        60-77
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Pleasant with less crowds
                      </td>
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

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Critical Legal Warning:
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Bermuda Customs routinely boards visiting cruise ships with drug-sniffing dogs.
                  Persons found with any illegal drugs in their cabin will be arrested. Your home
                  country's laws do not apply here. Having a prescription for marijuana or other
                  drugs illegal in Bermuda will not protect you from prosecution.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Non-residents are not permitted to drive four-wheeled vehicles (except electric
                  mini-cars). Exercise extreme caution if renting a scooter due to local driving
                  practices and high accident rates.
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Bermuda is considered a very safe destination with low violent crime rates. However,
                like any tourist area, petty crime can occur. Visitors are advised to dress down,
                avoid displaying large amounts of cash or expensive valuables, and be aware of their
                surroundings.
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
                  Ready to Explore Bermuda?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Get the best deals and maximum onboard credit when you book your
                  Bermuda cruise with Zipsea.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Browse Bermuda Cruises
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
                A day in Bermuda is an experience that rewards preparation and a strategic mindset.
                The unique layout of its cruise ports and the geographic spread of its key attractions
                require a traveler to make informed decisions about time, money, and transportation.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                By understanding the different modes of transport, choosing a curated adventure that
                fits their interests, and being aware of the critical legal and cultural nuances, a
                visitor can turn a brief port call into a rich and deeply rewarding adventure. A day
                here is not just a visit; it is a journey that will leave a lasting impression.
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
