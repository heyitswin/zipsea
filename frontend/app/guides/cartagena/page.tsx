"use client";
import Image from "next/image";
import Link from "next/link";

export default function CartagenaGuidePage() {
  return (
    <main style={{ backgroundColor: "#F6F3ED" }}>
      {/* Hero Section */}
      <section
        className="relative py-[120px] md:py-[200px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="https://images.pexels.com/photos/5321464/pexels-photo-5321464.jpeg"
            alt="Aerial view of Cartagena Colombia Old City walls"
            fill
            className="object-cover opacity-30"
            priority
          />
        </div>
        <div className="relative max-w-4xl mx-auto px-8 text-center">
          <h1
            className="font-whitney font-black uppercase text-[48px] md:text-[80px] mb-6"
            style={{
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "#F7F170",
            }}
          >
            Cartagena Cruise Port Guide
          </h1>
          <h2 className="font-geograph text-white text-[20px] md:text-[24px] leading-relaxed mb-8 max-w-3xl mx-auto">
            Colonial charm meets Caribbean vibes in Colombia's most captivating port city with colorful streets and historic fortresses
          </h2>
        </div>
      </section>

      {/* Separator */}
      <div
        className="w-full h-[30px]"
        style={{
          backgroundImage: 'url("/images/separator-5.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "507px 30px",
        }}
      />

      {/* Introduction */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Welcome to Cartagena de Indias
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Cartagena, Colombia's crown jewel on the Caribbean coast, offers cruise passengers an intoxicating blend of Spanish colonial architecture, vibrant culture, and tropical beauty. This UNESCO World Heritage city captivates with its well-preserved Old Town, massive stone fortifications, and colorful facades.
            </p>
            <p>
              Located at the Sociedad Portuaria cruise terminal in Manga Island, just minutes from the historic center, Cartagena provides easy access to centuries of history, bustling markets, pristine beaches, and the warmth of Colombian hospitality.
            </p>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/87430/palm-trees-beach-beautiful-beach-sand-beach-87430.jpeg"
          alt="Cartagena beach with palm trees"
          fill
          className="object-cover"
        />
      </section>

      {/* Port Information */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Your Arrival at the Port
          </h2>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Sociedad Portuaria Terminal
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              The modern cruise terminal at Manga Island sits just 3 kilometers from Cartagena's historic Old City. The port offers duty-free shopping, restaurants, and cultural performances right at the terminal.
            </p>
            <p>
              Free shuttle buses typically run from the terminal to the main entrance of the walled city (Puerta del Reloj), taking about 10-15 minutes. This convenient service makes independent exploration particularly appealing.
            </p>
          </div>

          {/* Transportation Table */}
          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Transportation Options
          </h3>
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[#0E1B4D]">
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Option</th>
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Cost (USD)</th>
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Time</th>
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Best For</th>
                </tr>
              </thead>
              <tbody className="font-geograph text-[16px]">
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Free Shuttle</td>
                  <td className="py-3 px-4">Free</td>
                  <td className="py-3 px-4">10-15 min</td>
                  <td className="py-3 px-4">Old City exploration</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Taxi</td>
                  <td className="py-3 px-4">$5-10</td>
                  <td className="py-3 px-4">10 min</td>
                  <td className="py-3 px-4">Direct to specific sites</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Walking</td>
                  <td className="py-3 px-4">Free</td>
                  <td className="py-3 px-4">30-40 min</td>
                  <td className="py-3 px-4">Scenic but hot</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Horse Carriage</td>
                  <td className="py-3 px-4">$30-50</td>
                  <td className="py-3 px-4">45-60 min tour</td>
                  <td className="py-3 px-4">Romantic city tour</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-[#0E1B4D] text-white p-6 rounded-lg">
            <p className="font-geograph text-[16px]">
              <strong className="text-[#F7F170]">Negotiation Tip:</strong> Always agree on taxi fares before getting in. Official taxis are yellow. For horse carriages, negotiate hard - start at 50% of asking price.
            </p>
          </div>
        </div>
      </section>

      {/* Activities Section */}
      <section className="py-[40px] md:py-[60px] bg-white">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Top Adventures & Excursions
          </h2>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Historic Old City Walking Tour
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              The walled Old City (Ciudad Amurallada) is a UNESCO World Heritage site with colorful colonial buildings, flower-filled balconies, and centuries of history.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Clock Tower Gate (Torre del Reloj):</strong> Main entrance to the Old City</li>
              <li><strong>Plaza Santo Domingo:</strong> Lively square with Botero sculpture</li>
              <li><strong>Las Bóvedas:</strong> Former dungeons now housing artisan shops</li>
              <li><strong>Palace of the Inquisition:</strong> Museum of colonial history</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Fortress & Castle Tours
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Castillo San Felipe:</strong> Largest Spanish fortress in the Americas ($8 entry)</li>
              <li><strong>City Walls Walk:</strong> Sunset stroll along ancient fortifications</li>
              <li><strong>Convento de la Popa:</strong> Hilltop monastery with panoramic views ($5)</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Popular Shore Excursions
          </h3>
          <div className="grid gap-4">
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Rosario Islands Day Trip</h4>
              <p className="font-geograph text-[#666]">Beach paradise with snorkeling and lunch • 6 hours • $80-120/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Emerald Museum & Shopping</h4>
              <p className="font-geograph text-[#666]">Colombia's famous emeralds with education • 3 hours • $40-60/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Getsemaní Street Art Tour</h4>
              <p className="font-geograph text-[#666]">Vibrant neighborhood with graffiti art • 2 hours • $25-35/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Mud Volcano Experience</h4>
              <p className="font-geograph text-[#666]">Totumo Volcano mud bath adventure • 4 hours • $50-70/person</p>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/29433389/pexels-photo-29433389.jpeg"
          alt="Colorful colonial buildings in Cartagena"
          fill
          className="object-cover"
        />
      </section>

      {/* Dining Section */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Sip & Savor: Colombian Cuisine
          </h2>

          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              Cartagena's culinary scene blends Caribbean flavors with Colombian traditions, featuring fresh seafood, tropical fruits, and aromatic spices that reflect the city's diverse cultural heritage.
            </p>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Must-Try Local Dishes
          </h3>
          <div className="grid gap-4 mb-8">
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Arepas de Huevo</h4>
              <p className="font-geograph text-[#666]">Fried corn cakes stuffed with egg - perfect street food</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Ceviche Cartagenero</h4>
              <p className="font-geograph text-[#666]">Local style with shrimp, octopus, and tangy citrus</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Posta Negra</h4>
              <p className="font-geograph text-[#666]">Slow-cooked beef in sweet cola-based sauce</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Coconut Rice</h4>
              <p className="font-geograph text-[#666]">Sweet and savory rice cooked in coconut milk</p>
            </div>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Recommended Restaurants
          </h3>
          <div className="space-y-4">
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">La Cevichería</h4>
                  <p className="font-geograph text-[#666]">Anthony Bourdain's favorite ceviche spot</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$10-20</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Restaurante Don Juan</h4>
                  <p className="font-geograph text-[#666]">Upscale Colombian cuisine in colonial setting</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$20-35</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">El Boliche Cebichería</h4>
                  <p className="font-geograph text-[#666]">Local favorite for seafood</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$8-15</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Café del Mar</h4>
                  <p className="font-geograph text-[#666]">City wall sunset views with cocktails</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$15-25</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beach & Shopping Section */}
      <section className="py-[40px] md:py-[60px] bg-white">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Beaches & Shopping
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Nearby Beaches
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Bocagrande:</strong> City beach, 15 min by taxi</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Playa Blanca:</strong> White sand paradise, 45 min by boat</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Rosario Islands:</strong> Pristine archipelago day trip</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>La Boquilla:</strong> Local beach with fresh seafood</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Shopping Spots
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Las Bóvedas:</strong> Handicrafts in old dungeons</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Portal de los Dulces:</strong> Traditional sweets</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Emerald Museum:</strong> Colombian emeralds</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Plaza San Diego:</strong> Local artisan market</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/2433868/pexels-photo-2433868.jpeg"
          alt="Cartagena street scene with vendors"
          fill
          className="object-cover"
        />
      </section>

      {/* Practical Tips */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Insider Tips & Essentials
          </h2>

          <div className="grid gap-6">
            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Currency & Payment
              </h3>
              <p className="font-geograph text-[#666]">
                Colombian Pesos (COP) is official currency. US dollars accepted at some tourist spots but at poor rates. ATMs widely available. Credit cards accepted at established businesses. Exchange money at casas de cambio for best rates.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Vendor Interaction
              </h3>
              <p className="font-geograph text-[#666]">
                Street vendors can be persistent but friendly. Polite "No, gracias" usually works. Negotiate everything - start at 30-40% of asking price. Be wary of "free" items like hats or bracelets - they'll demand payment later.
              </p>
            </div>

            <div className="bg-[#F7F170] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                ⚠️ Safety Tips
              </h3>
              <p className="font-geograph text-[#0E1B4D] font-bold">
                Stay within tourist areas. Don't display jewelry or expensive cameras. Use official yellow taxis only. Avoid isolated areas and beaches after dark. Keep copies of documents separate from originals.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Weather & What to Wear
              </h3>
              <p className="font-geograph text-[#666]">
                Hot and humid year-round (80-90°F). Light, breathable clothing essential. Comfortable walking shoes for cobblestones. Sun protection crucial. Brief afternoon showers possible. December-March slightly cooler with more breeze.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Cultural Etiquette
              </h3>
              <p className="font-geograph text-[#666]">
                Colombians are warm and friendly. Basic Spanish greatly appreciated. Tipping: 10% voluntary at restaurants (often included). Small tips for guides and drivers expected. Dress modestly when visiting churches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Images */}
      <section className="grid md:grid-cols-2">
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/12858513/pexels-photo-12858513.jpeg"
            alt="Cartagena fortress walls at sunset"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
            alt="Colombian pesos currency"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-[60px] md:py-[80px] bg-[#0E1B4D]">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="font-whitney font-black text-[36px] md:text-[48px] text-[#F7F170] mb-4">
            Ready to Explore Cartagena?
          </h2>
          <p className="font-geograph text-white text-[20px] mb-8">
            Book your Caribbean cruise with Zipsea and receive maximum onboard credit
          </p>
          <Link
            href="/cruises?region=caribbean"
            className="inline-block bg-[#F7F170] text-[#0E1B4D] px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-[#F7F170]/90 transition-colors"
          >
            Find Caribbean Cruises
          </Link>
        </div>
      </section>

      {/* Final Summary */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Before You Sail Away
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Cartagena offers an enchanting blend of colonial history, Caribbean culture, and modern Colombian vibrancy. From exploring the colorful streets of the walled city to relaxing on pristine beaches, this port delivers unforgettable experiences steeped in centuries of history.
            </p>
            <p>
              Whether you're walking the ancient walls at sunset, bargaining in Las Bóvedas, savoring fresh ceviche, or dancing to champeta music in Getsemaní, Cartagena provides an authentic taste of Colombia's Caribbean soul that will leave you planning your return.
            </p>
            <p className="font-bold text-[#0E1B4D]">
              Remember: All Zipsea cruise bookings include maximum onboard credit for shore excursions, specialty dining, and shopping in port!
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
