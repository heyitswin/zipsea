"use client";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const BookingForm = dynamic(() => import("@/app/components/booking-form"), {
  ssr: false,
});

export default function BridgetownGuidePage() {
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
            alt="Aerial view of Bridgetown Cruise Port Barbados"
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
            Bridgetown Cruise Port Guide
          </h1>
          <h2 className="font-geograph text-white text-[20px] md:text-[24px] leading-relaxed mb-8 max-w-3xl mx-auto">
            UNESCO World Heritage site with pristine beaches, rum heritage, and swimming with sea turtles in Carlisle Bay
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
            Welcome to Bridgetown, Barbados
          </h2>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed">
            <p>
              Bridgetown serves as the quintessential gateway to the Caribbean, where UNESCO World Heritage architecture meets powder-soft beaches and crystal-clear waters. This vibrant capital of Barbados offers cruise passengers an immediate entry into both relaxation and cultural enrichment.
            </p>
            <p>
              Located just 1 mile from downtown, the Deep Water Harbour provides exceptional convenience for independent exploration. Whether you're seeking historic city walks, swimming with sea turtles, or sampling authentic Bajan cuisine, Bridgetown delivers an authentic Caribbean experience within easy reach.
            </p>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/7241849/pexels-photo-7241849.jpeg"
          alt="Barbados Parliament Buildings with clock tower"
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
            Deep Water Harbour Logistics
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              The Barbados Cruise Port sits strategically just 1-1.24 miles west of downtown Bridgetown, offering multiple hassle-free options to reach the city center. A complimentary shuttle runs between ships and the terminal.
            </p>
            <p>
              The 20-minute walk along Trevor's Way oceanside footpath leads directly to historic shopping areas and Pelican Craft Centre, making self-guided exploration both pleasant and budget-friendly.
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
                  <td className="py-3 px-4">Walk (Trevor's Way)</td>
                  <td className="py-3 px-4">Free</td>
                  <td className="py-3 px-4">20-25 min</td>
                  <td className="py-3 px-4">Most immersive & cost-effective</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Cruise Shuttle</td>
                  <td className="py-3 px-4">Varies/Free</td>
                  <td className="py-3 px-4">5-10 min</td>
                  <td className="py-3 px-4">Stress-free organized service</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">Taxi</td>
                  <td className="py-3 px-4">~$6</td>
                  <td className="py-3 px-4">~5 min</td>
                  <td className="py-3 px-4">Fastest & most convenient</td>
                </tr>
                <tr className="border-b border-[#E5E5E5]">
                  <td className="py-3 px-4">ZR Bus (Minibus)</td>
                  <td className="py-3 px-4">~$1.75</td>
                  <td className="py-3 px-4">10-20 min</td>
                  <td className="py-3 px-4">Most authentic, very low-cost</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-[#0E1B4D] text-white p-6 rounded-lg">
            <p className="font-geograph text-[16px]">
              <strong className="text-[#F7F170]">Taxi Tip:</strong> Always agree on fare and currency (BBD or USD) before starting your journey. ZR buses require exact change in local currency.
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
            Historic Bridgetown Walking Tour
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              The UNESCO-listed historic center rewards self-guided exploration with duty-free shopping on Broad Street and local crafts at Pelican Village.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Parliament Buildings:</strong> Striking clock tower and Gothic architecture</li>
              <li><strong>National Heroes Square:</strong> Historic heart of the city</li>
              <li><strong>St. Michael's Cathedral:</strong> Standing since the 18th century</li>
              <li><strong>Independence Square:</strong> Waterfront dining along the river</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Beach Paradise
          </h3>
          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Carlisle Bay:</strong> Marine park with 6 shipwrecks, sea turtle swimming ($30-50/person)</li>
              <li><strong>Accra Beach:</strong> Family-friendly south coast with gentle waves</li>
              <li><strong>West Coast:</strong> Calm, warm waters ideal for swimming</li>
            </ul>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Popular Shore Excursions
          </h3>
          <div className="grid gap-4">
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Atlantis Submarine</h4>
              <p className="font-geograph text-[#666]">Real submarine dive to see marine life • 2-2.5 hours • $120-159/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Harrison's Cave</h4>
              <p className="font-geograph text-[#666]">Underground tram tour through stalactite caverns • $90-185/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Catamaran Cruise</h4>
              <p className="font-geograph text-[#666]">Swim with turtles, snorkel shipwrecks, open bar • $95/person</p>
            </div>
            <div className="border-l-4 border-[#F7F170] pl-4">
              <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Mount Gay Rum Tour</h4>
              <p className="font-geograph text-[#666]">Birthplace of rum tasting experience • $27.50-60/person</p>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/5255297/pexels-photo-5255297.jpeg"
          alt="Carlisle Bay with catamaran and swimmers"
          fill
          className="object-cover"
        />
      </section>

      {/* Dining Section */}
      <section className="py-[40px] md:py-[60px]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-whitney font-black text-[32px] md:text-[42px] text-[#0E1B4D] mb-6">
            Sip & Savor: Bajan Cuisine
          </h2>

          <div className="space-y-4 font-geograph text-[18px] text-[#666] leading-relaxed mb-8">
            <p>
              Bajan cuisine fuses African, European, and West Indian influences into unforgettable flavors. Experience the island's culinary identity through its national dishes and rum heritage.
            </p>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Must-Try National Dishes
          </h3>
          <div className="grid gap-4 mb-8">
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Flying Fish & Cou Cou</h4>
              <p className="font-geograph text-[#666]">National dish with steamed fish and cornmeal-okra polenta</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Pudding & Souse</h4>
              <p className="font-geograph text-[#666]">Traditional Saturday meal of pickled pork and spiced sweet potato</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Bajan Macaroni Pie</h4>
              <p className="font-geograph text-[#666]">Unique local take on mac and cheese</p>
            </div>
            <div className="bg-[#FFF8E5] p-4 rounded-lg">
              <h4 className="font-geograph font-bold text-[#0E1B4D]">Fish Cakes & Cutters</h4>
              <p className="font-geograph text-[#666]">Street food staples - fried fish cakes and local sandwiches</p>
            </div>
          </div>

          <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
            Where to Eat
          </h3>
          <div className="space-y-4">
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Oistins Fish Fry</h4>
                  <p className="font-geograph text-[#666]">Weekend market with grilled fish and local atmosphere</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$10-25</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Cuz's Fish Shack</h4>
                  <p className="font-geograph text-[#666]">Best fish cutters on the island - Carlisle Bay</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$8-15</span>
              </div>
            </div>
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-geograph font-bold text-[18px] text-[#0E1B4D]">Brown Sugar Restaurant</h4>
                  <p className="font-geograph text-[#666]">All-you-can-eat Planters Buffet lunch</p>
                </div>
                <span className="font-geograph text-[#0E1B4D] font-bold">$35-45</span>
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
                Kid-Friendly Beaches
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Carlisle Bay:</strong> Calm waters, close to port</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Accra Beach:</strong> Gentle waves perfect for children</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Turtle Swimming:</strong> Safe, guided experiences</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-geograph font-bold text-[24px] text-[#0E1B4D] mb-4">
                Family Adventures
              </h3>
              <ul className="space-y-3 font-geograph text-[#666]">
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Wildlife Reserve:</strong> Green monkeys & tortoises</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Atlantis Submarine:</strong> Safe underwater adventure</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F7F170] mr-2">▸</span>
                  <span><strong>Glass Bottom Boat:</strong> Marine life viewing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[400px] md:h-[500px] w-full">
        <Image
          src="https://images.pexels.com/photos/2374946/pexels-photo-2374946.jpeg"
          alt="Flying Fish and Cou Cou national dish"
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
                Barbados Dollar (BBD) is official, but USD widely accepted at 2:1 fixed rate. Credit cards accepted at major venues, but cash needed for street vendors, buses, and most taxis. 10-15% service charge often included in bills.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Weather & What to Wear
              </h3>
              <p className="font-geograph text-[#666]">
                Year-round 84-88°F with warm sea temperatures. Dry season (Dec-May): Low humidity. Wet season (Jun-Nov): Hot, humid with showers. Bring comfortable walking shoes, sun protection, and swimwear.
              </p>
            </div>

            <div className="bg-[#F7F170] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                ⚠️ Important Legal Note
              </h3>
              <p className="font-geograph text-[#0E1B4D] font-bold">
                Wearing camouflage clothing of any kind is ILLEGAL in Barbados and can result in fines or detention.
              </p>
            </div>

            <div className="bg-[#FFF8E5] p-6 rounded-lg">
              <h3 className="font-geograph font-bold text-[20px] text-[#0E1B4D] mb-3">
                Safety Tips
              </h3>
              <p className="font-geograph text-[#666]">
                Barbados is very safe with rare violent crime. Don't leave valuables unattended on beaches. Avoid walking alone after dark. Stick to well-lit, populated areas. Use hotel safes for passports and valuables.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Images */}
      <section className="grid md:grid-cols-2">
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/8925997/pexels-photo-8925997.jpeg"
            alt="Family playing on Barbados beach"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative h-[400px]">
          <Image
            src="https://images.pexels.com/photos/11316618/pexels-photo-11316618.jpeg"
            alt="Mix of Barbadian and US currency"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-[60px] md:py-[80px] bg-[#0E1B4D]">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="font-whitney font-black text-[36px] md:text-[48px] text-[#F7F170] mb-4">
            Ready to Explore Barbados?
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
              Bridgetown masterfully blends rich UNESCO heritage with vibrant island culture, offering cruise passengers exceptional value through its walkable port location. Whether you choose a self-guided historic exploration or thrilling excursions to natural wonders, the city rewards every travel style.
            </p>
            <p>
              From swimming with sea turtles in Carlisle Bay to savoring flying fish at Oistins, experiencing rum tours at Mount Gay, or simply strolling Trevor's Way, Bridgetown transforms a port stop into a multi-faceted Caribbean adventure.
            </p>
            <p className="font-bold text-[#0E1B4D]">
              Remember: All Zipsea cruise bookings include maximum onboard credit for shore excursions, specialty dining, and duty-free shopping!
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
