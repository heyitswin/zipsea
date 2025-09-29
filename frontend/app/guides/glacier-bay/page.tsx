"use client";
import Image from "next/image";
import Link from "next/link";

export default function GlacierBayCruiseGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelGuide",
    name: "Glacier Bay National Park Cruise Guide",
    description:
      "Complete guide to cruising Glacier Bay National Park, Alaska. Discover glaciers, wildlife viewing, scenic cruising, and park ranger programs.",
    url: "https://www.zipsea.com/guides/glacier-bay",
    image: [
      "https://images.pexels.com/photos/20582185/pexels-photo-20582185.jpeg",
      "https://images.pexels.com/photos/6248989/pexels-photo-6248989.jpeg",
      "https://images.pexels.com/photos/4156977/pexels-photo-4156977.jpeg",
    ],
    author: {
      "@type": "Organization",
      name: "Zipsea",
      url: "https://www.zipsea.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Zipsea",
      url: "https://www.zipsea.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.zipsea.com/logo.png",
      },
    },
    datePublished: "2024-09-29",
    dateModified: new Date().toISOString(),
    keywords:
      "Glacier Bay cruise, Alaska cruise, Glacier Bay National Park, Margerie Glacier, Grand Pacific Glacier, Alaska wildlife, cruise scenic day",
    mainEntity: {
      "@type": "Place",
      name: "Glacier Bay National Park",
      address: {
        "@type": "PostalAddress",
        addressRegion: "Alaska",
        addressCountry: "US",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 58.5,
        longitude: -136.0,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
            The Ultimate Cruise Guide to Glacier Bay
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Experience Alaska's Crown Jewel of Glaciers and Wildlife
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
                src="https://images.pexels.com/photos/20582185/pexels-photo-20582185.jpeg"
                alt="Stunning view of glaciers and mountains in Glacier Bay National Park"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Introduction */}
            <div className="prose prose-lg max-w-none">
              <p
                className="font-geograph text-[18px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Glacier Bay National Park represents one of Alaska's most
                spectacular natural wonders, accessible only by boat or
                seaplane. This UNESCO World Heritage Site encompasses 3.3
                million acres of rugged mountains, dynamic glaciers, temperate
                rainforest, wild coastlines, and deep sheltered fjords. For
                cruise passengers, it offers a unique scenic cruising day where
                the ship itself becomes your viewing platform for one of
                nature's most dramatic displays.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Limited Access:</strong> Only two cruise ships are
                  permitted per day in Glacier Bay, making this a coveted and
                  exclusive experience on Alaska itineraries.
                </p>
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Park Rangers Aboard:</strong> National Park Service
                  rangers board your ship at Bartlett Cove to provide expert
                  narration throughout the scenic cruising day.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>No Port Stop:</strong> This is a scenic cruising day -
                  ships navigate the bay for wildlife and glacier viewing but
                  don't dock anywhere within the park.
                </p>
              </div>

              {/* What Makes It Special */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                What Makes Glacier Bay Special
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Glacier Bay offers the highest concentration of tidewater
                glaciers on the planet. The bay itself is a recent geological
                phenomenon - just 250 years ago, it was entirely filled with
                ice. Today, it stretches 65 miles from the ocean to the back of
                the deepest inlets, providing cruise passengers with an
                unparalleled journey through landscapes that have been revealed
                by retreating ice.
              </p>

              {/* CTA 1 - After Introduction */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Experience Glacier Bay?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Find the perfect Alaska cruise with exclusive Glacier Bay
                  permits.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Alaska Cruises
                </a>
              </div>

              {/* Glacier Viewing Highlights */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Glacier Viewing Highlights
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/6248989/pexels-photo-6248989.jpeg"
                  alt="Margerie Glacier calving into Glacier Bay"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Margerie Glacier
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The star attraction for most cruises, this mile-wide tidewater
                glacier rises 250 feet above the waterline with ice extending
                100 feet below. Ships typically spend 30-60 minutes here,
                allowing passengers to witness and hear the thunderous crack of
                calving ice. The glacier advances 6-8 feet per day, making it
                one of the few advancing glaciers in the park.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Grand Pacific Glacier
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Adjacent to Margerie, this glacier sits at the Alaska-Canada
                border and appears darker due to the rock and sediment it
                carries. Together with Margerie, it creates Tarr Inlet's
                dramatic glacial amphitheater.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Johns Hopkins Glacier
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Weather and ice conditions permitting, some cruises venture into
                Johns Hopkins Inlet to view this massive glacier and the
                surrounding peaks that rise over 6,000 feet directly from sea
                level.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Lamplugh Glacier
              </h3>
              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Known for its striking blue ice, Lamplugh Glacier offers another
                spectacular tidewater glacier experience on the western side of
                the bay.
              </p>

              {/* Wildlife Viewing */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Wildlife Viewing Opportunities
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/4156977/pexels-photo-4156977.jpeg"
                  alt="Wildlife in Glacier Bay - whales, seals, and seabirds"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4
                    className="font-geograph font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Marine Mammals
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Humpback whales (summer feeding grounds)</li>
                    <li>• Orca pods occasionally spotted</li>
                    <li>• Steller sea lions on South Marble Island</li>
                    <li>• Harbor seals on floating ice</li>
                    <li>• Sea otters in kelp beds</li>
                  </ul>
                </div>
                <div>
                  <h4
                    className="font-geograph font-bold text-[18px] mb-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    Birds & Land Animals
                  </h4>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Bald eagles soaring overhead</li>
                    <li>• Puffins (tufted and horned)</li>
                    <li>• Brown bears along shorelines</li>
                    <li>• Mountain goats on steep cliffs</li>
                    <li>• Arctic terns and kittiwakes</li>
                  </ul>
                </div>
              </div>

              {/* Best Viewing Spots */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Best Viewing Spots on Your Ship
              </h2>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Prime Locations for Glacier Bay Viewing
                </h3>
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Forward Observation Decks:</strong> Usually decks
                    10-12, offering panoramic views as the ship approaches
                    glaciers
                  </li>
                  <li>
                    <strong>Promenade Decks:</strong> Protected from wind while
                    maintaining excellent sightlines
                  </li>
                  <li>
                    <strong>Balcony Cabins (starboard):</strong> Right side
                    typically offers best glacier views on northbound approach
                  </li>
                  <li>
                    <strong>Observation Lounges:</strong> Indoor viewing with
                    floor-to-ceiling windows - perfect for unpredictable weather
                  </li>
                </ul>
              </div>

              {/* Ranger Programs */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                National Park Ranger Programs
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Park Rangers board your ship early in the morning at Bartlett
                Cove and remain aboard throughout your Glacier Bay cruise. They
                provide:
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  • Live narration from the bridge during glacier approaches
                </li>
                <li>• Educational presentations in the ship's theater</li>
                <li>• Junior Ranger programs for children</li>
                <li>• Roving interpretation on deck during scenic cruising</li>
                <li>• Native Tlingit cultural presentations</li>
              </ul>

              {/* CTA 2 - After Wildlife Section */}
              <div
                className="mt-12 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to See Alaska's Wildlife?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book your Glacier Bay cruise and witness incredible wildlife
                  in their natural habitat.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Explore Alaska Cruises
                </a>
              </div>

              {/* Photography Tips */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Photography Tips for Glacier Bay
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/8495483/pexels-photo-8495483.jpeg"
                  alt="Photographer capturing Glacier Bay scenery"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Bring a telephoto lens:</strong> Wildlife and
                    glacier details benefit from 200-400mm range
                  </li>
                  <li>
                    <strong>Protect from spray:</strong> Glacier calving creates
                    waves - keep lens cloths handy
                  </li>
                  <li>
                    <strong>Shoot in burst mode:</strong> Capture the moment of
                    ice calving into the water
                  </li>
                  <li>
                    <strong>Include scale references:</strong> Other ships,
                    kayakers, or birds help show glacier magnitude
                  </li>
                  <li>
                    <strong>Best light:</strong> Early morning and late
                    afternoon offer dramatic shadows on ice formations
                  </li>
                </ul>
              </div>

              {/* What to Bring */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                What to Bring for Your Glacier Bay Day
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Essential Items
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Warm, waterproof jacket</li>
                    <li>• Hat and gloves (even in summer)</li>
                    <li>• Binoculars for wildlife viewing</li>
                    <li>• Camera with extra batteries</li>
                    <li>• Sunglasses and sunscreen</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3
                    className="font-geograph font-bold text-[18px] mb-3"
                    style={{ color: "#0E1B4D" }}
                  >
                    Nice to Have
                  </h3>
                  <ul
                    className="font-geograph text-[14px] space-y-1"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>• Layered clothing system</li>
                    <li>• Scarf or neck gaiter</li>
                    <li>• Thermos for hot beverages</li>
                    <li>• Field guide for Alaska wildlife</li>
                    <li>• Waterproof phone case</li>
                  </ul>
                </div>
              </div>

              {/* CTA 3 - After What to Bring */}
              <div
                className="mt-8 p-6 rounded-lg text-center"
                style={{ backgroundColor: "#F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Start Planning Your Glacier Bay Adventure
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Limited permits make Glacier Bay exclusive. Reserve your spot
                  today.
                </p>
                <a
                  href="/cruises?region=alaska"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  View Available Cruises
                </a>
              </div>

              {/* Weather Expectations */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Weather & Conditions
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Glacier Bay weather is notoriously unpredictable. Even in
                summer, temperatures on deck can range from 40-60°F (4-15°C),
                and it's typically 10-15 degrees cooler near the glaciers due to
                katabatic winds flowing off the ice. Rain is possible any day,
                with July and August being the driest months. May and September
                cruises should prepare for colder conditions.
              </p>

              {/* Cruise Lines */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Cruise Lines Visiting Glacier Bay
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Due to strict environmental protections, only select cruise
                lines have permits to enter Glacier Bay. Major lines with
                regular access include Princess, Holland America, Norwegian, and
                select smaller expedition cruise operators. The two-ship-per-day
                limit means not all Alaska cruises include Glacier Bay - verify
                this when booking if it's a priority.
              </p>

              {/* Planning Your Day */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Planning Your Glacier Bay Day
              </h2>

              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3
                  className="font-geograph font-bold text-[20px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Typical Glacier Bay Timeline
                </h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      6:00 AM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Ship enters Glacier Bay, Rangers board at Bartlett Cove
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      7:00 AM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Scenic cruising begins, South Marble Island sea lion
                      colony
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      9:00 AM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Entering glacier territory, first glacier sightings
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      11:00 AM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Margerie Glacier approach and viewing (30-60 minutes)
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      2:00 PM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Johns Hopkins Inlet (conditions permitting)
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      4:00 PM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Return journey south through the bay
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="font-bold mr-3"
                      style={{ color: "#0E1B4D" }}
                    >
                      7:00 PM:
                    </span>
                    <span style={{ color: "#0E1B4D" }}>
                      Rangers disembark, ship exits Glacier Bay
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA Section */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg text-center mt-12">
                <h2
                  className="font-whitney font-black text-[32px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Ready to Experience Glacier Bay?
                </h2>
                <p
                  className="font-geograph text-[18px] mb-6"
                  style={{ color: "#0E1B4D" }}
                >
                  Find your perfect Alaska cruise with guaranteed Glacier Bay
                  access
                </p>
                <Link
                  href="/cruises?region=alaska"
                  className="inline-block bg-[#0E1B4D] text-white px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-opacity-90 transition-all"
                >
                  Search Alaska Cruises →
                </Link>
              </div>

              {/* Final Tips */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Insider Tips for Glacier Bay
              </h2>

              <div className="space-y-4 mb-8">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>
                      Book starboard cabins northbound, port southbound:
                    </strong>{" "}
                    These typically offer the best glacier views, though ships
                    rotate for equal viewing.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Attend the Ranger talks:</strong> Learn about
                    glacier formation, wildlife behavior, and Tlingit culture
                    from experts.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Wake up early:</strong> Wildlife is most active in
                    morning hours, and you'll beat crowds to the best viewing
                    spots.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Listen for calving:</strong> Turn off music and
                    conversations - the sound of cracking ice carries for miles.
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <p
                    className="font-geograph text-[16px]"
                    style={{ color: "#0E1B4D" }}
                  >
                    <strong>Pack patience:</strong> Ships wait for optimal
                    viewing conditions - glacier approaches depend on ice,
                    weather, and wildlife.
                  </p>
                </div>
              </div>

              {/* Conclusion */}
              <p
                className="font-geograph text-[18px] leading-relaxed italic"
                style={{ color: "#0E1B4D" }}
              >
                Glacier Bay National Park offers a once-in-a-lifetime experience
                that epitomizes the raw beauty and power of Alaska's wilderness.
                As your ship glides through waters that were solid ice just
                generations ago, you'll understand why this UNESCO World
                Heritage Site remains one of cruising's most sought-after
                destinations.
              </p>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
