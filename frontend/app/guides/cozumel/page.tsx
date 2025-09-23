"use client";
import Image from "next/image";

export default function CozumelCruiseGuide() {
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
            Cozumel Cruise Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Mexico&apos;s Premier Snorkeling Destination
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
                src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=2000&h=1000&fit=crop"
                alt="Aerial view of Cozumel with cruise ships"
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
                Welcome to Cozumel, where crystal-clear waters and vibrant coral
                reefs have made this Mexican island one of the world&apos;s top
                cruise destinations. With 4.6 million annual visitors and
                recognition as the second-busiest cruise port globally after
                Miami, Cozumel has perfected the art of welcoming cruise
                passengers. In January 2025 alone, the island hosted 120,000
                cruisers in a single week, demonstrating its remarkable capacity
                and appeal.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                What makes Cozumel special? The legendary visibility in its
                waters, the health of its protected reefs, and the genuine
                warmth of its people combine to create an unforgettable
                Caribbean experience.
              </p>

              {/* Port Facilities */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Facilities: Three Terminals, Each Unique
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1582970816926-7ce09ee562ad?w=2000&h=1000&fit=crop"
                  alt="Map showing three Cozumel terminals"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Cozumel operates three modern cruise terminals, each offering
                different advantages depending on where your ship docks.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Punta Langosta (Downtown Location)
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Ships:</strong> Norwegian, Disney, MSC, Oceania, and
                  luxury lines
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Location:</strong> 5-minute walk to downtown San
                  Miguel
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Advantages:</strong> Immediate access to authentic
                  restaurants, local shops, and cultural sites
                </p>
              </div>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This downtown pier puts you steps away from the real Cozumel,
                allowing easy exploration of local eateries, markets, and shops
                without transportation costs.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                International Pier (SSA)
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Ships:</strong> Primarily Royal Caribbean vessels
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Location:</strong> 3 miles south of downtown
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Modern terminal with shopping
                  village and restaurants
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Puerta Maya
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Ships:</strong> Carnival corporation ships
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Location:</strong> Adjacent to International Pier
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> 50+ shops, multiple restaurants,
                  capacity for four large vessels
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The southern terminals offer comprehensive facilities including
                duty-free shopping, restaurants, and easy access to
                transportation for island exploration.
              </p>

              {/* Transportation Options */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Transportation Options
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/7434628/pexels-photo-7434628.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="White Cozumel taxis"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Cozumel operates on a fixed-rate taxi zone system. While Uber
                isn&apos;t available due to local regulations, the taxi system
                is well-organized and reliable.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Standard Taxi Rates from Southern Piers:
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Downtown San Miguel:</strong> $8-10 for up to 4 people
                </li>
                <li>
                  <strong>Paradise Beach/Mr. Sancho&apos;s:</strong> $15-17
                </li>
                <li>
                  <strong>Money Bar/Dzul-Ha:</strong> $12-15
                </li>
                <li>
                  <strong>Chankanaab Park:</strong> $10-12
                </li>
                <li>
                  <strong>East side beaches:</strong> $30-35
                </li>
                <li>
                  <strong>San Gervasio Ruins:</strong> $30 each way
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Transportation tips:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Confirm the total fare before departing</li>
                  <li>
                    • Rates are typically for the entire taxi, not per person
                  </li>
                  <li>• Having small bills helps with exact change</li>
                  <li>• The rate chart at the port shows official prices</li>
                  <li>
                    • Walking to the main road from southern piers can offer
                    better rates with local taxis
                  </li>
                </ul>
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
                  Planning a Cruise to Cozumel?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cozumel and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Cozumel Cruises →
                </a>
              </div>

              {/* Beach Clubs */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Beach Clubs: All-Inclusive Options
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Paradise Beach
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1519060825752-56f3dbc5f6d9?w=2000&h=1000&fit=crop"
                  alt="Paradise Beach water slides"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 15 minutes from port
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Options:</strong> $15 entry + $10 minimum OR $68
                  all-inclusive
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Water slides, floating obstacle
                  course, beautiful beach
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This family-friendly beach club offers something for everyone.
                The water toys provide entertainment for kids and adults alike,
                while the beach itself offers excellent swimming conditions.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Mr. Sancho&apos;s
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 15 minutes from port
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $70 all-inclusive
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Unlimited food and drinks, large
                  beach area, water toys
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                One of Cozumel&apos;s most established beach clubs, Mr.
                Sancho&apos;s provides a classic all-inclusive beach day
                experience. Advance reservations are highly recommended as it
                often reaches capacity.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Nachi Cocom
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1580169980114-ccd0babfa840?w=2000&h=1000&fit=crop"
                  alt="Tranquil pool area at Nachi Cocom"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 20 minutes from port
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $69 all-inclusive
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Special feature:</strong> LIMITED TO 130 GUESTS DAILY
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This boutique beach club offers a more intimate experience with
                a cap on daily visitors. The package includes a 4-course lunch
                and premium drinks. Advanced reservations are essential.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Money Bar Beach Club
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 10 minutes from port
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $20 including snorkel gear
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Highlight:</strong> Outstanding shore snorkeling
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                For snorkel enthusiasts, Money Bar (at Dzul-Ha) offers immediate
                access to healthy reef just 50 feet from shore. The focus here
                is on the underwater experience rather than amenities.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Important Note About East Side Beaches
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1560711901-45d3e922c37c?w=2000&h=1000&fit=crop"
                  alt="Rough waves at eastern beaches"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-red-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  The eastern shores face the open Caribbean and have dangerous
                  currents unsuitable for swimming. These beaches are beautiful
                  for photos but not safe for water activities.
                </p>
              </div>

              {/* CTA 2 */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cozumel?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cozumel and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Cozumel Cruises →
                </a>
              </div>

              {/* Snorkeling */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Snorkeling: Cozumel&apos;s Crown Jewel
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/6123095/pexels-photo-6123095.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="Underwater shot of Palancar Reef"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Jacques Cousteau declared Cozumel one of the world&apos;s
                premier diving destinations, and the snorkeling here lives up to
                that reputation.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Shore Snorkeling Options
              </h3>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Money Bar/Dzul-Ha:</strong> Direct reef access from
                shore with excellent visibility. You&apos;ll encounter
                parrotfish, angelfish, rays, and possibly sea turtles. The $20
                fee includes equipment.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Chankanaab Park:</strong> Protected lagoon ideal for
                beginners and children. While not as spectacular as open reef
                sites, it offers safe, easy snorkeling.
              </p>

              <p
                className="font-geograph text-[16px] mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Sky Reef:</strong> Less crowded with good coral
                formations. The swim to the reef is longer but rewards you with
                better marine life viewing.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Boat Snorkeling Tours
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Classic Three-Stop Tours ($50-69):
                </p>
                <ol
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    1. <strong>Palancar Reef:</strong> World-famous for its
                    coral formations and marine biodiversity
                  </li>
                  <li>
                    2. <strong>Colombia Reef:</strong> Dramatic wall diving with
                    depths exceeding 80 feet below
                  </li>
                  <li>
                    3. <strong>El Cielo:</strong> Shallow sandbar known for its
                    starfish population
                  </li>
                </ol>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Morning tours (9:30 AM) typically offer the best conditions with
                calmer seas and optimal visibility. Most tours include
                equipment, marine park fees, and beverages.
              </p>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Environmental Note:</strong> Regular sunscreen is
                  prohibited on the reefs to protect the coral. Please bring
                  reef-safe sunscreen (without oxybenzone or octinoxate) or
                  purchase it locally.
                </p>
              </div>

              {/* Island Attractions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Island Attractions & Adventures
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Chankanaab National Park
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 10-15 minutes from any port
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $65 all-inclusive package
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Beach, snorkeling, botanical
                  gardens, cultural shows
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This comprehensive park offers diverse activities perfect for
                families. The all-inclusive option covers food, drinks,
                entertainment, and snorkeling equipment.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                San Gervasio Mayan Ruins
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/13713190/pexels-photo-13713190.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="San Gervasio Mayan ruins"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 25 minutes inland
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $15 entry plus transportation
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Time needed:</strong> 2-3 hours including travel
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                These ruins, dedicated to the fertility goddess Ixchel, offer
                insight into Cozumel&apos;s Mayan heritage without requiring a
                mainland ferry trip.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Tulum Ruins (Mainland Excursion)
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Total time:</strong> 6-7 hours minimum
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Cost:</strong> $75-89 independently, $150+ through
                  cruise lines
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Requirements:</strong> 8+ hours in port recommended
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                While spectacular, Tulum requires careful planning due to ferry
                and land transportation time. The ruins overlooking the
                Caribbean are stunning but require most of your port day.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Discover Mexico Park
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> Walking distance from southern
                  piers
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $22
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Air-conditioned exhibits, cultural
                  performances, tequila tasting
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This cultural park provides an overview of Mexican landmarks and
                traditions in a comfortable, climate-controlled environment.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Pearl Farm Experience
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Price:</strong> $160
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Duration:</strong> 6 hours
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Includes:</strong> Boat tour, pearl education, private
                  beach, snorkeling
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This unique excursion offers education about pearl cultivation
                combined with exclusive beach access and specialized snorkeling
                opportunities.
              </p>

              {/* CTA 3 */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cozumel?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cozumel and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Cozumel Cruises →
                </a>
              </div>

              {/* Downtown San Miguel */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Downtown San Miguel: Local Culture
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/29159332/pexels-photo-29159332.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="Colorful buildings in downtown San Miguel"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                From Punta Langosta, downtown is a 5-minute walk. From southern
                piers, expect an $8-10 taxi ride.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Shopping Recommendations
              </h3>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Los Cinco Soles:</strong> High-quality Mexican
                handicrafts, extensive tequila selection, and genuine vanilla
                extract at reasonable prices.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Plaza del Sol Market:</strong> Traditional market behind
                the orange clock tower. Bargaining is expected – start at 50% of
                asking price.
              </p>

              <p
                className="font-geograph text-[16px] mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Mega Grocery Store:</strong> Perfect for authentic
                Mexican snacks, vanilla, and tequila at local prices.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Authentic Dining
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1599021419847-d8a7a6aba5b4?w=2000&h=1000&fit=crop"
                  alt="Local taqueria"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Pescadería San Carlos:</strong> Family-run seafood spot
                behind the market serving incredible ceviche at local prices.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>La Choza:</strong> Established in 1989, famous for
                traditional Yucatecan cuisine including cochinita pibil.
              </p>

              <p
                className="font-geograph text-[16px] mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Los Otates:</strong> Authentic taqueria with excellent
                al pastor tacos at very reasonable prices.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Useful Spanish Phrases
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-1 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>• "¿Cuánto cuesta?" = How much?</li>
                <li>• "La cuenta, por favor" = Check please</li>
                <li>• "Sin hielo" = No ice</li>
                <li>• "¿Donde está el baño?" = Where&apos;s the bathroom?</li>
                <li>• "Gracias" = Thank you</li>
                <li>• "Por favor" = Please</li>
              </ul>

              {/* What to Watch Out For */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                What to Watch Out For
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Common Tourist Concerns
              </h3>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Transportation:</strong> Some taxi drivers may quote
                higher prices initially. Politely refer to the official rate
                chart and confirm prices before departing.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Pharmacy Purchases:</strong> While many medications are
                available without prescription, bringing them into the US
                without proper documentation is illegal.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Shopping:</strong> Jewelry and gemstones are often
                marked with inflated "original" prices. Research fair prices
                beforehand.
              </p>

              <p
                className="font-geograph text-[16px] mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Time Share Presentations:</strong> Avoid "free"
                breakfast or tour offers that require attending sales
                presentations.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Health & Safety Recommendations
              </h3>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Water:</strong> Stick to bottled water for drinking and
                teeth brushing. Ice at established restaurants is typically
                safe.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Sun Protection:</strong> The tropical sun is intense
                even on cloudy days. Reapply sunscreen every 2 hours.
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Food Safety:</strong> Tourist restaurants maintain high
                standards. Street food is delicious but may not suit sensitive
                stomachs.
              </p>

              <p
                className="font-geograph text-[16px] mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Medical Care:</strong> Hospital Costamed Cozumel offers
                English-speaking staff and accepts international insurance.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Upcoming Changes
              </h3>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Starting July 2025, Mexico will implement a cruise passenger
                  tax:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• 2025: $5</li>
                  <li>• 2026: $10</li>
                  <li>• 2027: $21</li>
                </ul>
                <p
                  className="font-geograph text-[16px] mt-2"
                  style={{ color: "#0E1B4D" }}
                >
                  This per-cruise fee will likely be added to your cruise fare.
                </p>
              </div>

              {/* CTA 4 */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cozumel?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cozumel and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Cozumel Cruises →
                </a>
              </div>

              {/* Weather & Seasonal */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Weather & Seasonal Considerations
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Best Months: March-May
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Dry season with minimal rain</li>
                    <li>• Excellent underwater visibility (100+ feet)</li>
                    <li>• Comfortable temperatures in the mid-80s</li>
                    <li>• Moderate crowd levels</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Good Conditions: November-February
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Cooler temperatures (high 70s)</li>
                    <li>• Occasional norte winds</li>
                    <li>• Great visibility</li>
                    <li>• Peak cruise season</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Hot Season: June-August
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• High temperatures and humidity</li>
                    <li>• Afternoon thunderstorms possible</li>
                    <li>• Potential for sargassum seaweed</li>
                    <li>• Fewer crowds</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Hurricane Season: September-October
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Peak hurricane risk</li>
                    <li>• Possible itinerary changes</li>
                    <li>• If weather cooperates, uncrowded beaches</li>
                  </ul>
                </div>
              </div>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1596627116790-af6f46dddbda?w=2000&h=1000&fit=crop"
                  alt="Sargassum seaweed on beach"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>About sargassum:</strong> This seaweed occasionally
                appears May-August, primarily on east-facing beaches. West side
                beaches where cruise activities occur typically remain clear.
              </p>

              {/* Planning Your Port Day */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Planning Your Port Day
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                6-Hour Port Stop (Typical)
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Beach Focus:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1 mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• 9:00 AM: Disembark and taxi to beach club</li>
                  <li>• 9:30 AM - 1:30 PM: Beach activities and lunch</li>
                  <li>• 2:00 PM: Downtown for shopping and snacks</li>
                  <li>• 3:00 PM: Return to port</li>
                  <li>• 3:30 PM: All aboard (4:30 PM departure)</li>
                </ul>

                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Snorkel Adventure:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• 9:00 AM: Meet tour at pier</li>
                  <li>• 9:30 AM - 1:30 PM: Three-reef snorkel tour</li>
                  <li>• 2:00 PM: Quick downtown visit</li>
                  <li>• 3:00 PM: Return to ship</li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                8-Hour Port Stop
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Culture & Beach Combination:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1 mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• 9:00 AM: Visit San Gervasio Ruins</li>
                  <li>• 11:30 AM: Travel to Chankanaab Park</li>
                  <li>• 12:00 - 3:30 PM: Beach, lunch, and activities</li>
                  <li>• 4:00 PM: Downtown exploration</li>
                  <li>• 5:00 PM: Return to ship</li>
                </ul>

                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Mainland Excursion (Ambitious):
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• 8:30 AM: Ferry to Playa del Carmen</li>
                  <li>• 10:30 AM: Arrive at Tulum</li>
                  <li>• 11:00 AM - 1:00 PM: Explore ruins</li>
                  <li>• 2:30 PM: Return to Playa</li>
                  <li>• 3:15 PM: Ferry back to Cozumel</li>
                  <li>• 4:00 PM: Taxi to ship</li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Time Management Tips
              </h3>

              <div className="bg-red-50 p-4 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Allow 90-minute buffer:</strong> Always plan to be
                    back at the ship 90 minutes before all-aboard time.
                  </li>
                  <li>
                    <strong>Book morning activities:</strong> Best weather,
                    water conditions, and smaller crowds.
                  </li>
                  <li>
                    <strong>Bring small bills:</strong> $1s and $5s are most
                    useful. Pesos from ATMs offer the best exchange rate.
                  </li>
                  <li>
                    <strong>Screenshot important info:</strong> Save taxi rates,
                    confirmations, and ship departure times offline.
                  </li>
                </ul>
              </div>

              {/* CTA 5 */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cozumel?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cozumel and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Cozumel Cruises →
                </a>
              </div>

              {/* Insider Recommendations */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Insider Recommendations
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Hidden Gems:
              </h3>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Playa Casitas:</strong> Public beach 10 minutes north of
                downtown, popular with locals
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>El Coctelito:</strong> Beachfront restaurant serving
                incredibly fresh seafood
              </p>

              <p
                className="font-geograph text-[16px] mb-2"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Taqueria Los Chachalacos:</strong> Authentic local spot
                with excellent tortas
              </p>

              <p
                className="font-geograph text-[16px] mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <strong>Wet Wendy&apos;s:</strong> Popular bar known for strong
                margaritas and fun atmosphere
              </p>

              {/* Making the Most */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Making the Most of Cozumel
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Cozumel offers an ideal blend of natural beauty, cultural
                richness, and modern amenities. Whether you&apos;re drawn to the
                world-class reefs, pristine beaches, authentic cuisine, or Mayan
                history, this island provides experiences for every interest and
                activity level.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The key to a perfect port day is choosing quality over quantity
                – select activities that genuinely interest you rather than
                trying to pack everything in. Leave time to savor the moment,
                whether that&apos;s floating above a coral reef, enjoying fresh
                ceviche at a local restaurant, or simply relaxing on a beautiful
                beach.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Most importantly, embrace the relaxed island pace and warm
                Mexican hospitality. Your best memories might come from an
                unexpected conversation with a local, a perfect taco from a
                small family restaurant, or that moment when you first glimpse
                the underwater world that makes Cozumel legendary.
              </p>

              <p
                className="font-geograph text-[18px] italic text-center mt-8 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Buen viaje and enjoy your Cozumel adventure!
              </p>

              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1580541631950-7282082b53ce?w=2000&h=1000&fit=crop"
                  alt="Sunset view from departing cruise ship"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Final Call to Action */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cozumel?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cozumel and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Cozumel Cruises →
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
