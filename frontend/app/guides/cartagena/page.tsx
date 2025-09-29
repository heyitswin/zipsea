"use client";
import Image from "next/image";

export default function CartagenaCruiseGuide() {
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
            Cartagena Cruise Port Guide
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Colonial Charm Meets Caribbean Soul
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
        style={{ backgroundColor: "#F6F3ED" }}
        className="py-[40px] md:py-[80px]"
      >
        <article className="max-w-4xl mx-auto px-8">
          <div className="bg-white rounded-lg p-8 md:p-12 shadow-sm">
            {/* Hero Image */}
            <div className="relative w-full h-[400px] mb-8 rounded-lg overflow-hidden">
              <Image
                src="https://images.pexels.com/photos/5321464/pexels-photo-5321464.jpeg"
                alt="Aerial view of Cartagena Colombia Old City walls"
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
                Welcome to Cartagena de Indias, Colombia's crown jewel on the
                Caribbean coast! This UNESCO World Heritage city captivates
                cruise passengers with its well-preserved Old Town, massive
                stone fortifications, and colorful colonial facades. Located at
                the Sociedad Portuaria cruise terminal in Manga Island, just
                minutes from the historic center, Cartagena offers centuries of
                history, bustling markets, pristine beaches, and the warmth of
                Colombian hospitality.
              </p>

              {/* Port Overview */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Port Overview: Gateway to History
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/87430/palm-trees-beach-beautiful-beach-sand-beach-87430.jpeg"
                  alt="Cartagena beach with palm trees"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The modern cruise terminal at Manga Island sits just 3
                kilometers from Cartagena's historic Old City. The port offers
                duty-free shopping, restaurants, and cultural performances right
                at the terminal. Free shuttle buses typically run from the
                terminal to the main entrance of the walled city (Puerta del
                Reloj), taking about 10-15 minutes.
              </p>

              {/* Getting Around */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Getting Around Cartagena
              </h2>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Transportation Options
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Free Shuttle:</strong> Complimentary to Old City
                  entrance (10-15 min)
                </li>
                <li>
                  <strong>Taxi:</strong> $5-10 USD to specific sites (10 min)
                </li>
                <li>
                  <strong>Walking:</strong> 30-40 minutes scenic but hot
                </li>
                <li>
                  <strong>Horse Carriage:</strong> $30-50 for 45-60 minute
                  romantic tour
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Negotiation Tip:</strong> Always agree on taxi fares
                  before getting in. Official taxis are yellow. For horse
                  carriages, negotiate hard - start at 50% of asking price.
                </p>
              </div>

              {/* Historic Old City */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Historic Old City Walking Tour
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/29433389/pexels-photo-29433389.jpeg"
                  alt="Colorful colonial buildings in Cartagena"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The walled Old City (Ciudad Amurallada) is a UNESCO World
                Heritage site with colorful colonial buildings, flower-filled
                balconies, and centuries of history:
              </p>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Clock Tower Gate (Torre del Reloj):</strong> Main
                  entrance to Old City
                </li>
                <li>
                  <strong>Plaza Santo Domingo:</strong> Lively square with
                  Botero sculpture
                </li>
                <li>
                  <strong>Las Bóvedas:</strong> Former dungeons now housing
                  artisan shops
                </li>
                <li>
                  <strong>Palace of the Inquisition:</strong> Museum of colonial
                  history
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Fortress & Castle Tours
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Castillo San Felipe:</strong> Largest Spanish fortress
                  in Americas ($8 entry)
                </li>
                <li>
                  <strong>City Walls Walk:</strong> Sunset stroll along ancient
                  fortifications
                </li>
                <li>
                  <strong>Convento de la Popa:</strong> Hilltop monastery with
                  panoramic views ($5)
                </li>
              </ul>

              {/* Popular Excursions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Popular Shore Excursions
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Rosario Islands Day Trip
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Beach paradise with snorkeling and lunch
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    6 hours - $80-120 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Emerald Museum & Shopping
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Colombia's famous emeralds with education
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    3 hours - $40-60 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Getsemaní Street Art Tour
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Vibrant neighborhood with graffiti art
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    2 hours - $25-35 per person
                  </p>
                </div>
                <div className="border-l-4 border-[#F7F170] pl-4">
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">
                    Mud Volcano Experience
                  </h4>
                  <p className="font-geograph text-[14px] text-[#666]">
                    Totumo Volcano mud bath adventure
                  </p>
                  <p className="font-geograph font-bold text-[16px] text-[#0E1B4D] mt-2">
                    4 hours - $50-70 per person
                  </p>
                </div>
              </div>

              {/* Colombian Cuisine */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Colombian Cuisine & Dining
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/2433868/pexels-photo-2433868.jpeg"
                  alt="Cartagena street scene with vendors"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Must-Try Local Dishes
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Arepas de Huevo:</strong> Fried corn cakes stuffed
                  with egg
                </li>
                <li>
                  <strong>Ceviche Cartagenero:</strong> Local style with shrimp
                  and octopus
                </li>
                <li>
                  <strong>Posta Negra:</strong> Slow-cooked beef in sweet cola
                  sauce
                </li>
                <li>
                  <strong>Coconut Rice:</strong> Sweet and savory rice in
                  coconut milk
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Recommended Restaurants
              </h3>
              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>La Cevichería:</strong> Anthony Bourdain's favorite
                  ($10-20)
                </li>
                <li>
                  <strong>Restaurante Don Juan:</strong> Upscale Colombian
                  cuisine ($20-35)
                </li>
                <li>
                  <strong>El Boliche Cebichería:</strong> Local seafood favorite
                  ($8-15)
                </li>
                <li>
                  <strong>Café del Mar:</strong> Sunset views on city walls
                  ($15-25)
                </li>
              </ul>

              {/* Beaches & Shopping */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Beaches & Shopping
              </h2>

              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3
                    className="font-geograph font-bold text-[20px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Nearby Beaches
                  </h3>
                  <ul
                    className="font-geograph text-[16px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Bocagrande:</strong> City beach, 15 min taxi
                    </li>
                    <li>
                      • <strong>Playa Blanca:</strong> White sand, 45 min boat
                    </li>
                    <li>
                      • <strong>Rosario Islands:</strong> Pristine archipelago
                    </li>
                    <li>
                      • <strong>La Boquilla:</strong> Local beach with seafood
                    </li>
                  </ul>
                </div>
                <div>
                  <h3
                    className="font-geograph font-bold text-[20px] mb-4"
                    style={{ color: "#0E1B4D" }}
                  >
                    Shopping Spots
                  </h3>
                  <ul
                    className="font-geograph text-[16px] space-y-2"
                    style={{ color: "#0E1B4D" }}
                  >
                    <li>
                      • <strong>Las Bóvedas:</strong> Handicrafts in old
                      dungeons
                    </li>
                    <li>
                      • <strong>Portal de los Dulces:</strong> Traditional
                      sweets
                    </li>
                    <li>
                      • <strong>Emerald Museum:</strong> Colombian emeralds
                    </li>
                    <li>
                      • <strong>Plaza San Diego:</strong> Artisan market
                    </li>
                  </ul>
                </div>
              </div>

              {/* Final Images */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/12858513/pexels-photo-12858513.jpeg"
                    alt="Cartagena fortress walls at sunset"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-[250px] rounded-lg overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
                    alt="Colombian pesos currency"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Insider Tips */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Insider Tips
              </h2>

              <div className="bg-yellow-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  ⚠️ Safety Tips
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Stay within tourist areas. Don't display jewelry or expensive
                  cameras. Use official yellow taxis only. Avoid isolated areas
                  after dark. Keep copies of documents separate from originals.
                </p>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Currency & Vendor Interaction
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Colombian Pesos (COP) is official currency. US dollars
                  accepted at some spots but poor rates. Exchange at casas de
                  cambio. Street vendors persistent but friendly. Negotiate
                  everything - start at 30-40% of asking price.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3
                  className="font-geograph font-bold text-[20px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Weather & What to Wear
                </h3>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  Hot and humid year-round (80-90°F). Light, breathable clothing
                  essential. Comfortable walking shoes for cobblestones. Sun
                  protection crucial. December-March slightly cooler with more
                  breeze.
                </p>
              </div>

              {/* CTA Box */}
              <div
                className="bg-gray-50 p-8 rounded-lg mt-12 text-center"
                style={{ borderLeft: "4px solid #F7F170" }}
              >
                <h3
                  className="font-geograph font-bold text-[24px] mb-3"
                  style={{ color: "#0E1B4D" }}
                >
                  Planning a Cruise to Cartagena?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Browse thousands of cruises that visit Cartagena and get
                  maximum onboard credit with every booking!
                </p>
                <a
                  href="/cruises?region=caribbean"
                  className="inline-block px-6 py-3 bg-[#2238C3] text-white rounded-full text-[16px] font-medium font-geograph hover:opacity-90 transition-all duration-300"
                >
                  Find Caribbean Cruises →
                </a>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
