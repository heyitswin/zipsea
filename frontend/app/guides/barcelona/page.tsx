"use client";
import Image from "next/image";

export default function BarcelonaCruiseGuide() {
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
            The Ultimate Cruise Guide to Barcelona
          </h1>
          <p className="font-geograph text-white text-[18px] md:text-[22px] mt-6 leading-relaxed">
            Your Complete Port Day Guide to Gaudí's Masterpieces & Catalan Culture
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
                src="https://images.pexels.com/photos/18602897/pexels-photo-18602897.jpeg"
                alt="A stunning, vibrant photo of the Sagrada Família, showcasing its intricate facades against a clear blue sky"
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
                Welcome to Barcelona, a city where every street corner is a canvas and
                every neighborhood tells a story. From the ancient, labyrinthine alleyways
                of the Gothic Quarter to the whimsical, fluid forms of Gaudí's modern
                masterpieces, Barcelona is a vibrant nexus of history and art. This is not
                just a port of call; it is a full immersion into a culture that celebrates
                life with passion and flair.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A port day in this cosmopolitan city offers a remarkable spectrum of
                experiences, from quiet contemplation in a centuries-old church to the
                lively bustle of a world-famous market. To help navigate this rich tapestry,
                this guide has been designed as a definitive, trusted resource. Its purpose
                is to demystify the port experience and empower visitors to explore
                Barcelona with confidence, ensuring every precious moment ashore is a
                memory in the making.
              </p>

              {/* Your Arrival At The Port */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Arrival at the Port
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                The experience of a port day begins the moment a ship docks, and in
                Barcelona, this first step is a key to unlocking the day's potential. The
                Port de Barcelona is a large and complex facility with multiple terminals,
                and understanding the logistics of your arrival is the most critical part
                of your pre-planning. The port is divided into two distinct areas, each
                with a different relationship to the city center.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Adossat Quay Terminals (A, B, C, D, E):</strong> Primary terminals
                  for large cruise ships, located furthest from the city center. Walking from
                  here is strongly discouraged due to the significant distance and lack of
                  shade in an industrial area.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>World Trade Centre (WTC) Terminals:</strong> More conveniently
                  located terminals (North and South) plus Sant Bertrand terminal. These are
                  a short, manageable walk from the city's main attractions.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Getting from the Port to the City: Your First Steps Ashore
              </h3>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                With Barcelona's tiered terminal system in mind, selecting the right mode
                of transportation is essential. The choice is a direct trade-off between
                cost, speed, and convenience.
              </p>

              {/* Transportation Table */}
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
                        Option
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Best For
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Cost (Approximate)
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Time to City
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
                        <strong>Cruise Bus</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Budget-conscious cruisers
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        €3 one-way, €4.50 round-trip
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        10-15 min + walk
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Only for Adossat Quay; cash required
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Taxi</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Families, mobility needs
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        €10-15 to Las Ramblas
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        5-10 minutes
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        €4.50 port surcharge; yellow/black taxis
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Walking</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        WTC terminals only
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Free
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        10-minute walk
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Not recommended from Adossat Quay
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Top Adventures & Excursions */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Your Day, Your Way: Curated Itineraries for Every Cruiser
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="A close-up, bustling shot of a food stall inside La Boqueria market, with vibrant produce and a vendor assisting a customer"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Barcelona offers a diverse range of experiences that can be tailored to any
                traveler's interests. The city's efficient public transportation system and
                compact, walkable core make it possible to craft a day that perfectly
                matches any travel style, from deep dives into history to family-friendly fun.
              </p>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                The Walkable Wonders: Historic Heart of the City
              </h3>

              <ul
                className="font-geograph text-[16px] space-y-2 mb-6"
                style={{ color: "#0E1B4D" }}
              >
                <li>
                  <strong>Columbus Monument & Las Ramblas:</strong> The iconic gateway to the
                  city's historic center, featuring street artists, flower stands, and local culture.
                </li>
                <li>
                  <strong>La Boqueria Market:</strong> One of Europe's oldest food markets.
                  Don't touch the produce, carry small bills, and try Pinotxo for breakfast
                  or El Quim for baby squid with fried eggs.
                </li>
                <li>
                  <strong>Gothic Quarter & Picasso Museum:</strong> Winding medieval streets
                  leading to the Barcelona Cathedral and the Picasso Museum (€12 adult, free
                  under 18). Book timed-entry tickets in advance.
                </li>
              </ul>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Gaudí's Masterpieces: A Journey into Modernism
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1729286286747-f5f8e1d8ce2d?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="A wide-angle shot of the famous colorful tile work and the flowing architectural lines of Park Güell, with the city of Barcelona in the background"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Essential Gaudí Sites (Book tickets in advance!):
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Sagrada Família:</strong> €26 with audioguide, €40 with tower access.
                    Metro: Drassanes to Passeig de Gràcia (L3), transfer to L2. 35-45 min journey.
                  </li>
                  <li>
                    <strong>Park Güell:</strong> €18 general, free for 0-6, €13.50 for 7-12 and
                    65+. Take Bus 92 for wheelchair access. Avoid Vallcarca metro station.
                  </li>
                  <li>
                    <strong>Casa Batlló:</strong> From €29, free under 12. Located on Passeig
                    de Gràcia, 5-minute metro from port. Visit takes about 1 hour 15 minutes.
                  </li>
                </ul>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Family Adventures: Fun for the Whole Crew
              </h3>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/1636514/pexels-photo-1636514.jpeg"
                  alt="A wide shot of the Barcelona Aquarium's Oceanarium, with a shark and stingray visible through the large glass tunnel"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Family Attractions Table */}
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
                        Attraction
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Best For
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Travel Time
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Price (Adult)
                      </th>
                      <th
                        className="font-geograph font-bold text-[16px] px-4 py-2 text-left"
                        style={{ color: "#0E1B4D" }}
                      >
                        Key Feature
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Barcelona Aquarium</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        All ages, indoor fun
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        10-15 min walk
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        €29
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        80m glass tunnel through Oceanarium
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Tibidabo Park</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        All ages, full day
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        20-30 min taxi
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        €39
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Historic rides, panoramic views
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        <strong>Las Golondrinas</strong>
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        All ages, quick scenic
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        5-10 min walk
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        €7.70
                      </td>
                      <td
                        className="font-geograph text-[16px] px-4 py-2"
                        style={{ color: "#0E1B4D" }}
                      >
                        Traditional harbor boat tour
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                  Planning Your Barcelona Port Day?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Book through Zipsea to get maximum onboard credit for your
                  Mediterranean cruise adventure.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Find Mediterranean Cruises
                </a>
              </div>

              {/* Dining */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Sip & Savor: A Taste of Catalan Life
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/30036946/pexels-photo-30036946.jpeg"
                  alt="A close-up shot of a variety of traditional Catalan tapas plates on a rustic wooden table, with wine glasses and a bottle in the background"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                No visit to Barcelona is complete without a deep dive into the local food
                scene. The city's cuisine is a rich, layered expression of its history and
                geography, blending fresh Mediterranean ingredients with influences from
                various cultures.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Guided Tapas Tours:</strong> Escape tourist traps on Las Ramblas.
                  Tours through Gothic Quarter, Poble-Sec, and Eixample. 2-hour tour: €77 per
                  person, 3-hour with 10 tastings: €126 per person.
                </p>
                <p
                  className="font-geograph text-[16px] mt-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Must-Try Catalan Dishes:</strong>
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• <strong>Paella catalana:</strong> Mix of meat and shellfish</li>
                  <li>• <strong>Fideuá:</strong> Seafood dish with noodles instead of rice</li>
                  <li>• <strong>Botifarra:</strong> White sausage, regional staple</li>
                  <li>• <strong>Crema catalana:</strong> Similar to crème brûlée</li>
                  <li>• <strong>Local wines:</strong> From Alella and Montsant regions</li>
                </ul>
              </div>

              {/* Survival Guide */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                The Zipsea Survival Guide: Insider Tips & Essentials
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1589739287134-a59704c2cfab?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt="A shot of a Barcelona metro station, showing a train arriving and a group of people waiting on the platform"
                  fill
                  className="object-cover"
                />
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Money & Moolah: Navigating the Currency and Tipping
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Currency:</strong> Euro (€). Credit cards widely accepted, but carry
                  cash for smaller purchases, taxis, and local markets.
                </p>
                <p
                  className="font-geograph text-[16px]"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Tipping:</strong> Unlike North America, tipping is modest in Spain.
                  Restaurant tips: 7-10% or round up the bill. Coffee: a few cents. Taxis:
                  round up the fare. Tips are rewards for exceptional service, not expected.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                On the Move: Navigating the City Like a Local
              </h3>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <strong>Public Transportation Options:</strong>
                </p>
                <ul
                  className="font-geograph text-[16px] ml-4 space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• <strong>Single metro ticket:</strong> €2.65</li>
                  <li>• <strong>T-Casual card:</strong> 10 journeys for €12.55 (best for day trips)</li>
                  <li>• <strong>Hola Barcelona card:</strong> 48-hour unlimited for €18.10 (includes airport)</li>
                </ul>
                <p
                  className="font-geograph text-[16px] mt-2"
                  style={{ color: "#0E1B4D" }}
                >
                  The T-Casual is perfect for cruise passengers exploring Zone 1 tourist areas.
                  Only choose Hola Barcelona if you need airport transfers.
                </p>
              </div>

              <h3
                className="font-geograph font-bold text-[24px] mt-8 mb-4"
                style={{ color: "#0E1B4D" }}
              >
                Staying Safe, Staying Savvy
              </h3>

              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p
                  className="font-geograph text-[16px] font-bold mb-2"
                  style={{ color: "#0E1B4D" }}
                >
                  Pickpocket Prevention:
                </p>
                <ul
                  className="font-geograph text-[16px] space-y-1"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>• Be extra vigilant on Las Ramblas, Gothic Quarter, and metro</li>
                  <li>• Use crossbody bags with anti-theft zippers</li>
                  <li>• Never carry valuables in back pockets</li>
                  <li>• Watch for distraction scams (bumping, fake stains)</li>
                  <li>• Keep bags on your lap when dining, not on chair backs</li>
                  <li>• Leave expensive jewelry on the ship</li>
                </ul>
              </div>

              {/* Weather */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Weather Essentials: What to Expect
              </h2>

              <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/29988784/pexels-photo-29988784.jpeg"
                  alt="A scenic photo of a street in the Gothic Quarter, with people in light clothing enjoying the mild spring weather"
                  fill
                  className="object-cover"
                />
              </div>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                Barcelona's Mediterranean climate offers pleasant weather year-round, with
                each season providing a different experience. Understanding the seasonal
                changes can help travelers pack and plan accordingly.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <ul
                  className="font-geograph text-[16px] space-y-2"
                  style={{ color: "#0E1B4D" }}
                >
                  <li>
                    <strong>Spring (March-May):</strong> Ideal weather, 59°F-70°F. Perfect for
                    outdoor sites without summer crowds.
                  </li>
                  <li>
                    <strong>Summer (June-August):</strong> Peak season, often above 86°F. Sea
                    temperature reaches 79°F in August.
                  </li>
                  <li>
                    <strong>Autumn (September-November):</strong> Pleasant early autumn, but
                    October is the wettest month.
                  </li>
                  <li>
                    <strong>Winter (December-February):</strong> Mild 50°F-57°F with little
                    rain. Best for budget travelers, fewer crowds.
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
                  Ready to Explore Barcelona?
                </h3>
                <p
                  className="font-geograph text-[16px] mb-4"
                  style={{ color: "#0E1B4D" }}
                >
                  Get the best deals and maximum onboard credit when you book your
                  Mediterranean cruise with Zipsea.
                </p>
                <a
                  href="/cruises"
                  className="inline-block px-6 py-3 bg-[#0E1B4D] text-white font-bold rounded-lg hover:bg-[#2238C3] transition-colors"
                >
                  Browse Mediterranean Cruises
                </a>
              </div>

              {/* Closing Section */}
              <h2
                className="font-whitney font-black uppercase text-[36px] mt-12 mb-6"
                style={{ color: "#0E1B4D", lineHeight: 1 }}
              >
                Before You Sail Away: Final Thoughts
              </h2>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                A port day in Barcelona is a multifaceted journey through a city that
                seamlessly blends a rich, layered past with a vibrant, modern present. From
                the awe-inspiring architecture of Gaudí to the bustling energy of its
                historic markets and the quiet beauty of its back streets, Barcelona offers
                an experience unlike any other.
              </p>

              <p
                className="font-geograph text-[16px] leading-relaxed mb-6"
                style={{ color: "#0E1B4D" }}
              >
                By understanding the unique logistical challenges of the port and preparing
                with a few key pieces of practical advice, travelers can make the most of
                their limited time ashore. With a bit of planning, a day here is not just a
                visit; it is an adventure that will be a highlight of any cruise. With
                Zipsea, every port is an adventure waiting to happen.
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
