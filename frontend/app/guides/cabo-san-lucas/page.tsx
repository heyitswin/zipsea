"use client";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const BookingForm = dynamic(() => import("@/app/components/booking-form"), {
  ssr: false,
});

export default function CaboSanLucasGuidePage() {
  return (
    <main style={{ backgroundColor: "#F6F3ED" }}>
      {/* Hero Section */}
      <section
        className="relative py-[120px] md:py-[200px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="https://images.pexels.com/photos/12464323/pexels-photo-12464323.jpeg"
            alt="Aerial view of Cabo San Lucas Marina and Arch"
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
            Cabo San Lucas Cruise Port Guide
          </h1>
          <h2 className="font-geograph text-white text-[20px] md:text-[24px] leading-relaxed mb-8 max-w-3xl mx-auto">
            Where the Pacific meets the Sea of Cortez with dramatic rock formations, world-class fishing, and vibrant nightlife
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
            Welcome to Cabo San Lucas
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Cabo San Lucas sits at the southern tip of Mexico's Baja California Peninsula, where dramatic desert landscapes meet pristine beaches and two bodies of water converge. This tender port destination offers everything from iconic landmarks like El Arco to world-class sport fishing and vibrant beach clubs.
            </p>
            <p>
              As a tender port, cruise ships anchor in the bay while passengers are ferried to the marina. The compact downtown area makes exploration easy, with the marina, beaches, and shopping all within walking distance or a short water taxi ride away.
            </p>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/9400836/pexels-photo-9400836.jpeg"
          alt="Cabo San Lucas Marina with luxury yachts"
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
            The Tender Process
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              Cabo San Lucas is a tender port, meaning cruise ships anchor in the bay and passengers are transported to shore via tender boats. The tender ride takes approximately 10-15 minutes and drops you at the main marina pier.
            </p>
            <p>
              The marina area is immediately walkable upon arrival, with restaurants, shops, and tour operators all within a few minutes' walk. This central location makes independent exploration particularly convenient.
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
                  <td className="py-3 px-4">Water Taxi</td>
                  <td className="py-3 px-4">$5-15</td>
                  <td className="py-3 px-4">5-10 min</td>
                  <td className="py-3 px-4">Medano Beach, El Arco tours</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Walking</td>
                  <td className="py-3 px-4">Free</td>
                  <td className="py-3 px-4">10-20 min</td>
                  <td className="py-3 px-4">Marina, downtown shopping</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Taxi</td>
                  <td className="py-3 px-4">$10-30</td>
                  <td className="py-3 px-4">5-15 min</td>
                  <td className="py-3 px-4">San José del Cabo, remote beaches</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Rental Car</td>
                  <td className="py-3 px-4">$40-60/day</td>
                  <td className="py-3 px-4">Flexible</td>
                  <td className="py-3 px-4">Exploring the corridor</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-[#0E1B4D] text-white p-6 rounded-lg">
            <p className="font-geograph text-[16px]">
              <strong className="text-[#F7F170]">Tender Priority:</strong> Book ship excursions or arrive early at the tender meeting point for faster disembarkation. The tender process can take 30-60 minutes during peak times.
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
            Iconic Cabo Experiences
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>El Arco (The Arch):</strong> Dramatic rock formation at Land's End, accessible by water taxi ($15-20)</li>
              <li><strong>Lover's Beach:</strong> Hidden beach accessible only by boat near El Arco</li>
              <li><strong>Medano Beach:</strong> Main swimming beach with beach clubs and water sports</li>
              <li><strong>Marina Cabo San Lucas:</strong> Luxury yachts, restaurants, and shopping</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Water Adventures
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Sport Fishing:</strong> "Marlin Capital of the World" - half-day charters from $400-600</li>
              <li><strong>Snorkeling:</strong> Pelican Rock and Santa Maria Bay ($45-65/person)</li>
              <li><strong>Sunset Sailing:</strong> Catamaran cruises with open bar ($60-80/person)</li>
              <li><strong>Whale Watching:</strong> December-April humpback and gray whales ($50-80/person)</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Popular Shore Excursions
          </h3>
          <div className="grid gap-4">
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Glass Bottom Boat to El Arco</h4>
              <p className="font-geograph text-[#666]">See underwater marine life and iconic rock formations • 45 min • $25-35/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">ATV Desert & Beach Tour</h4>
              <p className="font-geograph text-[#666]">Adventure through desert trails to Pacific beaches • 3 hours • $80-120/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Tequila Tasting Tour</h4>
              <p className="font-geograph text-[#666]">Learn about and sample premium tequilas • 2 hours • $45-65/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Zip Line Adventure</h4>
              <p className="font-geograph text-[#666]">Canyon zip lines with ocean views • 3-4 hours • $90-130/person</p>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/4327790/pexels-photo-4327790.jpeg"
          alt="El Arco rock formation at Land's End"
          fill
          className="object-cover"
        />
      </section>

      {/* Dining Section */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Sip & Savor: Cabo Cuisine
          </h2>

          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              Cabo's culinary scene blends traditional Mexican flavors with fresh seafood from both the Pacific and Sea of Cortez. From street tacos to upscale dining, the marina area offers options for every taste and budget.
            </p>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Must-Try Local Dishes
          </h3>
          <div className="grid gap-4 mb-8">
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Fish Tacos</h4>
              <p className="font-geograph text-[#666]">Battered or grilled fish with cabbage slaw and crema</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Chocolate Clams</h4>
              <p className="font-geograph text-[#666]">Local delicacy grilled with garlic and lime</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Ceviche</h4>
              <p className="font-geograph text-[#666]">Fresh fish marinated in lime juice with vegetables</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Margaritas</h4>
              <p className="font-geograph text-[#666]">Cabo's signature cocktail with premium tequila</p>
            </div>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Recommended Restaurants
          </h3>
          <div className="space-y-4">
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">The Office on the Beach</h4>
                  <p className="font-geograph text-[#666]">Beachfront dining with feet in the sand</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$15-30</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Solomon's Landing</h4>
                  <p className="font-geograph text-[#666]">Marina views with fresh seafood</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$20-35</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Cabo Wabo Cantina</h4>
                  <p className="font-geograph text-[#666]">Sammy Hagar's famous bar with live music</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$15-25</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Mi Casa</h4>
                  <p className="font-geograph text-[#666]">Authentic Mexican in colorful courtyard</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$12-20</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beach & Family Section */}
      <section className="py-[40px] md:py-[60px] bg-white">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Beach Life & Family Fun
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Best Beaches
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Medano Beach:</strong> Safe swimming, beach clubs, water sports</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Chileno Beach:</strong> Excellent snorkeling, calmer waters</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Santa Maria Bay:</strong> Protected cove for snorkeling</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Lover's Beach:</strong> Secluded, boat access only</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Family Activities
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Glass Bottom Boat:</strong> Kid-friendly marine viewing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Camel Safari:</strong> Beach camel rides</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Wild Canyon:</strong> Zip lines and bridges</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Dolphin Encounter:</strong> Interactive programs</span>
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
          alt="Cabo San Lucas beach with resorts"
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
                US dollars widely accepted everywhere. Pesos offer slightly better value. ATMs available at marina. Credit cards accepted at most establishments. Small bills recommended for tips and taxis.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Vendor Interaction
              </h3>
              <p className="font-geograph text-[#666]">
                Beach vendors and time-share salespeople are persistent but harmless. A polite "no gracias" usually works. Negotiate prices for souvenirs - start at 50% of asking price.
              </p>
            </div>

            <div className="bg-[#F7F170] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                ⚠️ Swimming Safety
              </h3>
              <p className="font-geograph text-[#0E1B4D] font-bold">
                Pacific side beaches have dangerous rip currents and are not safe for swimming. Stick to Medano Beach or protected bays on the Sea of Cortez side.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Weather & Best Times
              </h3>
              <p className="font-geograph text-[#666]">
                Year-round sunshine with 350+ days of sun. October-May: Perfect weather, whale watching season. June-September: Hot and humid with occasional brief showers. Water temperature: 72-82°F year-round.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Shopping Tips
              </h3>
              <p className="font-geograph text-[#666]">
                Puerto Paraiso Mall near marina for duty-free shopping. Local markets for authentic crafts. Tequila and vanilla are good values. Avoid buying prescription medications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Images */}
      <section className="grid md:grid-cols-2">
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/889929/pexels-photo-889929.jpeg"
            alt="Cabo San Lucas nightlife and bars"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
            alt="Mexican pesos and US dollars currency"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-[60px] md:py-[80px] bg-[#0E1B4D]">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="font-whitney font-black text-[36px] md:text-[48px] text-[#F7F170] mb-4">
            Ready for Cabo Adventures?
          </h2>
          <p className="font-geograph text-white text-[20px] mb-8">
            Book your Mexican Riviera cruise with Zipsea and receive maximum onboard credit
          </p>
          <Link
            href="/cruises?region=mexico"
            className="inline-block bg-[#F7F170] text-[#0E1B4D] px-8 py-4 rounded-full font-geograph font-bold text-[18px] hover:bg-[#F7F170]/90 transition-colors"
          >
            Find Mexican Riviera Cruises
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
              Cabo San Lucas offers the perfect blend of natural beauty, adventure, and relaxation at the tip of Baja California. From the iconic El Arco to world-class fishing, pristine beaches to vibrant nightlife, this tender port delivers memorable experiences for every type of cruiser.
            </p>
            <p>
              Whether you're snorkeling at Pelican Rock, sipping margaritas on Medano Beach, sportfishing in the "Marlin Capital," or exploring the marina's restaurants and shops, Cabo provides an authentic taste of Mexico's Pacific coast charm.
            </p>
            <p className="font-bold text-[#0E1B4D]">
              Remember: All Zipsea cruise bookings include maximum onboard credit for shore excursions, specialty dining, and shopping at the marina!
            </p>
          </div>
        </div>
      </section>

      {/* Booking Form */}
      <section className="py-[40px] md:py-[60px] bg-white">
        <div className="max-w-4xl mx-auto px-8">
          <BookingForm />
        </div>
      </section>
    </main>
  );
}
