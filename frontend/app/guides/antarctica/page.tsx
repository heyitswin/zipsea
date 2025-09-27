"use client";
import Image from "next/image";

export default function AntarcticaCruiseGuide() {
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
            Antarctica Cruise Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            The Ultimate Expedition to the Seventh Continent
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
                src="https://images.unsplash.com/photo-1473116763249-2faaef81ccda?q=80&w=2000"
                alt="A stunning aerial view of a cruise ship surrounded by icebergs in the calm, turquoise waters of the Antarctic Peninsula"
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
                A journey to Antarctica is not a typical cruise; it is a true
                expedition. Unlike a traditional vacation where port calls offer
                a leisurely day of city exploration, this is a voyage into a
                world of raw, ancient geology and a pristine natural
                environment. This guide provides a definitive overview of the
                experience, offering expert guidance on navigating the
                logistical, physical, and financial realities of a trip to the
                Seventh Continent.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                From the monumental crossing of the Drake Passage to a curated
                look at the unique opportunities offered on shore, this is a
                crucial survival guide designed to inform your choices with
                precision and expertise, ensuring a seamless and unforgettable
                adventure in paradise.
              </p>

              {/* Your Arrival At The Port */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Arrival At The Port
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1599586276033-dc5a929758fa?q=80&w=2000"
                  alt="A close-up shot of a small Zodiac boat filled with passengers in full gear"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The arrival experience for an Antarctic expedition is unlike any
                other. There is no bustling cruise port with shops and taxis.
                Instead, the journey to Antarctica begins at a remote gateway,
                typically Ushuaia in Argentina, which is the world&apos;s
                southernmost city. From here, the ship embarks on the most
                iconic part of the journey: the crossing of the Drake Passage.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The Drake Passage is known for its powerful currents, and the
                experience of sailing across it is considered a rite of passage
                for any adventurer. Upon a ship&apos;s arrival at the Antarctic
                Peninsula or the South Shetland Islands, the landscape itself
                becomes the &quot;port.&quot; Passengers do not disembark at a
                dock but are ferried to shore on small, inflatable boats called
                Zodiacs.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Move: Your Transportation Compass
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Zodiacs:</strong> These motorized inflatable boats are
                  a key part of the experience, offering a stable and exciting
                  way to explore the coastline, glide past icebergs, and get up
                  close to marine life. They are used for both wet landings
                  (stepping directly into shallow surf) and dry landings
                  (stepping onto a pier or dry rock).
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Flights:</strong> For those who wish to avoid the
                  crossing of the Drake Passage, some expedition companies offer
                  fly-cruise options, where a flight takes passengers directly
                  to the South Shetland Islands.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Gear Note:</strong> Waterproof pants are required for
                  all landings and Zodiac rides. Most expedition companies
                  provide an expedition parka and rubber boots for the duration
                  of the trip.
                </p>
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
                  src="https://images.unsplash.com/photo-1685429631350-f92e00c8c218?q=80&w=2000"
                  alt="A group of excited passengers on a Zodiac boat observing a massive iceberg"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Antarctica offers a rich spectrum of experiences, from quiet
                observation to hands-on adventure. A well-planned day involves
                embracing the spontaneity of nature, as the itinerary is often
                dictated by weather conditions and wildlife sightings.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Popular Activities:
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Zodiac Cruises and Shore Landings:</strong> Included
                  in price. Take Zodiacs to landing sites, hike among penguin
                  rookeries and view seals and birds.
                </li>
                <li>
                  <strong>Kayaking and Snowshoeing:</strong> Kayaking provides a
                  unique, silent perspective from the water ($350 per person).
                  Snowshoeing offers deep snow traversal ($150 per person).
                </li>
                <li>
                  <strong>Polar Snorkeling and Scuba Diving:</strong> For the
                  truly adventurous, get an up-close look at marine life beneath
                  the ice (up to $1,195).
                </li>
                <li>
                  <strong>Camping:</strong> Some itineraries offer the
                  opportunity to spend a night camping on the continent ($395
                  per person).
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Important Notes:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • Book adventure activities in advance as space is limited
                  </li>
                  <li>• All activities are subject to weather conditions</li>
                  <li>• Prices are typically in addition to expedition fare</li>
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
                  Planning an Antarctic Expedition?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book through Zipsea to get maximum onboard credit for your
                  expedition activities and gear.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Explore Antarctic Expeditions
                </a>
              </div>

              {/* Dining */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of the Antarctic
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=2000"
                  alt="A gourmet meal with a glass of wine in an elegant restaurant overlooking an icy landscape"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The dining experience on an Antarctic expedition is a key part
                of the overall journey. Unlike a port call in a city, where you
                can explore a wide variety of local eateries, the culinary scene
                here is entirely onboard. These expeditions often offer an
                all-inclusive dining experience, with a focus on gourmet and
                internationally inspired cuisine.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Onboard Dining Experience:
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Main Dining:</strong> Variety of options from casual
                  buffet to formal dining room with world-class chef menus
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Bar and Lounge:</strong> Central social areas with
                  drinks and curated lectures from the expedition team
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Cost:</strong> Dining and most drinks typically
                  included in expedition fare
                </p>
              </div>

              {/* Family Section */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                For the Whole Crew: Antarctica with Kids
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1551009175-15bdf9dcb580?q=80&w=2000"
                  alt="A family bundled in warm gear standing on a pristine beach with penguins"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Antarctica is an incredible destination for families who share a
                passion for adventure and discovery. While the expedition is a
                challenging environment, many cruise lines have programs
                specifically designed for children and teens.
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Junior Explorer Programs:</strong> Dedicated programs
                  for younger guests led by certified field educators with
                  hands-on learning activities
                </li>
                <li>
                  <strong>Interactive Learning:</strong> The ship is a floating
                  classroom with lectures from marine biologists, glaciologists,
                  and historians
                </li>
                <li>
                  <strong>Wildlife Encounters:</strong> Nothing is more
                  captivating for a child than seeing penguin colonies, seals,
                  and whale breaches
                </li>
              </ul>

              {/* Survival Guide */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Zipsea Survival Guide: Insider Tips & Essentials
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1516762689617-e1cffcef479d?q=80&w=2000"
                  alt="Waterproof boots and an expedition parka with warm gloves ready for a day ashore"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Ground: Currency and Tipping
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Tipping is customary on Antarctic expedition cruises. The most
                common practice is to provide a blanket contribution in a single
                envelope at the end of the voyage, which is then divided among
                the crew and staff. An amount of $10 to $15 per guest, per day,
                is advised. Cash is preferred, with US dollars or Euros being
                most convenient.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Weather Essentials: What to Expect
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The climate in Antarctica is predictably cold, but travel season
                during the Antarctic summer is warmer than many visitors expect.
                Average daily high temperatures in the Antarctic Peninsula can
                range from 32°F to 39°F, with lows in the 20s. Dress in layers
                for best comfort.
              </p>

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
                        <strong>Summer</strong> (Nov-Mar)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        32-39
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        26-30
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Peak season for travel, best for wildlife viewing and
                        milder temperatures
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Autumn</strong> (Mar-May)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        26-32
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        19-25
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Temperatures drop, but sea ice is at its most
                        spectacular
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Winter</strong> (Jun-Aug)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        -40 to -58
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        -58 to -76
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Not a travel season; temperatures at their most extreme
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Spring</strong> (Sep-Nov)
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        26-32
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        19-25
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Sea ice begins to break up, temperatures rising
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
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Safety guidelines on an Antarctic expedition are about
                respecting the delicate environment. The International
                Association of Antarctica Tour Operators (IAATO) provides
                mandatory regulations for all travelers to ensure preservation
                of the environment and safety of wildlife.
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Essential Guidelines:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    • Maintain minimum 5 meters (15 feet) distance from wildlife
                  </li>
                  <li>
                    • Do not sit on the ground or leave equipment near animal
                    pathways
                  </li>
                  <li>
                    • Clean boots at designated stations before and after every
                    landing (biosecurity)
                  </li>
                  <li>
                    • Pack essential gear (waterproof pants, warm base layer) in
                    carry-on luggage
                  </li>
                  <li>
                    • Bring extra batteries for cameras/phones (cold drains them
                    quickly)
                  </li>
                </ul>
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
                  Ready for Your Antarctic Adventure?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Get the best deals and maximum onboard credit for your
                  expedition cruise with Zipsea.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Your Expedition
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
                A day in Antarctica is a testament to the power and beauty of
                our planet. It is a journey that requires preparation and a
                willingness to be guided by the forces of nature. The strategic
                selection of a port-to-city transport method is replaced by a
                reliance on Zodiacs and the wisdom of an expedition team.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                With a clear understanding of the logistics, a sense of purpose,
                and an appreciation for the raw beauty of the continent, you are
                well-equipped to craft a day that is not just a visit but a
                cherished highlight of any cruise.
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
