"use client";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const BookingForm = dynamic(() => import("@/app/components/booking-form"), {
  ssr: false,
});

export default function BonaireGuidePage() {
  return (
    <main style={{ backgroundColor: "#F6F3ED" }}>
      {/* Hero Section */}
      <section
        className="relative py-[120px] md:py-[200px]"
        style={{ backgroundColor: "#0E1B4D" }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1685101260406-5c7ad28ca00b?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Aerial view of Kralendijk waterfront Bonaire"
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
            Bonaire Cruise Port Guide
          </h1>
          <h2 className="font-geograph text-white text-[20px] md:text-[24px] leading-relaxed mb-8 max-w-3xl mx-auto">
            Shore-diving capital of the world with pristine marine parks, flamingo sanctuaries, and walkable Kralendijk
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
            Welcome to Bonaire
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Bonaire defies typical cruise port expectations as a premier eco-tourism hub and the shore-diving capital of the world. This enchanting island in the southern Caribbean offers unmatched convenience with cruise ships docking right in the heart of Kralendijk, allowing immediate exploration on foot.
            </p>
            <p>
              Renowned globally for pristine waters and 86 marked dive sites, Bonaire's marine park encompasses the entire coastline. Above water, Dutch-Caribbean history comes alive through colorful colonial buildings, while flamingo sanctuaries and salt flats create otherworldly landscapes.
            </p>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.unsplash.com/photo-1616788099418-8e79d076071d?q=80&w=1325&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Kralendijk waterfront with colorful buildings"
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
            The Unmatched Convenience of Kralendijk
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              The cruise terminals (Town Pier and Customs Pier) are located directly in downtown Kralendijk, offering immediate walkable access to shops, restaurants, and historic sites. This seamless arrival eliminates typical port transportation complexities.
            </p>
            <p>
              A five-minute walk from the pier leads to Kaya Grandi, the main shopping street. The flat terrain and compact layout make exploration effortless from the moment you disembark.
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
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Best For</th>
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Cost</th>
                  <th className="text-left py-3 px-4 font-geograph font-bold text-[#0E1B4D]">Notes</th>
                </tr>
              </thead>
              <tbody className="font-geograph text-[16px]">
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Walking</td>
                  <td className="py-3 px-4">Downtown Kralendijk</td>
                  <td className="py-3 px-4">Free</td>
                  <td className="py-3 px-4">Everything within 5-10 min walk</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Taxi</td>
                  <td className="py-3 px-4">Beaches</td>
                  <td className="py-3 px-4">$15-25</td>
                  <td className="py-3 px-4">Government-regulated flat rates</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Rental Pickup</td>
                  <td className="py-3 px-4">Dive sites, national park</td>
                  <td className="py-3 px-4">$45-60/day</td>
                  <td className="py-3 px-4">Best for remote exploration</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Water Taxi</td>
                  <td className="py-3 px-4">Klein Bonaire</td>
                  <td className="py-3 px-4">$25 round-trip</td>
                  <td className="py-3 px-4">Includes drift snorkeling</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-[#0E1B4D] text-white p-6 rounded-lg">
            <p className="font-geograph text-[16px]">
              <strong className="text-[#F7F170]">No Public Buses:</strong> Bonaire has no public bus system. Taxis are the only public transportation, making rental vehicles popular for independent exploration.
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
            Underwater Paradise
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              Bonaire's marine park encompasses all waters surrounding the island, with 86 marked dive sites accessible from shore. Yellow-painted rocks identify entry points for spontaneous underwater exploration.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Klein Bonaire:</strong> Uninhabited island with pristine reefs ($25 round-trip)</li>
              <li><strong>Tori's Reef:</strong> Perfect for beginners and families</li>
              <li><strong>Salt Pier:</strong> Sea turtles and abundant marine life</li>
              <li><strong>Andrea I & II:</strong> Popular sites with easy shore access</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Walkable Downtown Kralendijk
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Kaya Grandi:</strong> Main shopping street with Dutch colonial buildings</li>
              <li><strong>Fort Oranje:</strong> 17th-century fortification with harbor views</li>
              <li><strong>Wilhelmina Park:</strong> Artisan markets and local crafts</li>
              <li><strong>Terramar Museum:</strong> Island heritage and history</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Popular Shore Excursions
          </h3>
          <div className="grid gap-4">
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Snorkel & BBQ Catamaran</h4>
              <p className="font-geograph text-[#666]">All-inclusive with guided snorkeling, BBQ lunch, open bar • $125/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Full Island Tour</h4>
              <p className="font-geograph text-[#666]">Salt flats, pink water, flamingo sanctuary • 2 hours • $53/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Guided Cave Adventure</h4>
              <p className="font-geograph text-[#666]">Explore 400+ magnificent caves • $129/person</p>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.unsplash.com/photo-1708649290066-5f617003b93f?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Underwater snorkeling in Bonaire's clear waters"
          fill
          className="object-cover"
        />
      </section>

      {/* Dining Section */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Sip & Savor: Local Cuisine
          </h2>

          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              Bonaire's culinary scene fuses Caribbean, Dutch, and Spanish flavors into unique dishes that reflect the island's multicultural heritage.
            </p>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Must-Try Local Dishes
          </h3>
          <div className="grid gap-4 mb-8">
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Kabritu Stobá</h4>
              <p className="font-geograph text-[#666]">Slow-cooked goat stew with buttery-soft meat</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Fresh Fish Platters</h4>
              <p className="font-geograph text-[#666]">Daily catch served grilled or fried with local sides</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Caribbean Fusion</h4>
              <p className="font-geograph text-[#666]">Dutch-Caribbean combinations unique to the island</p>
            </div>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Recommended Restaurants
          </h3>
          <div className="space-y-4">
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Kite City (Food Truck)</h4>
                  <p className="font-geograph text-[#666]">Fresh local fish burgers and wraps</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$17-40</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">La Cantina Cerveceria</h4>
                  <p className="font-geograph text-[#666]">Brewery with Caribbean dishes in courtyard setting</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$20-30</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">It Rains Fishes</h4>
                  <p className="font-geograph text-[#666]">Upscale dining with ocean views</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$30+</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Family Section */}
      <section className="py-[40px] md:py-[60px] bg-white">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            For the Whole Crew: Family Fun
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Beaches & Water Fun
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Sorobon Beach:</strong> Shallow, calm waters perfect for kids</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Eden Beach:</strong> Family-friendly with facilities</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Lac Bay:</strong> Mangrove tours and kayaking</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Land Adventures
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Donkey Sanctuary:</strong> Drive-through experience with friendly donkeys</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Flamingo Sanctuary:</strong> See pink flamingos in salt flats</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Washington-Slagbaai Park:</strong> Wildlife and nature trails</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.unsplash.com/photo-1578861256505-d3be7cb037d3?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Goat stew local cuisine in Bonaire"
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
                Bonaire Nature Fee
              </h3>
              <p className="font-geograph text-[#666]">
                $10 one-day fee for cruise passengers using marine park (swimming, snorkeling, kayaking). Children under 12 exempt. Funds conservation efforts.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Currency & Tipping
              </h3>
              <p className="font-geograph text-[#666]">
                US dollars accepted everywhere. Carry small bills for markets and taxis. Tips: 10-15% at restaurants. Inform staff of tip amount before card is swiped.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Vehicle Safety
              </h3>
              <p className="font-geograph text-[#666]">
                Leave rental cars unlocked at remote dive sites to prevent window damage. Never leave valuables visible or unattended. This is local practice due to petty theft.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Weather & Best Times
              </h3>
              <p className="font-geograph text-[#666]">
                Year-round 85°F average with steady trade winds. Dry season (Dec-Apr): Low humidity, peak season. Wet season (May-Nov): Warmer with occasional showers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Images */}
      <section className="grid md:grid-cols-2">
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/5727780/pexels-photo-5727780.jpeg"
            alt="Bonaire diving and marine life"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
            alt="Flamingos in Bonaire salt flats"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-[60px] md:py-[80px] bg-[#0E1B4D]">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="font-whitney font-black text-[36px] md:text-[48px] text-[#F7F170] mb-4">
            Ready to Explore Bonaire?
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
              Bonaire offers a profound departure from typical cruise experiences, rewarding independent and environmentally conscious travelers. The unmatched port convenience provides freedom to explore Kralendijk's historic charm or venture to pristine dive sites and natural parks.
            </p>
            <p>
              Whether you spend your day snorkeling world-class reefs, wandering colorful colonial streets, or meeting friendly donkeys at the sanctuary, Bonaire proves that the most memorable experiences come where logistics are simplest and natural wonders most abundant.
            </p>
            <p className="font-bold text-[#0E1B4D]">
              Remember: All Zipsea cruise bookings include maximum onboard credit for shore excursions, specialty dining, and port shopping!
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
