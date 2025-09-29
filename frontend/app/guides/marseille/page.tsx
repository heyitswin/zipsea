"use client";
import Image from "next/image";
import Link from "next/link";

export default function MarseilleCruiseGuide() {
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
            The Ultimate Cruise Guide to Marseille
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Port Day Guide to France's Gateway to Provence
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
                src="https://images.pexels.com/photos/11690121/pexels-photo-11690121.jpeg"
                alt="Panoramic view of Marseille's Old Port with boats and the Notre-Dame de la Garde basilica on the hill"
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
                Marseille, France's second-largest city and Europe's oldest port, offers cruise
                passengers a vibrant gateway to Provence and the French Riviera. Founded by Greek
                sailors 2,600 years ago, this Mediterranean metropolis pulses with a raw energy
                that sets it apart from France's more polished destinations. Here, North African
                souks meet Provençal markets, ancient history collides with contemporary art, and
                the legendary bouillabaisse is served in waterfront restaurants where fishermen
                have gathered for centuries.
              </p>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For cruise visitors, Marseille serves as both a fascinating destination and a
                strategic launching point. The city itself rewards exploration with its dramatic
                basilica overlooking the sea, vibrant neighborhoods like Le Panier, and world-class
                museums. Yet it also provides easy access to Provence's lavender fields,
                Aix-en-Provence's elegant boulevards, the medieval papal palace of Avignon, and
                even the glittering Côte d'Azur. With excellent transport links and a port just
                minutes from the city center, Marseille offers more possibilities per port day
                than almost any other Mediterranean stop.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Language:</strong> French (English widely spoken in tourist areas)
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Currency:</strong> Euro (€) - Cards widely accepted, ATMs everywhere
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Best Months:</strong> April-June and September-October (avoid August crowds)
                </p>
              </div>

              {/* Cruise Callout Box */}
              <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  🚢 Find Your Mediterranean Cruise
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Explore Mediterranean cruises that visit Marseille and other stunning ports
                  along the French Riviera and beyond.
                </p>
                <Link
                  href="/cruises?destinations=mediterranean"
                  className="inline-block bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Mediterranean Cruises
                </Link>
              </div>

              {/* Getting Around Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Getting Around from the Port
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Marseille's cruise terminal (MPCT) sits at the entrance to the port, about 7 km
                from the city center. Unlike many Mediterranean ports, you can't walk to downtown
                from here, but multiple transport options make the journey quick and affordable.
                The port provides a free shuttle bus to the Joliette area, from where you can
                access the metro system or continue exploring on foot.
              </p>

              {/* Port Area Image */}
              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/28508990/pexels-photo-28508990.jpeg"
                  alt="Marseille's modern cruise port and harbor area"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Port Transportation Options
                </h3>
                <ul className="space-y-2">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Free Port Shuttle:</strong> To Place de la Joliette (runs every 20 minutes)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Metro:</strong> From Joliette station to Vieux Port (€1.70, 10 minutes)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Taxi:</strong> €20-25 to city center (15 minutes)
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Hop-On Hop-Off Bus:</strong> €22, stops at cruise terminal
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    • <strong>Uber:</strong> Available and often cheaper than taxis
                  </li>
                </ul>
              </div>

              {/* Top Attractions Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Must-See Marseille Attractions
              </h2>

              {/* Notre-Dame Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/12089286/pexels-photo-12089286.jpeg"
                  alt="Notre-Dame de la Garde basilica overlooking Marseille"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Notre-Dame de la Garde
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Marseille's iconic basilica, crowned with a golden Madonna, watches over the city
                from its 162-meter hilltop perch. Known locally as "La Bonne Mère" (The Good Mother),
                this 19th-century Romano-Byzantine masterpiece offers 360-degree views that stretch
                from the city to the Frioul Islands. Inside, hundreds of ex-votos—paintings of ships
                and model boats—thank the Virgin for protecting sailors. Reach it via tourist train
                (€8), bus 60, or a steep 30-minute climb. Free entry, open daily.
              </p>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Vieux Port (Old Port)
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The heart of Marseille for over two millennia, the rectangular Old Port buzzes with
                life from dawn fish markets to late-night aperitifs. Norman Foster's striking mirror
                canopy provides shade for events, while the quaysides lined with seafood restaurants
                serve the city's famous bouillabaisse (expect to pay €65+ for authentic versions).
                Don't miss the daily fish market at Quai des Belges (8 AM - 1 PM) where fishermen
                sell their morning catch directly from their boats.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Le Panier Quarter
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Marseille's oldest neighborhood, a maze of narrow streets filled with
                    artisan shops, street art, and the gorgeous Vieille Charité, a 17th-century
                    almshouse now housing museums. Perfect for wandering.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    MuCEM Museum
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Stunning contemporary architecture housing Mediterranean civilization
                    exhibits. The rooftop offers spectacular views. Connected to Fort Saint-Jean
                    by a dramatic footbridge. Entry: €11.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Château d'If
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    The island fortress made famous by "The Count of Monte Cristo." 20-minute
                    ferry from Old Port (€11 return + €6 entry). Views alone worth the trip.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Calanques National Park
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Dramatic limestone cliffs and turquoise inlets. Closest is Calanque de
                    Sugiton (bus 23 to Luminy, then 45-min hike). Boat tours available from
                    Old Port (€25-30).
                  </p>
                </div>
              </div>

              {/* Beyond Marseille Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Day Trips from Marseille
              </h2>

              {/* Provence Image */}
              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://www.pexels.com/photo/bus-interior-during-travel-16013243/"
                  alt="Scenic Provence countryside accessible from Marseille"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Aix-en-Provence (30 minutes)
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This elegant university town epitomizes Provençal charm with its tree-lined Cours
                Mirabeau, bubbling fountains, and outdoor markets. Birthplace of Cézanne, it offers
                his studio, elegant 17th-century mansions, and some of Provence's best markets
                (Tuesday, Thursday, Saturday). Regular buses from Marseille (€6, every 10 minutes)
                or trains (€8) make this an easy half-day excursion.
              </p>

              <h3
                className="font-whitney font-bold text-[24px] mb-3"
                style={{ color: "#0E1B4D" }}
              >
                Cassis (45 minutes)
              </h3>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This postcard-perfect fishing village nestled between dramatic cliffs offers
                boat trips into the Calanques, waterfront dining, and local rosé wines. The
                Wednesday and Friday markets are excellent. Take bus M08 from Castellane metro
                (€2, 1 hour) or train to Cassis station then bus/taxi to town center.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Avignon (1.5 hours)
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    The walled city of the Popes features the massive Papal Palace, the famous
                    broken bridge, and medieval charm. Direct TGV trains (€25-35, 35 minutes)
                    make this feasible for motivated travelers.
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Arles (1 hour)
                  </h4>
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    Van Gogh's inspiration with remarkably preserved Roman monuments including
                    an amphitheater still hosting bullfights. Trains run regularly (€15-20,
                    1 hour). Saturday market is exceptional.
                  </p>
                </div>
              </div>

              {/* Another Cruise Callout */}
              <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  🌊 Explore Western Mediterranean Cruises
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Discover cruises featuring Marseille alongside Barcelona, Rome, and the
                  glamorous ports of the French Riviera.
                </p>
                <Link
                  href="/cruises?destinations=mediterranean&embarkPorts=barcelona,rome"
                  className="inline-block bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse Western Mediterranean Itineraries
                </Link>
              </div>

              {/* Food Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Marseille's Food Scene
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Marseille's cuisine reflects its position as a Mediterranean crossroads. While
                bouillabaisse remains the signature dish, the city's North African population has
                enriched the food scene with exceptional couscous, tagines, and street food. The
                local pastis (anise-flavored aperitif) flows freely in waterfront cafés.
              </p>

              {/* Food Image */}
              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/5098043/pexels-photo-5098043.jpeg"
                  alt="Traditional bouillabaisse and seafood in Marseille"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Where to Eat
                </h3>
                <ul className="space-y-3">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Chez Fonfon:</strong> Authentic bouillabaisse in a fishing village
                    setting at Vallon des Auffes. Reserve ahead (€75 per person).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Le Panier des Halles:</strong> Fresh market cuisine near the Old Port.
                    Excellent lunch menus (€20-25).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Chez Yassine:</strong> Best Tunisian food in Noailles market area.
                    Huge portions (€8-12).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Bar de la Marine:</strong> Waterfront institution for pastis and
                    simple seafood (€15-20).
                  </li>
                </ul>
              </div>

              {/* Shopping Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Shopping & Markets
              </h2>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Marseille's markets are among France's most vibrant, reflecting the city's
                multicultural character. From traditional Provençal products to North African
                spices, the shopping here offers authentic local flavor rather than tourist trinkets.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Best Markets
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Noailles Market (daily, exotic foods)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Cours Julien (Wed & Sat, organic)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Fish Market at Old Port (daily 8-1)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Prado Market (Friday, largest)
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Local Specialties
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Savon de Marseille (olive oil soap)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Pastis (Ricard or Pastis 51)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Navettes (boat-shaped cookies)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Herbes de Provence
                    </li>
                  </ul>
                </div>
              </div>

              {/* Beach Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Beach Options
              </h2>

              {/* Beach Image */}
              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/30702965/pexels-photo-30702965.jpeg"
                  alt="Marseille's Prado beaches with clear Mediterranean waters"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                While not known primarily as a beach destination, Marseille offers several
                accessible beaches perfect for a Mediterranean dip. The Prado beaches, created
                from excavation materials when building the metro, stretch for several kilometers
                along the Corniche Kennedy.
              </p>

              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Beach Options
                </h3>
                <ul className="space-y-3">
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Plage des Catalans:</strong> Closest to Old Port, small sandy beach,
                    locals' favorite. 15-minute walk from Vieux Port.
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Prado Beaches:</strong> Large complex with grass areas, restaurants,
                    water sports. Bus 83 from Old Port (20 minutes).
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Plage du Prophète:</strong> Small, scenic beach popular with families.
                    Bus 83, less crowded than Prado.
                  </li>
                  <li
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Calanque de Sormiou:</strong> Stunning natural beach requiring effort
                    (bus then 45-minute hike) but worth it.
                  </li>
                </ul>
              </div>

              {/* Essential Tips Section */}
              <h2
                className="font-whitney font-black uppercase text-[32px] mb-4 mt-12"
                style={{ color: "#0E1B4D" }}
              >
                Essential Tips for Your Marseille Port Day
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
                      • Buy metro tickets in packs of 10 (€14.50)
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Shops close 12:30-2:30 PM
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Free WiFi in most cafés
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Tourist office at La Canebière
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Sunday: limited transport/shops
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4
                    className="font-whitney font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Safety & Comfort
                  </h4>
                  <ul className="space-y-2">
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Keep valuables secure in crowds
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Avoid Belsunce area at night
                    </li>
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
                      • Sun protection year-round
                    </li>
                    <li
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      • Mistral wind can be strong
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
                  ⏰ Sample Itineraries
                </h3>
                <div className="space-y-4">
                  <div>
                    <p
                      className="font-geograph text-[16px] font-bold mb-1"
                      style={{ color: "#0E1B4D" }}
                    >
                      City Explorer (6-7 hours):
                    </p>
                    <p
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      Port shuttle → Metro to Vieux Port → Walk Le Panier → Lunch at Old Port →
                      Tourist train to Notre-Dame → MuCEM Museum → Return via Joliette
                    </p>
                  </div>
                  <div>
                    <p
                      className="font-geograph text-[16px] font-bold mb-1"
                      style={{ color: "#0E1B4D" }}
                    >
                      Provence Sampler (8 hours):
                    </p>
                    <p
                      className="font-geograph text-[16px]"
                      style={{ color: "#0E1B4D" }}
                    >
                      Early taxi to St-Charles Station → Train to Aix-en-Provence → Market &
                      Cours Mirabeau → Lunch in Aix → Return train → Quick Old Port visit
                    </p>
                  </div>
                </div>
              </div>

              {/* Final Cruise Callout */}
              <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  🛳️ Ready to Cruise the Mediterranean?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Find your perfect Mediterranean cruise departing from convenient ports
                  like Barcelona, Rome, or even Marseille itself.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/cruises?destinations=mediterranean"
                    className="inline-block bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors text-center"
                  >
                    All Mediterranean Cruises
                  </Link>
                  <Link
                    href="/cruises?embarkPorts=barcelona,rome,marseille"
                    className="inline-block bg-blue-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors text-center"
                  >
                    Departures from Major Ports
                  </Link>
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
                  Skip the tourist restaurants around the Old Port and head to Cours Julien or
                  the Noailles area for authentic, affordable meals. For the best city views without
                  the Notre-Dame crowds, take the free ferry across the Old Port at sunset—the
                  golden hour light on the city is magical. Also, download the RTM app for real-time
                  public transport updates; it's far more reliable than printed schedules.
                </p>
              </div>

              {/* Weather Note */}
              <div className="bg-yellow-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-whitney font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Weather & Best Times
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Marseille enjoys 300 days of sunshine annually, but the famous Mistral wind can
                  blow fiercely, especially in winter and spring. Summer (July-August) brings heat
                  and crowds; spring (April-May) and fall (September-October) offer perfect weather.
                  Winter is mild but can be windy. The city is less touristy than other French
                  Riviera ports, making it enjoyable year-round.
                </p>
              </div>

              {/* Final Note */}
              <p
                className="font-geograph text-[18px] leading-relaxed mt-8"
                style={{ color: "#0E1B4D" }}
              >
                Marseille rewards visitors who look beyond first impressions. This gritty, vibrant
                city offers authentic Mediterranean life rather than polished tourist facades.
                Whether you spend your day exploring ancient quarters, venturing into Provence,
                or simply savoring bouillabaisse by the sea, Marseille provides a genuine taste
                of southern French culture. Its position as a gateway to both Provence and the
                Côte d'Azur makes it one of the Mediterranean's most versatile cruise ports,
                offering urban exploration and regional discovery in equal measure.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
