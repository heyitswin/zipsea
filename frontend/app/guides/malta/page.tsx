"use client";
import Image from "next/image";

export default function MaltaCruiseGuide() {
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
            The Ultimate Cruise Guide to Malta
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Port Day Guide to the Mediterranean's Historic Gem
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
                src="https://images.pexels.com/photos/12550261/pexels-photo-12550261.jpeg"
                alt="Aerial view of Valletta's historic harbor with cruise ships and traditional Maltese boats"
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
                Malta, a tiny archipelago in the heart of the Mediterranean, packs 7,000 years of
                history into just 316 square kilometers. This fortress island has been coveted by
                every major Mediterranean power—from the Phoenicians and Romans to the Knights of
                St. John and the British Empire. Today, cruise visitors discover a destination where
                honey-colored limestone cities rise from azure waters, where medieval streets lead
                to baroque masterpieces, and where every stone seems to whisper tales of knights,
                sieges, and maritime glory.
              </p>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For cruise passengers, Malta offers an extraordinarily concentrated cultural experience.
                The capital Valletta, a UNESCO World Heritage Site in its entirety, sits just minutes
                from the cruise terminal. With over 320 monuments in less than half a square kilometer,
                it's officially recognized as one of the most concentrated historic areas in the world.
                Yet Malta is more than monuments—it's a living Mediterranean culture where baroque
                churches host village festas, where fishermen paint eyes on their boats for protection,
                and where the local language uniquely blends Arabic with Italian and English.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Language:</strong> Maltese and English (both official), Italian widely spoken
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Currency:</strong> Euro (€) - Cards widely accepted, ATMs plentiful
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Best Months:</strong> April-June and September-November (avoid August heat)
                </p>
              </div>

              {/* Getting Around Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Getting Around Malta
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Malta's cruise port is brilliantly positioned in the Grand Harbour, one of the
                world's most spectacular natural harbors. Ships dock at the Valletta Waterfront
                in Floriana, a beautifully restored baroque wharf with restaurants, shops, and
                cafés built into 250-year-old warehouses. The location couldn't be more convenient—
                Valletta's city gates are just a 15-minute walk or a quick €10 taxi ride uphill.
              </p>

              {/* Grand Harbour Image */}
              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1555993539-1732b0258235"
                  alt="Grand Harbour Malta with traditional boats and fortifications"
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
                    • <strong>Barrakka Lift:</strong> €1 elevator from waterfront to Upper Barrakka Gardens (must-do!)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Traditional Dgħajsa:</strong> €2 per person water taxi to the Three Cities
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Hop-On Hop-Off Bus:</strong> €20 for routes covering Valletta, Mdina, and more
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Public Bus:</strong> €2 for 2-hour ticket, reaches all major attractions
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Taxi/Bolt:</strong> Fixed rates posted at port, Bolt app works well
                  </li>
                </ul>
              </div>

              {/* Top Attractions Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Must-See Valletta Attractions
              </h2>

              {/* St. John's Co-Cathedral Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1594736797933-d0501ba2fe65"
                  alt="Ornate baroque interior of St. John's Co-Cathedral"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                St. John's Co-Cathedral
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Don't let the austere exterior fool you—stepping inside St. John's Co-Cathedral is
                like entering a golden jewelry box. Every inch of this baroque masterpiece is covered
                in gold leaf, paintings, and marble. The floor contains 400 tombs of Knights of Malta,
                each a unique marble masterpiece. The Oratory houses Caravaggio's largest painting,
                "The Beheading of St. John the Baptist," painted during his stay in Malta.
                Entry: €15, includes audio guide. Tip: Book online to skip lines.
              </p>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Upper Barrakka Gardens & Saluting Battery
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                These gardens offer the best views in Malta—a panoramic sweep across the Grand Harbour
                to the Three Cities. Time your visit for noon to witness the firing of the ceremonial
                cannon, a tradition dating to the Knights. The gardens themselves are a peaceful oasis
                with statues, fountains, and shaded colonnades. Free entry. The Saluting Battery below
                costs €3 and explains the cannon tradition.
              </p>

              {/* Valletta Street Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/12709458/pexels-photo-12709458.jpeg"
                  alt="Traditional Maltese balconies on a narrow Valletta street"
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
                    Grandmaster's Palace
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Former residence of the Grand Masters of the Knights of Malta, now housing
                    the Office of the President. The State Rooms and Armoury showcase one of the
                    world's finest collections of arms and armor. Entry: €12.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Casa Rocca Piccola
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    A 16th-century palace still lived in by Maltese nobility. The Marquis
                    himself often conducts tours through 50 rooms including WWII shelters
                    carved into rock. Entry: €9, tours every hour.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    National Museum of Archaeology
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Houses artifacts from Malta's prehistoric temples (older than the pyramids!),
                    including the famous "Sleeping Lady" and "Venus of Malta" figurines.
                    Entry: €5, essential for history buffs.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Fort St. Elmo & War Museum
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Star-shaped fort that bore the brunt of the 1565 Great Siege. Now houses
                    the National War Museum with sections on the Great Siege and Malta's
                    WWII role. Entry: €10.
                  </p>
                </div>
              </div>

              {/* Beyond Valletta Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Beyond Valletta: Half-Day Excursions
              </h2>

              {/* Mdina Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1597466765990-64ad1c35dafc"
                  alt="Mdina's medieval gates and silent city streets"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Mdina: The Silent City
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Malta's former capital, this medieval walled city sits atop a hill in the island's
                center. With only 300 residents and no cars allowed, Mdina maintains an otherworldly
                quiet that earned its nickname. Walk the narrow alleys, visit St. Paul's Cathedral,
                and don't miss Fontanella Tea Garden's cakes with views across half of Malta.
                30 minutes by taxi (€20-25) or bus 51/52/53 from Valletta (€2).
              </p>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                The Three Cities
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Vittoriosa, Senglea, and Cospicua—collectively known as the Three Cities—face
                Valletta across the Grand Harbour. These were the Knights' first home in Malta
                and retain an authentic, less-touristy atmosphere. Vittoriosa's Inquisitor's
                Palace and Maritime Museum merit visits, while Senglea's Gardjola Gardens offer
                spectacular harbor views. Take the traditional dgħajsa boat from the cruise port (€2).
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Blue Grotto Sea Caves
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Weather permitting, boat trips explore these stunning sea caves where
                    sunlight creates ethereal blue illuminations. Best visited before noon.
                    45 minutes by taxi (€30-35), boat trips €8.
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Marsaxlokk Fishing Village
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Picturesque harbor filled with colorful luzzu boats painted with protective
                    eyes. Sunday market is excellent for local produce and seafood. Great
                    seafood restaurants. 30 minutes by taxi (€20-25).
                  </p>
                </div>
              </div>

              {/* Food Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Malta's Food Scene
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Maltese cuisine reflects the island's position at the Mediterranean crossroads,
                blending Sicilian, Arabic, and British influences into something uniquely delicious.
                Don't leave without trying pastizzi (flaky pastries filled with ricotta or peas),
                ftira (Maltese sandwich), and rabbit stew (the national dish).
              </p>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Where to Eat in Valletta
                </h3>
                <ul className="space-y-3">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Nenu the Artisan Baker:</strong> Traditional Maltese ftira and local dishes
                    in a restored bakery. Try the platter for two (€25).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Café Cordina:</strong> Historic café on Republic Street since 1837.
                    Perfect for pastizzi and coffee (€8-12).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Rubino:</strong> Family-run since 1906, serving authentic Maltese cuisine.
                    Rabbit stew is legendary (€15-20).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Harbour Club:</strong> Waterfront dining with harbor views.
                    Fresh seafood and local fish (€20-30).
                  </li>
                </ul>
              </div>

              {/* Shopping Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Shopping in Malta
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Malta offers unique shopping opportunities, from traditional crafts to designer
                boutiques. Republic Street and Merchant Street in Valletta are the main shopping
                arteries, while Ta' Qali Crafts Village showcases local artisans.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Authentic Maltese Products
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Filigree jewelry (silver and gold)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Mdina glass (handblown art pieces)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Gozo lace (handmade)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Limestone sculptures
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Local honey and olive oil
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Best Shopping Spots
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Republic Street:</strong> Main shopping street
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Merchant Street:</strong> Local market (Mon-Sat AM)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Is-Suq tal-Belt:</strong> Food market hall
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Ta' Qali:</strong> Crafts village (taxi needed)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • <strong>Valletta Waterfront:</strong> Duty-free at port
                    </li>
                  </ul>
                </div>
              </div>

              {/* Beach Time Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Beach Options from Port
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                While Malta's beaches require some travel from the cruise port, several beautiful
                options are reachable within 30-45 minutes. Note that many Maltese beaches are
                rocky rather than sandy—bring water shoes.
              </p>

              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Nearest Beach Options
                </h3>
                <ul className="space-y-3">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>St. George's Bay:</strong> Sandy beach with facilities, restaurants,
                    and water sports. 20 minutes by taxi (€15-20).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Balluta Bay:</strong> Small beach in upscale Sliema, good swimming,
                    nearby cafés. 15 minutes by taxi (€12-15).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Pretty Bay:</strong> Sandy beach near Marsaxlokk, less crowded,
                    local atmosphere. 30 minutes by taxi (€20-25).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Blue Lagoon (Comino):</strong> Stunning but requires full day—
                    ferry from Sliema (€20-30 return) plus 90 minutes each way.
                  </li>
                </ul>
              </div>

              {/* Essential Tips Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Essential Tips for Your Malta Port Day
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Practical Information
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Free WiFi throughout Valletta
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • EU roaming charges apply
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Tap water is safe but tastes salty
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Pharmacies close 12-4 PM
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Tipping: Round up or 5-10%
                    </li>
                  </ul>
                </div>

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
                      • Comfortable walking shoes essential
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Sun protection crucial year-round
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Modest dress for churches
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Light layers for wind
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Small bag for narrow streets
                    </li>
                  </ul>
                </div>
              </div>

              {/* Time Planning */}
              <div className="bg-purple-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  ⏰ Sample Port Day Itineraries
                </h3>
                <div className="space-y-4">
                  <div>
                    <p
                      className="font-geograph text-[16px] font-bold mb-1"
                      style={{ color: "#0E1B4D" }}
                    >
                      Culture Focus (6-7 hours):
                    </p>
                    <p
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      Barrakka Lift → Upper Barrakka Gardens → St. John's Co-Cathedral →
                      Grandmaster's Palace → Lunch on Republic Street → Stroll Valletta →
                      Return via waterfront shops
                    </p>
                  </div>
                  <div>
                    <p
                      className="font-geograph text-[16px] font-bold mb-1"
                      style={{ color: "#0E1B4D" }}
                    >
                      Island Explorer (7-8 hours):
                    </p>
                    <p
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      Taxi to Mdina → Explore Silent City → Fontanella tea stop →
                      Continue to Marsaxlokk → Seafood lunch → Return via Blue Grotto
                      (weather permitting)
                    </p>
                  </div>
                </div>
              </div>

              {/* Insider Secret */}
              <div className="bg-blue-50 p-6 rounded-lg mb-8">
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
                  Skip the crowded Upper Barrakka Gardens at noon (cannon firing time) and instead
                  head there early morning or late afternoon for photos without crowds. For the noon
                  cannon, watch from the less-crowded Lower Barrakka Gardens—you'll hear it perfectly
                  and have equally stunning views. Also, download the Bolt app before leaving the ship—
                  it's much cheaper than port taxis and widely available.
                </p>
              </div>

              {/* Weather Note */}
              <div className="bg-yellow-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Weather Considerations
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Malta enjoys 300+ days of sunshine annually, but summer (July-August) can be
                  uncomfortably hot with temperatures exceeding 35°C/95°F. Spring (April-June)
                  and autumn (September-November) offer perfect weather with warm days and cool
                  evenings. Winter is mild but can be windy and rainy. The island's limestone
                  amplifies heat, so summer visitors should plan indoor activities during midday.
                </p>
              </div>

              {/* Final Note */}
              <p
                className="font-geograph text-[18px] leading-relaxed mt-8"
                style={{ color: "#0E1B4D" }}
              >
                Malta rewards curious travelers with layers of history, stunning architecture,
                and warm hospitality packed into one of Europe's smallest nations. Whether you
                spend your day exploring Valletta's baroque splendor, venturing to medieval Mdina,
                or simply soaking up the Mediterranean atmosphere at a harborside café, you'll
                understand why this tiny archipelago has captivated visitors for millennia. The
                island's compact size means you can sample multiple experiences in a single port
                day, yet Malta's depth ensures you'll leave planning a return visit.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
