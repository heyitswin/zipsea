import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Destination Port Guides - Caribbean & Bahamas Cruise Ports | Zipsea",
  description:
    "Comprehensive cruise port guides for Caribbean and Bahamas destinations. Expert tips on beaches, excursions, dining, and transportation for every major cruise port.",
  keywords:
    "cruise port guides, Caribbean ports, Bahamas cruise ports, cruise destination guides, shore excursions, port tips, cruise terminal guides, beach access, port transportation",
  openGraph: {
    title: "Cruise Destination Port Guides - Expert Tips for Every Port",
    description:
      "Complete guides for Caribbean and Bahamas cruise ports with insider tips on beaches, attractions, dining, and getting around.",
    type: "website",
    url: "https://www.zipsea.com/destination-port-guides",
    siteName: "Zipsea",
    images: [
      {
        url: "https://www.zipsea.com/images/port-guides-og.jpg",
        width: 1200,
        height: 630,
        alt: "Caribbean cruise ports guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Destination Port Guides - Caribbean & Bahamas Cruise Ports",
    description:
      "Expert guides for every major cruise port with tips on beaches, excursions, and local transportation.",
  },
  alternates: {
    canonical: "https://www.zipsea.com/destination-port-guides",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// Port guide data
const portGuides = [
  {
    slug: "nassau",
    title: "Nassau, Bahamas",
    name: "Nassau Cruise Port",
    shortDescription:
      "Paradise Island beaches, Atlantis day passes, Fish Fry local cuisine, and crystal-clear snorkeling at Blue Lagoon Island. Your gateway to the Bahamas.",
    highlights: [
      "Atlantis Resort",
      "Paradise Island",
      "Junkanoo Beach",
      "Queen's Staircase",
    ],
  },
  {
    slug: "cozumel",
    title: "Cozumel, Mexico",
    name: "Cozumel Cruise Port",
    shortDescription:
      "World-class reef diving, pristine beach clubs, ancient Mayan ruins, and vibrant Mexican culture. The Caribbean's premier snorkeling destination.",
    highlights: [
      "Palancar Reef",
      "Paradise Beach",
      "San Gervasio Ruins",
      "Mr. Sancho's Beach Club",
    ],
  },
  {
    slug: "barcelona",
    title: "Barcelona, Spain",
    name: "Barcelona Cruise Port",
    shortDescription:
      "Gaudí's architectural masterpieces, Gothic Quarter exploration, Las Ramblas strolls, and authentic tapas tours. Mediterranean culture meets modernist art.",
    highlights: [
      "Sagrada Familia",
      "Park Güell",
      "Gothic Quarter",
      "La Boqueria Market",
    ],
  },
  {
    slug: "antarctica",
    title: "Antarctica Expedition",
    name: "Antarctica (Seventh Continent)",
    shortDescription:
      "The ultimate expedition cruise destination. Drake Passage crossing, Zodiac landings, penguin colonies, whale watching, and pristine wilderness in Earth's last frontier.",
    highlights: [
      "Drake Passage",
      "Penguin Colonies",
      "Zodiac Landings",
      "Whale Watching",
    ],
  },
  {
    slug: "aruba",
    title: "Aruba, Caribbean",
    name: "Aruba Cruise Port",
    shortDescription:
      "One Happy Island with pristine beaches, Dutch colonial charm, and year-round sunshine. Walk to downtown Oranjestad, ride the free streetcar, or relax on Eagle Beach.",
    highlights: [
      "Eagle Beach",
      "Free Streetcar",
      "Dutch Heritage",
      "Palm Beach",
    ],
  },
  {
    slug: "bermuda",
    title: "Bermuda",
    name: "Bermuda Cruise Ports",
    shortDescription:
      "Pink sand beaches, crystal caves, and British colonial charm. Multi-day stays at King's Wharf, Hamilton, or St. George's with world-class golf and snorkeling.",
    highlights: [
      "Horseshoe Bay",
      "Crystal Caves",
      "Royal Naval Dockyard",
      "Pink Sand Beaches",
    ],
  },
  {
    slug: "bonaire",
    title: "Bonaire, Caribbean",
    name: "Bonaire Cruise Port",
    shortDescription:
      "Shore-diving capital of the world with 86 marked dive sites, walkable Kralendijk downtown, Klein Bonaire snorkeling, and flamingo sanctuaries in pristine marine parks.",
    highlights: [
      "Klein Bonaire",
      "86 Dive Sites",
      "Walkable Kralendijk",
      "Donkey Sanctuary",
    ],
  },
  {
    slug: "bridgetown",
    title: "Bridgetown, Barbados",
    name: "Bridgetown Cruise Port",
    shortDescription:
      "UNESCO World Heritage site with pristine beaches, sea turtle swimming in Carlisle Bay, Harrison's Cave, Mount Gay rum tours, and authentic Bajan cuisine.",
    highlights: [
      "Carlisle Bay Turtles",
      "Harrison's Cave",
      "UNESCO Heritage",
      "Mount Gay Rum",
    ],
  },
  {
    slug: "cabo-san-lucas",
    title: "Cabo San Lucas, Mexico",
    name: "Cabo San Lucas Cruise Port",
    shortDescription:
      "Where Pacific meets Sea of Cortez with iconic El Arco, world-class sport fishing, Medano Beach clubs, water taxis to Lover's Beach, and vibrant nightlife.",
    highlights: ["El Arco", "Sport Fishing", "Medano Beach", "Cabo Wabo"],
  },
  {
    slug: "cartagena",
    title: "Cartagena, Colombia",
    name: "Cartagena Cruise Port",
    shortDescription:
      "Colonial charm meets Caribbean vibes in Colombia's UNESCO World Heritage city with colorful streets, massive fortresses, emerald shopping, and pristine beaches.",
    highlights: [
      "Old City Walls",
      "Castillo San Felipe",
      "Las Bóvedas",
      "Rosario Islands",
    ],
  },
  {
    slug: "glacier-bay",
    title: "Glacier Bay, Alaska",
    name: "Glacier Bay National Park",
    shortDescription:
      "UNESCO World Heritage Site with tidewater glaciers, wildlife viewing, and scenic cruising. Experience Margerie Glacier calving, humpback whales, and National Park Rangers aboard.",
    highlights: [
      "Margerie Glacier",
      "Wildlife Viewing",
      "Scenic Cruising",
      "Park Rangers",
    ],
  },
  {
    slug: "grand-cayman",
    title: "Grand Cayman, Cayman Islands",
    name: "Grand Cayman Cruise Port",
    shortDescription:
      "Tender port to paradise with world-famous Seven Mile Beach, Stingray City encounters, resort day passes, and authentic Caymanian cuisine in upscale George Town.",
    highlights: [
      "Seven Mile Beach",
      "Stingray City",
      "Tender Port",
      "Turtle Centre",
    ],
  },
  {
    slug: "hong-kong",
    title: "Hong Kong",
    name: "Hong Kong Cruise Ports",
    shortDescription:
      "Two distinct terminals in the Pearl of the Orient. Ocean Terminal offers walkable Tsim Sha Tsui exploration while Kai Tak requires transport. Victoria Peak, dim sum, and Star Ferry await.",
    highlights: ["Victoria Peak", "Dim Sum", "Star Ferry", "Harbour City"],
  },
  {
    slug: "honolulu",
    title: "Honolulu, Hawaii",
    name: "Port of Honolulu",
    shortDescription:
      "Downtown port with walkable access to historic sites. Pearl Harbor tours, Waikiki Beach, Diamond Head hike, and authentic plate lunch await in the Aloha State capital.",
    highlights: [
      "Pearl Harbor",
      "Waikiki Beach",
      "Diamond Head",
      "Plate Lunch",
    ],
  },
  {
    slug: "juneau",
    title: "Juneau, Alaska",
    name: "Juneau Cruise Port",
    shortDescription:
      "Alaska's capital accessible only by air or sea. Mendenhall Glacier, Mount Roberts Tramway, whale watching, and fresh king crab await in this gold rush frontier town.",
    highlights: [
      "Mendenhall Glacier",
      "Mount Roberts",
      "Whale Watching",
      "King Crab",
    ],
  },
];

export default function DestinationPortGuidesPage() {
  return (
    <main style={{ backgroundColor: "#F6F3ED" }}>
      {/* Hero Section */}
      <section
        className="py-[80px] md:py-[120px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[42px] md:text-[72px]"
            style={{
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "#F7F170",
            }}
          >
            Destination Port Guides
          </h1>
          <h2 className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Expert guides for Caribbean and Bahamas cruise ports with insider
            tips on beaches, excursions, dining, and getting around
          </h2>
        </div>
      </section>

      {/* Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-2.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Port Guides List */}
      <section className="py-[60px] md:py-[100px]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="space-y-4">
            {portGuides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group block"
              >
                <div className="bg-white rounded-[10px] border border-[#E5E5E5] p-6 hover:border-[#2238C3] transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="font-whitney font-black uppercase text-[20px] text-[#0E1B4D] mb-2">
                        {guide.title}
                      </h3>
                      <p className="font-geograph text-[14px] text-[#666] leading-relaxed mb-3">
                        {guide.shortDescription}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {guide.highlights.map((highlight) => (
                          <span
                            key={highlight}
                            className="inline-block px-3 py-1 bg-[#F7F170] rounded-full font-geograph text-[12px] text-[#0E1B4D]"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className="font-geograph font-semibold text-[#2238C3] group-hover:underline whitespace-nowrap">
                        Read Guide →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-[60px]">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-whitney font-black uppercase text-[32px] text-[#0E1B4D] mb-6 text-center">
            Expert Port Guides for Your Cruise Vacation
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Our comprehensive destination port guides provide everything you
              need to make the most of your time in each cruise port. Written by
              experienced cruisers and local experts, these guides offer insider
              tips that save you time and money while ensuring unforgettable
              experiences.
            </p>
            <p>
              Each port guide covers essential information including terminal
              logistics, transportation options, must-see attractions, beach
              recommendations, local dining spots, and shopping areas. We
              include current taxi rates, walking distances, and time estimates
              to help you plan your perfect port day.
            </p>
            <p>
              Whether you're seeking adventure through snorkeling and diving,
              cultural experiences at historical sites, relaxation at beach
              clubs, or family-friendly activities, our guides help you choose
              the right excursions and activities for your travel style and
              budget.
            </p>
            <p>
              We regularly update our guides with the latest information on port
              facilities, new attractions, and seasonal considerations. Each
              guide includes practical tips like where to find free WiFi, which
              beaches have the calmest waters, and how to avoid tourist traps
              while supporting local businesses.
            </p>
            <p>
              Remember that all Zipsea cruise bookings include maximum onboard
              credit, giving you extra funds for shore excursions, specialty
              dining, and port shopping. Use our guides to make informed
              decisions about where to spend your time and money in each
              destination.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="font-geograph font-bold text-[18px] text-[#0E1B4D] mb-4 text-center">
            Quick Access to Port Guides:
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {portGuides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="inline-block px-6 py-2 bg-white border border-[#E5E5E5] rounded-full hover:bg-[#2238C3] hover:text-white transition-colors font-geograph text-[14px]"
              >
                {guide.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* More Guides Coming Soon */}
      <section className="py-[40px] bg-[#F7F170]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="font-geograph text-[16px] text-[#0E1B4D]">
            <strong>More destination guides coming soon!</strong> We're
            constantly adding new port guides for popular cruise destinations
            including Grand Cayman, Jamaica, Costa Maya, Key West, St. Thomas,
            and more expedition destinations.
          </p>
        </div>
      </section>
    </main>
  );
}
