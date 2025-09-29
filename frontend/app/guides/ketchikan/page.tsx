import Image from "next/image";
import Link from "next/link";

export default function KetchikanCruiseGuide() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative h-[500px] bg-gradient-to-b from-blue-900 to-blue-700">
        <Image
          src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=2000&q=80"
          alt="Creek Street in Ketchikan, Alaska"
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white px-4 max-w-4xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              Ketchikan Cruise Port Guide
            </h1>
            <p className="text-xl md:text-2xl mb-8">
              Alaska's First City & The Salmon Capital of the World
            </p>
            <Link
              href="/cruises?embarkPorts=ketchikan"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Find Ketchikan Cruises
            </Link>
          </div>
        </div>
      </section>

      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <ul className="flex overflow-x-auto space-x-8 py-4">
            <li>
              <a
                href="#overview"
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap font-medium"
              >
                Overview
              </a>
            </li>
            <li>
              <a
                href="#cruise-lines"
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap font-medium"
              >
                Cruise Lines
              </a>
            </li>
            <li>
              <a
                href="#shore-excursions"
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap font-medium"
              >
                Shore Excursions
              </a>
            </li>
            <li>
              <a
                href="#port-info"
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap font-medium"
              >
                Port Information
              </a>
            </li>
            <li>
              <a
                href="#best-time"
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap font-medium"
              >
                Best Time to Visit
              </a>
            </li>
            <li>
              <a
                href="#tips"
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap font-medium"
              >
                Tips
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Facts */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Facts</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <strong className="text-gray-700">Location:</strong>
              <p className="text-gray-600">
                Southeast Alaska, Gateway to the Inside Passage
              </p>
            </div>
            <div>
              <strong className="text-gray-700">Population:</strong>
              <p className="text-gray-600">Approximately 8,500</p>
            </div>
            <div>
              <strong className="text-gray-700">Currency:</strong>
              <p className="text-gray-600">US Dollar (USD)</p>
            </div>
            <div>
              <strong className="text-gray-700">Language:</strong>
              <p className="text-gray-600">English</p>
            </div>
            <div>
              <strong className="text-gray-700">Time Zone:</strong>
              <p className="text-gray-600">Alaska Standard Time (AKST)</p>
            </div>
            <div>
              <strong className="text-gray-700">Famous For:</strong>
              <p className="text-gray-600">Salmon, Totem Poles, Creek Street</p>
            </div>
          </div>
        </div>

        {/* Overview Section */}
        <section id="overview" className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Welcome to Ketchikan
          </h2>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1580837119756-563d608dd119?auto=format&fit=crop&w=1200&q=80"
              alt="Ketchikan waterfront with colorful buildings"
              width={1200}
              height={600}
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="prose prose-lg max-w-none text-gray-700 space-y-4">
            <p>
              Known as Alaska's "First City" and the "Salmon Capital of the
              World," Ketchikan offers cruise passengers an authentic glimpse
              into Southeast Alaska's rich cultural heritage and stunning
              natural beauty. This historic fishing town, built on stilts along
              the waterfront and climbing the steep hillsides, preserves both
              Native Alaskan traditions and the rowdy spirit of its frontier
              past.
            </p>
            <p>
              With the world's largest collection of standing totem poles, the
              historic Creek Street boardwalk, and some of the best salmon
              fishing in Alaska, Ketchikan provides a perfect introduction to
              the Last Frontier. The town's compact downtown area is easily
              walkable from the cruise docks, making it convenient for
              independent exploration.
            </p>
            <p>
              Despite receiving over 150 inches of rain annually (earning it the
              nickname "Rain Capital of Alaska"), Ketchikan's misty atmosphere
              only adds to its mystique. The surrounding Tongass National
              Forest, the largest temperate rainforest in the world, creates a
              lush green backdrop that makes every photo spectacular.
            </p>
          </div>
        </section>

        {/* Major Cruise Lines */}
        <section id="cruise-lines" className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Cruise Lines Visiting Ketchikan
          </h2>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-6">
            <p className="text-blue-900">
              <strong>Peak Season:</strong> Ketchikan is typically the first or
              last port of call on Alaska Inside Passage cruises. During peak
              season (May-September), the port can host up to 4 large cruise
              ships daily, bringing over 11,000 visitors to this small town.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Premium & Luxury Lines
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  • <strong>Princess Cruises:</strong> Regular 7-day Inside
                  Passage sailings
                </li>
                <li>
                  • <strong>Holland America Line:</strong> Traditional Alaska
                  voyages with cultural focus
                </li>
                <li>
                  • <strong>Celebrity Cruises:</strong> Modern luxury Alaska
                  cruises
                </li>
                <li>
                  • <strong>Oceania Cruises:</strong> Intimate ships with
                  culinary focus
                </li>
                <li>
                  • <strong>Viking Ocean:</strong> Small ship Alaska
                  explorations
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Mainstream & Adventure Lines
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  • <strong>Royal Caribbean:</strong> Large ships with extensive
                  amenities
                </li>
                <li>
                  • <strong>Norwegian Cruise Line:</strong> Flexible dining and
                  entertainment
                </li>
                <li>
                  • <strong>Carnival Cruise Line:</strong> Fun ships with Alaska
                  itineraries
                </li>
                <li>
                  • <strong>Disney Cruise Line:</strong> Family-focused Alaska
                  adventures
                </li>
                <li>
                  • <strong>Lindblad Expeditions:</strong> Small ship wildlife
                  encounters
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Shore Excursions */}
        <section id="shore-excursions" className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Top Shore Excursions
          </h2>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=1200&q=80"
              alt="Misty Fjords National Monument"
              width={1200}
              height={600}
              className="w-full h-96 object-cover"
            />
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Misty Fjords National Monument
              </h3>
              <p className="text-gray-700 mb-4">
                Experience the breathtaking beauty of this 2.2-million-acre
                wilderness by floatplane or boat. Soar over dramatic fjords,
                pristine lakes, and 3,000-foot granite cliffs in what's often
                called the "Yosemite of the North." Floatplane tours often
                include a water landing on a remote mountain lake.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 2-4 hours | Price: $$$$ | Activity Level: Easy
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Great Alaskan Lumberjack Show
              </h3>
              <p className="text-gray-700 mb-4">
                Watch professional lumberjacks compete in traditional timber
                sports including log rolling, axe throwing, and speed climbing.
                This entertaining 1-hour show is perfect for families and
                showcases Ketchikan's logging heritage.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 1.5 hours | Price: $$ | All Ages
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Totem Bight State Park
              </h3>
              <p className="text-gray-700 mb-4">
                Explore this outdoor museum featuring 14 replica totem poles and
                a recreated Native clan house. Learn about Tlingit and Haida
                cultures while walking through the coastal rainforest along easy
                trails.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 2.5 hours | Price: $$ | Activity Level: Easy
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Alaska Rainforest Zipline
              </h3>
              <p className="text-gray-700 mb-4">
                Soar through the Tongass rainforest canopy on a series of
                ziplines and suspension bridges. This eco-adventure combines
                thrills with education about the temperate rainforest ecosystem
                and offers spectacular views.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 3 hours | Price: $$$ | Activity Level: Moderate
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Bering Sea Crab Fishermen's Tour
              </h3>
              <p className="text-gray-700 mb-4">
                Board the Aleutian Ballad (featured on Deadliest Catch) for a
                3-hour adventure. Watch the crew demonstrate crab fishing
                techniques, enjoy fresh Dungeness crab, and hear tales from the
                Bering Sea.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 3 hours | Price: $$$ | Activity Level: Easy
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Saxman Native Village
              </h3>
              <p className="text-gray-700 mb-4">
                Visit the largest collection of standing totem poles in the
                world. Watch master carvers at work, enjoy traditional Native
                dancing, and learn about the stories behind these magnificent
                cultural artifacts.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 2.5 hours | Price: $$ | Activity Level: Easy
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Eagle & Wildlife Expedition
              </h3>
              <p className="text-gray-700 mb-4">
                Cruise through the Inside Passage waters searching for bald
                eagles, seals, sea lions, and possibly whales. Visit an eagle
                nesting area and learn about local marine ecosystems from expert
                naturalists.
              </p>
              <p className="text-blue-600 font-semibold">
                Duration: 3.5 hours | Price: $$$ | Activity Level: Easy
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-600 p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              💡 Booking Tip
            </h3>
            <p className="text-gray-700">
              Popular excursions like Misty Fjords flightseeing can sell out
              weeks in advance during peak season. Book early through your
              cruise line or directly with local operators. Many local tour
              companies offer better prices than cruise line excursions, and the
              cruise dock is within walking distance of tour departure points.
            </p>
          </div>
        </section>

        {/* Port Information */}
        <section id="port-info" className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Port Information
          </h2>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1614094082869-cd4e4b2905c7?auto=format&fit=crop&w=1200&q=80"
              alt="Historic Creek Street boardwalk in Ketchikan"
              width={1200}
              height={600}
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Cruise Terminal Details
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>
                  <strong>Location:</strong> Downtown Ketchikan has 4 cruise
                  ship berths
                </li>
                <li>
                  <strong>Distance to Downtown:</strong> Walking distance (5-10
                  minutes)
                </li>
                <li>
                  <strong>Berth 1:</strong> Closest to downtown (near Salmon
                  Landing)
                </li>
                <li>
                  <strong>Berth 2:</strong> Adjacent to Berth 1
                </li>
                <li>
                  <strong>Berth 3:</strong> About 0.5 miles from downtown
                </li>
                <li>
                  <strong>Berth 4:</strong> Ward Cove (8 miles north - shuttle
                  provided)
                </li>
                <li>
                  <strong>Free WiFi:</strong> Available at the Visitor Center
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Transportation
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>
                  <strong>Walking:</strong> Downtown is easily walkable from
                  Berths 1-3
                </li>
                <li>
                  <strong>Local Bus:</strong> "The Bus" runs every 30 minutes
                  ($2 fare)
                </li>
                <li>
                  <strong>Taxi:</strong> Available at the dock (about $20 to
                  Totem Bight)
                </li>
                <li>
                  <strong>Rental Cars:</strong> Limited availability - book in
                  advance
                </li>
                <li>
                  <strong>Duck Tour:</strong> Amphibious vehicle tours depart
                  near the dock
                </li>
                <li>
                  <strong>Ward Cove Shuttle:</strong> Free for ships docked at
                  Berth 4
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Downtown Highlights
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>
                  <strong>Creek Street:</strong> Historic red-light district on
                  stilts (10 min walk)
                </li>
                <li>
                  <strong>Southeast Alaska Discovery Center:</strong> $5
                  admission (5 min walk)
                </li>
                <li>
                  <strong>Tongass Historical Museum:</strong> Local history
                  exhibits ($3 admission)
                </li>
                <li>
                  <strong>Whale Park:</strong> Waterfront park with Native
                  artwork
                </li>
                <li>
                  <strong>Salmon Ladder:</strong> Watch salmon jump upstream
                  (seasonal)
                </li>
                <li>
                  <strong>Married Man's Trail:</strong> Scenic boardwalk along
                  the creek
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Shopping & Dining
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>
                  <strong>Alaska Native Art:</strong> Soho Coho for authentic
                  local art
                </li>
                <li>
                  <strong>Salmon Products:</strong> Salmon Landing Market
                </li>
                <li>
                  <strong>The Fish House:</strong> Fresh Alaska seafood on
                  pilings
                </li>
                <li>
                  <strong>Bar Harbor Ale House:</strong> Local brews and halibut
                </li>
                <li>
                  <strong>Annabelle's Keg & Chowder House:</strong> Historic
                  saloon
                </li>
                <li>
                  <strong>Ray's Waterfront:</strong> Fresh crab and harbor views
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              📍 Navigation Tip
            </h3>
            <p className="text-gray-700">
              Download an offline map before leaving the ship - cell service can
              be spotty. The Ketchikan Visitor Bureau at 131 Front Street (right
              by the cruise dock) offers free maps and excellent local advice.
              They also have free WiFi and clean restrooms.
            </p>
          </div>
        </section>

        {/* Best Time to Visit */}
        <section id="best-time" className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Best Time to Visit
          </h2>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Peak Season (May - September)
                </h3>
                <ul className="space-y-3 text-gray-700">
                  <li>
                    <strong>May:</strong> Fewer crowds, spring flowers, possible
                    whales migrating
                    <br />
                    Avg temp: 45-55°F | Rain: 9 inches
                  </li>
                  <li>
                    <strong>June-July:</strong> Longest days (18+ hours
                    daylight), warmest weather
                    <br />
                    Avg temp: 50-65°F | Rain: 7-8 inches
                  </li>
                  <li>
                    <strong>August:</strong> Peak salmon runs, berry picking
                    season
                    <br />
                    Avg temp: 50-65°F | Rain: 11 inches
                  </li>
                  <li>
                    <strong>September:</strong> Fall colors, fewer tourists,
                    salmon spawning
                    <br />
                    Avg temp: 45-55°F | Rain: 13 inches
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Wildlife Calendar
                </h3>
                <ul className="space-y-3 text-gray-700">
                  <li>
                    <strong>Bald Eagles:</strong> Year-round, peak
                    November-January
                  </li>
                  <li>
                    <strong>Humpback Whales:</strong> May-September
                  </li>
                  <li>
                    <strong>Salmon Runs:</strong>
                    <br />• King: May-July
                    <br />• Sockeye: June-August
                    <br />• Pink/Chum: July-September
                    <br />• Coho: August-October
                  </li>
                  <li>
                    <strong>Black Bears:</strong> May-October (fishing for
                    salmon)
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">
                <strong>Note on Weather:</strong> Ketchikan receives an average
                of 150+ inches of rain annually. Pack rain gear regardless of
                when you visit - locals say "If you can't see the mountain, it's
                raining. If you can see it, it's about to rain!" The rain
                creates the lush rainforest that makes Ketchikan special.
              </p>
            </div>
          </div>
        </section>

        {/* Tips Section */}
        <section id="tips" className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Insider Tips
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                💰 Money Matters
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• US dollars only - no need to exchange currency</li>
                <li>• Most places accept credit cards</li>
                <li>• ATMs available downtown (First Bank, Wells Fargo)</li>
                <li>• No sales tax in Alaska - prices shown are final</li>
                <li>• Tipping: 15-20% for services and restaurants</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                👕 What to Wear
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Waterproof jacket and pants (essential!)</li>
                <li>• Comfortable waterproof walking shoes</li>
                <li>• Layers - weather can change quickly</li>
                <li>• Hat with brim for rain protection</li>
                <li>• Small daypack for excursions</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                📸 Photo Opportunities
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Creek Street - best from the bridge looking back</li>
                <li>• Totem poles at Totem Heritage Center</li>
                <li>• Harbor views from Thomas Basin</li>
                <li>• Eagles at Deer Mountain Tribal Hatchery</li>
                <li>• Waterfall at Married Man's Trail</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                🎁 Best Souvenirs
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Smoked salmon from local processors</li>
                <li>• Native art (ensure authenticity certification)</li>
                <li>• Ulu knives (traditional Alaska cutting tool)</li>
                <li>• Local jams made from Alaska berries</li>
                <li>• Rain gauge (humorous local favorite)</li>
              </ul>
            </div>
          </div>

          <div className="bg-green-50 border-l-4 border-green-600 p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              🌟 Local Secret
            </h3>
            <p className="text-gray-700">
              For the best local experience, skip the crowded Creek Street
              during peak hours (10 AM - 2 PM) and visit early morning or late
              afternoon. Head to Rotary Beach Park for a peaceful walk and
              possible wildlife sightings - it's where locals go to escape
              cruise crowds. The Burger Queen food truck (near the tunnel)
              serves amazing halibut burgers that rival any restaurant in town.
            </p>
          </div>
        </section>

        {/* Call to Action */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-2xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Explore Alaska's First City?
            </h2>
            <p className="text-xl mb-6">
              Discover the perfect Alaska cruise that includes Ketchikan in its
              itinerary
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/cruises?destinations=alaska"
                className="bg-white text-blue-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
              >
                View Alaska Cruises
              </Link>
              <Link
                href="/cruises?embarkPorts=seattle,vancouver"
                className="bg-blue-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-400 transition-colors"
              >
                Seattle & Vancouver Departures
              </Link>
            </div>
          </div>
        </section>

        {/* Related Guides */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Related Cruise Guides
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/guides/juneau" className="group">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gradient-to-r from-blue-500 to-blue-600"></div>
                <div className="p-4">
                  <h3 className="font-bold text-lg group-hover:text-blue-600">
                    Juneau
                  </h3>
                  <p className="text-gray-600">
                    Alaska's capital city and glacier wonderland
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/guides/skagway" className="group">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gradient-to-r from-green-500 to-green-600"></div>
                <div className="p-4">
                  <h3 className="font-bold text-lg group-hover:text-blue-600">
                    Skagway
                  </h3>
                  <p className="text-gray-600">
                    Gold Rush history and White Pass Railway
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/guides/sitka" className="group">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gradient-to-r from-purple-500 to-purple-600"></div>
                <div className="p-4">
                  <h3 className="font-bold text-lg group-hover:text-blue-600">
                    Sitka
                  </h3>
                  <p className="text-gray-600">
                    Russian heritage and pristine wilderness
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
