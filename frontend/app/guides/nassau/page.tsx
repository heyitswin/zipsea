"use client";
import Image from "next/image";

export default function NassauCruiseGuide() {
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
            Nassau Cruise Port Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Bahamas Day Pass
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
                src="https://images.unsplash.com/photo-1580541832626-2a7131ee809f?q=80&w=2000"
                alt="Aerial view of Prince George Wharf with cruise ships"
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
                Welcome to Nassau, where your cruise ship docks right in the
                heart of the action! After a transformative $300 million
                renovation, Prince George Wharf has become a world-class
                facility handling over 30,000 passengers daily across six
                state-of-the-art berths. In 2024, Nassau welcomed 5.6 million
                cruise visitors, setting a single-day record of 30,538 visitors
                in March 2025 – a testament to this destination&apos;s enduring
                appeal.
              </p>

              {/* Port Overview */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Overview: Your Gateway to Paradise
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1580541831949-61ea79d8f5c0?q=80&w=2000"
                  alt="Modern Nassau cruise terminal"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The moment you step off your ship, you&apos;re essentially in
                downtown Nassau. This unique setup means no shuttles or
                transfers – just a pleasant 5-minute walk to Bay Street&apos;s
                shopping district and the famous Straw Market. The port features
                complimentary WiFi, clean facilities, and numerous shops for any
                last-minute needs.
              </p>

              {/* Getting Around */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around Nassau
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
                  <strong>Downtown/Bay Street:</strong> 5 minutes of easy, flat
                  walking
                </li>
                <li>
                  <strong>Straw Market:</strong> 7-10 minutes through the port
                  area
                </li>
                <li>
                  <strong>Junkanoo Beach:</strong> 15-minute scenic waterfront
                  stroll westward
                </li>
                <li>
                  <strong>Queen&apos;s Staircase:</strong> 20-minute walk with a
                  gentle uphill climb
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Taxi Services
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Official taxis display "TN" plates and operate on a zone-based
                fare system. Here are the standard rates from the port:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Paradise Island:</strong> $6 per person (couples often
                  pay $11-13 total)
                </li>
                <li>
                  <strong>Cable Beach:</strong> $16-18 for two people
                </li>
                <li>
                  <strong>Atlantis:</strong> Same as Paradise Island plus $2
                  bridge toll
                </li>
              </ul>
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Helpful tip:</strong> Always confirm your fare before
                  departing. Tipping 15% is customary for good service.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Local Transportation: Jitney Buses
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Experience authentic Bahamian culture for just $1.25 on the
                colorful jitney buses. The <strong>#10 jitney</strong> runs
                every 10-15 minutes to Cable Beach. Remember to have exact
                change ready and pay when exiting the bus. These local buses
                offer a fun, economical way to travel while enjoying local music
                and atmosphere.
              </p>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1618843479619-f3d19b3deaae?q=80&w=2000"
                  alt="Colorful jitney bus on Bay Street"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Paradise Island & Atlantis */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Paradise Island & Atlantis Resort
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The iconic Atlantis Resort draws many visitors to Paradise
                Island. <strong>Day passes</strong> are available when hotel
                occupancy permits (typically below 90%), and must be booked at
                least 48 hours in advance through the resort&apos;s website or
                your cruise line.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Day pass pricing ranges from $130-200 for adults and includes:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>• Access to the 141-acre Aquaventure water park</li>
                <li>• Use of all 5 beaches</li>
                <li>• The Dig aquarium and ruins</li>
                <li>• Marine habitats featuring 50,000+ sea creatures</li>
              </ul>

              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Alternative option:</strong> Guests at Comfort Suites
                  Paradise Island receive complimentary Atlantis access, which
                  can be more economical for families.
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                If passes aren&apos;t available, you can still enjoy:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>• Marina Village (free to explore)</li>
                <li>• The casino (open to the public)</li>
                <li>• Cabbage Beach via the public access point</li>
              </ul>

              {/* Beach Destinations */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Beach Destinations
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Junkanoo Beach
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1615571737499-439eb7a594fa?q=80&w=2000"
                  alt="Junkanoo Beach with cruise ships"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 15-minute walk west from port
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Lively atmosphere, food vendors,
                  beach chair rentals
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Cost:</strong> Free entry, $10-20 for chair rentals
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This convenient beach offers quick access to sand and sea when
                time is limited. While it may have some rocks and sea glass, its
                proximity and vibrant local atmosphere make it a popular choice
                for cruise passengers with shorter port stays.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Cable Beach
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 20-minute ride via taxi ($16-18) or
                  jitney ($1.25)
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Pristine white sand, calm waters,
                  spacious beach area
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Cost:</strong> Public beach with free access
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Cable Beach showcases the Bahamas at its finest – beautiful
                white sand and crystal-clear water protected by an offshore
                reef. This is where many locals spend their beach days, offering
                a more authentic experience.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Blue Lagoon Island
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1582970816926-7ce09ee562ad?q=80&w=2000"
                  alt="Aerial view of Blue Lagoon Island"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Distance:</strong> 3 miles offshore (ferry from
                  Paradise Island)
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Features:</strong> Private island experience with
                  multiple beach areas
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Cost:</strong> $109+ for adults including ferry, beach
                  access, and lunch
                </p>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                This private island offers a complete beach day experience with
                the option to add dolphin or sea lion encounters ($165-235). The
                programs are popular and should be booked in advance.
              </p>

              {/* Nassau Attractions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Nassau Attractions & Experiences
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Historical & Cultural Sites (Free)
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Queen&apos;s Staircase:</strong> 66 hand-carved steps
                  with historical significance and beautiful surroundings
                </li>
                <li>
                  <strong>Fort Fincastle:</strong> Historic fort with panoramic
                  views of Nassau harbor
                </li>
                <li>
                  <strong>John Watling&apos;s Distillery:</strong> Complimentary
                  rum tours with tastings in a beautifully restored 1789 estate
                </li>
                <li>
                  <strong>Parliament Square:</strong> Distinctive pink colonial
                  buildings that are perfect for photos
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Premium Experiences
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Swimming with Dolphins</strong> ($165-235): A
                  memorable encounter at Blue Lagoon Island
                </li>
                <li>
                  <strong>Pirates of Nassau Museum</strong> ($14): Interactive
                  museum bringing pirate history to life
                </li>
                <li>
                  <strong>Graycliff Chocolate Making</strong> ($54.95): Hands-on
                  chocolate making in a historic mansion
                </li>
              </ul>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/5008831/pexels-photo-5008831.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="Tourist swimming with dolphin"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Straw Market Shopping */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Straw Market Shopping
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The Straw Market is Nassau&apos;s most famous shopping
                destination, offering everything from authentic Bahamian crafts
                to souvenir items. Here&apos;s how to make the most of your
                visit:
              </p>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Shopping strategies:
                </p>
                <ol
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    1. Negotiation is expected – start your offer at about
                    40-50% of the asking price
                  </li>
                  <li>
                    2. Vendors making items on-site often have the most
                    authentic products
                  </li>
                  <li>3. Bring cash for better bargaining power</li>
                  <li>
                    4. Take your time to browse different stalls for the best
                    selection and prices
                  </li>
                </ol>
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Look for genuine Bahamian straw work, wood carvings, and locally
                made jewelry for authentic souvenirs.
              </p>

              {/* Dining Recommendations */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Dining Recommendations
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Fish Fry at Arawak Cay – Authentic Bahamian Cuisine
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1613482105566-cfc3b173bb0f?q=80&w=2000"
                  alt="Colorful shacks at Fish Fry"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Located a 25-minute walk or short taxi ride ($8) from the port,
                Fish Fry offers the most authentic dining experience in Nassau.
              </p>

              <p
                className="font-geograph text-[16px] font-bold mb-2"
                style={{ color: "#0E1B4D" }}
              >
                Top restaurants:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Twin Brothers:</strong> Famous for perfectly seasoned
                  conch fritters
                </li>
                <li>
                  <strong>Oh Andros:</strong> Excellent cracked conch with
                  traditional sides
                </li>
                <li>
                  <strong>Drifter&apos;s:</strong> Great atmosphere with live
                  music on Sundays
                </li>
              </ul>

              <p
                className="font-geograph text-[16px] font-bold mb-2"
                style={{ color: "#0E1B4D" }}
              >
                Must-try dishes:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>• Fresh conch fritters</li>
                <li>• Sky juice (a refreshing local cocktail)</li>
                <li>• Conch salad prepared fresh to order</li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Downtown Dining
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Bahamian Cookin&apos;:</strong> Family recipes served
                  just 10 minutes from the port
                </li>
                <li>
                  <strong>Potter&apos;s Cay:</strong> Fresh seafood under the
                  Paradise Island bridge
                </li>
                <li>
                  <strong>Pirate Republic Brewing:</strong> Local craft beer at
                  the port area
                </li>
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
                Areas to Avoid
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The area known as "Over the Hill" (south of Shirley Street) has
                higher crime rates and limited tourist facilities. It&apos;s
                best to stay within the established tourist zones for safety.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Common Tourist Concerns
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Pricing negotiations:</strong> Some vendors may quote
                  high initial prices. Polite bargaining is normal and expected
                </li>
                <li>
                  <strong>Taxi meters:</strong> Taxis don&apos;t use meters –
                  confirm your fare before departing
                </li>
                <li>
                  <strong>Beach vendors:</strong> Can be persistent but a polite
                  "no thank you" usually works
                </li>
                <li>
                  <strong>Tour operators:</strong> Verify credentials and prices
                  before committing to activities
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Practical Considerations
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>• Use official taxis with "TN" plates</li>
                <li>• Confirm all prices upfront</li>
                <li>• Keep copies of important documents</li>
                <li>• Stay aware of your surroundings</li>
                <li>• Return to ship well before all-aboard time</li>
              </ul>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1618843479619-f3d19b3deaae?q=80&w=2000"
                  alt="Busy Bay Street with tourists"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Time Management */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Time Management for Your Visit
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                6-Hour Port Stop
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-2"
                style={{ color: "#0E1B4D" }}
              >
                Choose one main activity:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>• Beach time plus Straw Market browsing</li>
                <li>• Downtown walking tour with lunch at Fish Fry</li>
                <li>• Blue Lagoon Island excursion</li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                8-Hour Port Stop
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-2"
                style={{ color: "#0E1B4D" }}
              >
                Combine multiple experiences:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  • Morning: Queen&apos;s Staircase and Fort Fincastle tour
                </li>
                <li>• Lunch: Fish Fry for authentic cuisine</li>
                <li>
                  • Afternoon: Relax at Cable Beach or explore Bay Street shops
                </li>
              </ul>

              <div className="bg-red-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Important Timing Tips
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Allow 90 minutes minimum to return to ship</li>
                  <li>• Add extra time during peak season (December-April)</li>
                  <li>• Atlantis visits typically require 6+ hours total</li>
                </ul>
              </div>

              {/* Weather & Best Times */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Weather & Best Times to Visit
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Peak Season (December-April)
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Most reliable weather</li>
                    <li>• Temperatures in the high 70s-low 80s</li>
                    <li>• Busiest time with higher prices</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Sweet Spot (February 15-March 15)
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Near-perfect weather conditions</li>
                    <li>• Comfortable humidity levels</li>
                    <li>• Still busy but manageable</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Summer (May-August)
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Warmer and more humid</li>
                    <li>• Occasional afternoon showers</li>
                    <li>• Fewer crowds and better deals</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p
                    className="font-geograph text-[16px] font-bold mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Hurricane Season (June-November)
                  </p>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• June and August see the most rainfall</li>
                    <li>• September-October have highest hurricane risk</li>
                    <li>• Ships may alter itineraries if storms threaten</li>
                  </ul>
                </div>
              </div>

              {/* Port Facilities */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Facilities & Services
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The renovated terminal offers excellent amenities:
              </p>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>WiFi:</strong> Complimentary throughout the terminal
                </li>
                <li>
                  <strong>Currency:</strong> US dollars accepted everywhere (1:1
                  with Bahamian dollars)
                </li>
                <li>
                  <strong>ATMs:</strong> Available on Parliament Street
                </li>
                <li>
                  <strong>Shopping:</strong> 60+ stores at the port
                </li>
                <li>
                  <strong>Banking:</strong> Hours typically 9:30am-3pm
                  (Mon-Thu), until 5pm Friday
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Your cell phone will work but international roaming charges
                  apply – WiFi is your best option for staying connected.
                </p>
              </div>

              {/* Making the Most */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Making the Most of Your Nassau Visit
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Nassau offers a perfect blend of convenience, culture, and
                Caribbean beauty. Whether you choose to explore historical
                sites, relax on stunning beaches, or dive into local cuisine,
                this port provides options for every type of traveler. The key
                to a great day is choosing activities that match your interests
                and energy level rather than trying to see everything.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Remember to leave time to simply soak in the island atmosphere –
                perhaps with a rum punch in hand while watching the turquoise
                waters. Most importantly, build in plenty of buffer time for
                your return to the ship, allowing you to enjoy your day without
                stress.
              </p>

              <p
                className="font-geograph text-[18px] italic text-center mt-8 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Safe travels and enjoy your Bahamian adventure!
              </p>

              <div className="relative w-full h-[400px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1580541631950-7282082b53ce?q=80&w=2000"
                  alt="Sunset view from departing cruise ship"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Call to Action */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Nassau?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Nassau and get maximum
                  onboard credit with every booking!
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Nassau Cruises →
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
