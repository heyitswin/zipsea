"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function FirstTimeCruisersGuide() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[id]");
      const scrollPosition = window.scrollY + 100;

      sections.forEach((section) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        const sectionHeight = (section as HTMLElement).offsetHeight;
        const sectionId = section.getAttribute("id");

        if (
          scrollPosition >= sectionTop &&
          scrollPosition < sectionTop + sectionHeight
        ) {
          setActiveSection(sectionId || "");
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -80;
      const y =
        element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const tableOfContents = [
    { id: "pre-cruise-planning", title: "Pre-Cruise Planning & Preparation" },
    { id: "packing-like-pro", title: "Packing Like a Pro" },
    { id: "embarkation-day", title: "Embarkation Day Success" },
    { id: "first-day-onboard", title: "Your First Day Onboard" },
    { id: "dining-food", title: "Dining & Food Adventures" },
    { id: "entertainment-activities", title: "Entertainment & Activities" },
    { id: "shore-excursions", title: "Shore Excursions & Ports" },
    { id: "money-matters", title: "Money Matters & Budgeting" },
    { id: "health-safety", title: "Health, Safety & Sea Sickness" },
    { id: "cruise-etiquette", title: "Cruise Etiquette & Social Tips" },
    { id: "disembarkation", title: "Disembarkation & Going Home" },
    { id: "insider-secrets", title: "Insider Secrets & Pro Tips" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F3ED" }}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="text-center">
            <h1 className="font-geograph text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
              The Ultimate First-Time
              <br />
              Cruiser's Guide 🚢
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 font-light">
              Your complete handbook to cruise vacation success
            </p>
          </div>
        </div>
      </div>

      {/* Separator 1 - After Hero */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Welcome Section */}
      <div className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Welcome Aboard, Future Cruiser! 🎉
          </h2>
          <p className="text-lg text-gray-700 mb-6">
            Congratulations! You've just booked your first cruise, and we're
            absolutely thrilled for you. Whether you're dreaming of tropical
            sunsets, endless buffets, or Broadway-style shows at sea, you're
            about to embark on one of the most magical vacation experiences
            possible.
          </p>
          <p className="text-lg text-gray-700">
            At <span className="font-semibold text-[#2238C3]">Zipsea</span>,
            we've helped thousands of first-time cruisers turn their ocean
            dreams into reality. This guide is everything we wish every new
            cruiser knew before stepping aboard – your ultimate cheat sheet to
            cruise vacation success!
          </p>
        </div>
      </div>

      {/* Separator 2 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/01_cruise_ship_sunset.jpg"
            alt="Stunning cruise ship at sunset"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Separator 3 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Table of Contents */}
      <div className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Table of Contents
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {tableOfContents.map((item, index) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`text-left p-4 rounded-lg transition-all duration-200 hover:bg-[#2238C3] hover:text-white ${
                  activeSection === item.id
                    ? "bg-[#2238C3] text-white"
                    : "bg-gray-50 text-gray-700"
                }`}
              >
                <span className="font-medium">
                  {index + 1}. {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Separator 4 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Pre-Cruise Planning Section */}
      <section id="pre-cruise-planning" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Pre-Cruise Planning & Preparation
          </h2>

          <div className="bg-white rounded-xl p-8 mb-8">
            <h3 className="font-geograph text-2xl font-semibold text-gray-900 mb-6">
              📋 Your 90-Day Countdown Checklist
            </h3>

            <div className="space-y-6">
              <div className="border-l-4 border-[#2238C3] pl-6">
                <h4 className="font-semibold text-lg text-gray-900 mb-3">
                  90 Days Before:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Book your cruise (check! ✅)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Review and understand your cruise contract
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Consider travel insurance
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Start researching your ports of call
                    </span>
                  </li>
                </ul>
              </div>

              <div className="border-l-4 border-[#2238C3] pl-6">
                <h4 className="font-semibold text-lg text-gray-900 mb-3">
                  60 Days Before:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Complete online check-in (usually opens 75-90 days prior)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Book specialty dining reservations
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Reserve spa appointments and shore excursions
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Apply for passport if needed (this takes time!)
                    </span>
                  </li>
                </ul>
              </div>

              <div className="border-l-4 border-[#2238C3] pl-6">
                <h4 className="font-semibold text-lg text-gray-900 mb-3">
                  30 Days Before:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Print boarding passes and luggage tags
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Pack medications in carry-on
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Arrange pet care, mail hold, etc.
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Download your cruise line's app
                    </span>
                  </li>
                </ul>
              </div>

              <div className="border-l-4 border-[#2238C3] pl-6">
                <h4 className="font-semibold text-lg text-gray-900 mb-3">
                  1 Week Before:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Check weather forecasts for packing
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Confirm transportation to port
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Set up international phone plan if needed
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#2238C3] mr-2">✓</span>
                    <span className="text-gray-700">
                      Pack and weigh luggage
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <p className="text-[#2238C3] font-semibold">
                💡 <span className="font-geograph">Zipsea Pro Tip:</span> Use
                our cruise planning tools to stay organized and never miss a
                deadline!
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8">
            <h3 className="font-geograph text-2xl font-semibold text-gray-900 mb-6">
              🛂 Essential Documents You'll Need
            </h3>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-lg text-gray-900 mb-4">
                  Required for Everyone:
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>
                    • Valid passport (recommended) or birth certificate +
                    government-issued photo ID
                  </li>
                  <li>• Boarding pass and luggage tags</li>
                  <li>• Travel insurance documents</li>
                  <li>• Emergency contact information</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-gray-900 mb-4">
                  Additional for International Cruises:
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Passport valid for 6+ months beyond travel date</li>
                  <li>• Visa requirements (check each port of call)</li>
                  <li>• Vaccination records if required</li>
                </ul>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-lg text-gray-900 mb-4">
                Don't Forget:
              </h4>
              <ul className="space-y-2 text-gray-700">
                <li>• Driver's license for shore excursions</li>
                <li>• Credit cards (notify banks of travel)</li>
                <li>• Medical insurance cards</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/02_planning_documents.jpg"
            alt="Travel planning documents and passport"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Packing Section */}
      <section id="packing-like-pro" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Packing Like a Pro
          </h2>

          <div className="bg-gray-50 rounded-xl p-8 mb-8">
            <h3 className="font-geograph text-2xl font-semibold text-gray-900 mb-6">
              🧳 The Ultimate Cruise Packing List
            </h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <h4 className="font-semibold text-lg text-[#2238C3] mb-4">
                  Daytime Casual:
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Swimwear (bring 2-3 suits)</li>
                  <li>• Cover-ups and sundresses</li>
                  <li>• Shorts, t-shirts, tank tops</li>
                  <li>• Comfortable walking shoes</li>
                  <li>• Flip-flops or sandals</li>
                  <li>• Light jacket or sweater</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-[#2238C3] mb-4">
                  Evening Wear:
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Smart casual outfits</li>
                  <li>• Formal wear for formal nights</li>
                  <li>• Dress shoes</li>
                  <li>• Accessories and jewelry</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-[#2238C3] mb-4">
                  Active Wear:
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Workout clothes</li>
                  <li>• Athletic shoes</li>
                  <li>• Gear for activities</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 bg-[#F6F3ED] rounded-lg">
              <h4 className="font-semibold text-lg text-gray-900 mb-4">
                Must-Have Items:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Sunscreen (reef-safe)</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Aloe vera gel</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Reusable water bottle</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Power strip</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Phone chargers</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Seasickness remedies</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">First aid kit basics</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-gray-700">Laundry detergent pods</span>
                </label>
              </div>
            </div>

            <div className="mt-8 p-6 bg-red-50 rounded-lg border-2 border-red-200">
              <h4 className="font-semibold text-lg text-red-900 mb-4">
                ❌ What NOT to Pack:
              </h4>
              <ul className="space-y-2 text-red-700">
                <li>• Candles or incense</li>
                <li>• Surge protectors with outlets</li>
                <li>• Weapons of any kind</li>
                <li>• Illegal drugs</li>
                <li>• Large amounts of alcohol (check cruise line's policy)</li>
                <li>• Irons (steamers usually okay)</li>
              </ul>
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <p className="text-[#2238C3] font-semibold">
                🎒 <span className="font-geograph">Packing Hack:</span> Pack one
                complete outfit in your carry-on in case checked luggage is
                delayed!
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-8">
            <h3 className="font-geograph text-2xl font-semibold text-gray-900 mb-6">
              👗 Formal Night Decoded
            </h3>
            <p className="text-gray-700 mb-6">
              Most cruises have 1-2 formal nights. Here's what that actually
              means:
            </p>

            <div className="space-y-4">
              <div className="flex items-start">
                <span className="font-semibold text-[#2238C3] mr-3">
                  Formal:
                </span>
                <span className="text-gray-700">
                  Suits, tuxedos, cocktail dresses, evening gowns
                </span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-[#2238C3] mr-3">
                  Smart Casual Alternative:
                </span>
                <span className="text-gray-700">
                  Nice slacks/dress with button-down shirt or blouse
                </span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-[#2238C3] mr-3">
                  Rental Option:
                </span>
                <span className="text-gray-700">
                  Many ships offer tuxedo rentals
                </span>
              </div>
            </div>

            <p className="mt-6 text-gray-700 italic">
              <strong>Don't Stress:</strong> You won't be turned away from the
              dining room if you're not in formal wear, but you might miss some
              photo opportunities!
            </p>
          </div>
        </div>
      </section>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/03_packing_luggage.jpg"
            alt="Organized luggage and packing for cruise"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Embarkation Day Section */}
      <section id="embarkation-day" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Embarkation Day Success
          </h2>

          <div className="bg-white rounded-xl p-8 mb-8">
            <h3 className="font-geograph text-2xl font-semibold text-gray-900 mb-6">
              🚢 Your Boarding Day Timeline
            </h3>

            <div className="space-y-4">
              {[
                {
                  time: "10:00 AM",
                  activity: "Arrive at port (even if boarding starts later)",
                },
                {
                  time: "10:30 AM",
                  activity: "Complete check-in and security",
                },
                { time: "11:00 AM", activity: "Board ship and explore" },
                { time: "12:00 PM", activity: "Grab lunch at buffet" },
                {
                  time: "1:00 PM",
                  activity: "Attend muster drill (mandatory safety briefing)",
                },
                {
                  time: "3:00 PM",
                  activity: "Stateroom ready, start unpacking",
                },
                { time: "4:00 PM", activity: "Ship sets sail! 🎉" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-start border-l-4 border-[#2238C3] pl-6 pb-4"
                >
                  <div className="flex-shrink-0">
                    <span className="font-semibold text-[#2238C3]">
                      {item.time}
                    </span>
                  </div>
                  <div className="ml-4">
                    <span className="text-gray-700">{item.activity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-8 mb-8">
            <h3 className="font-geograph text-2xl font-semibold text-gray-900 mb-6">
              ✅ Embarkation Day Checklist
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-lg text-[#2238C3] mb-4">
                  Before Leaving Home:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">
                      Check flight status if flying
                    </span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">Confirm hotel shuttle</span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">Eat a good breakfast</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-[#2238C3] mb-4">
                  At the Port:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">
                      Take a selfie by the ship!
                    </span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">
                      Keep documents accessible
                    </span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">
                      Tip porters ($2-3 per bag)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">Keep carry-on light</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-[#2238C3] mb-4">
                  First Hour Onboard:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">
                      Photo stateroom number
                    </span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">Locate muster station</span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">Find Guest Services</span>
                  </li>
                  <li className="flex items-start">
                    <input type="checkbox" className="mt-1 mr-2" />
                    <span className="text-gray-700">Download ship's app</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Continue with remaining sections following the same pattern... */}
      {/* I'll add placeholders for the remaining sections to keep the file manageable */}

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/04_boarding_day.jpg"
            alt="Cruise terminal on boarding day"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* First Day Onboard Section */}
      <section id="first-day-onboard" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Your First Day Onboard
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-xl p-8">
              <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
                🗺️ Ship Orientation Essentials
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>• Memorize your stateroom number and deck</li>
                <li>• Locate elevators and stairwells near your room</li>
                <li>• Find the Guest Services desk</li>
                <li>• Identify main dining areas and restaurants</li>
                <li>• Locate pools, bars, and entertainment venues</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-8">
              <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
                📱 Download the Ship's App
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>• View daily schedules and menus</li>
                <li>• Make restaurant reservations</li>
                <li>• Track your spending</li>
                <li>• Message other passengers</li>
                <li>• Order room service</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 bg-[#F6F3ED] rounded-xl p-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
              🍽️ First Day Dining Strategy
            </h3>
            <p className="text-gray-700 mb-4">
              <strong>Lunch Options:</strong> Buffet (quick & casual), Pool
              Grill (burgers & pizza), Specialty Restaurants (if reserved)
            </p>
            <p className="text-gray-700">
              <strong>Make Dinner Plans:</strong> Visit the maître d' to confirm
              dining time, make specialty reservations, check dress codes
            </p>
          </div>
        </div>
      </section>

      {/* Separator 8 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Dining & Food Section */}
      <section id="dining-food" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Dining & Food Adventures
          </h2>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-geograph text-xl font-semibold text-[#2238C3] mb-4">
                Main Dining Room
              </h3>
              <div className="space-y-2 text-gray-700 text-sm">
                <p>
                  <strong>Traditional:</strong> Fixed time dining
                </p>
                <p>
                  <strong>Flexible:</strong> Anytime 5:30-9:30 PM
                </p>
                <p className="text-green-600">✓ Included in cruise fare</p>
                <p className="text-green-600">✓ Full-service experience</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-geograph text-xl font-semibold text-[#2238C3] mb-4">
                Buffet Dining
              </h3>
              <div className="space-y-2 text-gray-700 text-sm">
                <p>
                  <strong>Hours:</strong> Usually 6 AM - 11 PM
                </p>
                <p>
                  <strong>Dress:</strong> Casual all day
                </p>
                <p className="text-green-600">✓ Quick and convenient</p>
                <p className="text-green-600">✓ Great variety</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-geograph text-xl font-semibold text-[#2238C3] mb-4">
                Specialty Restaurants
              </h3>
              <div className="space-y-2 text-gray-700 text-sm">
                <p>
                  <strong>Cost:</strong> $25-75+ per person
                </p>
                <p>
                  <strong>Types:</strong> Steakhouse, Italian, Asian
                </p>
                <p className="text-amber-600">$ Additional charge</p>
                <p className="text-amber-600">$ Book early!</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
              🥗 Foodie Pro Tips
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li>• Try something new every day</li>
              <li>• Ask your waiter for recommendations</li>
              <li>• Share appetizers and desserts with tablemates</li>
              <li>
                • Take advantage of room service (usually free basic menu)
              </li>
              <li>• Attend chef demonstrations and tastings</li>
              <li>• Eat at off-peak times to avoid crowds</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/05_dining_experience.jpg"
            alt="Elegant cruise dining experience"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Entertainment Section */}
      <section id="entertainment-activities" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Entertainment & Activities
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-geograph text-xl font-semibold text-[#2238C3] mb-4">
                🎪 Theater Shows
              </h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li>• Broadway-style performances</li>
                <li>• Guest entertainers & comedians</li>
                <li>• Times: Usually 7:00 PM and 9:30 PM</li>
                <li>
                  • <strong>Tip:</strong> Arrive 30 minutes early for best seats
                </li>
              </ul>

              <h3 className="font-geograph text-xl font-semibold text-[#2238C3] mb-4">
                🏊‍♀️ Deck Activities
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Pool games and contests</li>
                <li>• Live music and dancing</li>
                <li>• Movies under the stars</li>
                <li>• Fitness classes</li>
                <li>• Rock climbing, mini golf</li>
              </ul>
            </div>

            <div>
              <h3 className="font-geograph text-xl font-semibold text-[#2238C3] mb-4">
                🎯 Activities for Every Interest
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Adventure Seekers:
                  </h4>
                  <p className="text-sm text-gray-700">
                    Rock climbing, surf simulators, zip lines, go-kart tracks
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Relaxation Lovers:
                  </h4>
                  <p className="text-sm text-gray-700">
                    Spa treatments, adult-only sun decks, libraries, hot tubs
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Families:
                  </h4>
                  <p className="text-sm text-gray-700">
                    Kids' clubs, family game shows, scavenger hunts, pool
                    activities
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Learning Opportunities:
                  </h4>
                  <p className="text-sm text-gray-700">
                    Port talks, art auctions, wine tastings, cooking
                    demonstrations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Separator 10 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Shore Excursions Section */}
      <section id="shore-excursions" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Shore Excursions & Ports
          </h2>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-3">
                Cruise Line Tours
              </h3>
              <p className="text-sm text-green-600 mb-2">
                ✓ Guaranteed return to ship
              </p>
              <p className="text-sm text-red-600 mb-2">✗ More expensive</p>
              <p className="text-sm text-gray-700">
                Best for: First-time cruisers, exotic ports
              </p>
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-3">
                Independent Exploration
              </h3>
              <p className="text-sm text-green-600 mb-2">
                ✓ Less expensive, flexible
              </p>
              <p className="text-sm text-red-600 mb-2">
                ✗ Your responsibility to return
              </p>
              <p className="text-sm text-gray-700">
                Best for: Experienced travelers, beach days
              </p>
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-3">
                Private Tours
              </h3>
              <p className="text-sm text-green-600 mb-2">
                ✓ Customized, small group
              </p>
              <p className="text-sm text-red-600 mb-2">
                ✗ Most expensive option
              </p>
              <p className="text-sm text-gray-700">
                Best for: Special occasions, specific interests
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
              🎒 Port Day Essentials
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                "Ship keycard and photo ID",
                "Cash in local currency",
                "Sunscreen and hat",
                "Comfortable walking shoes",
                "Camera with extra battery",
                "Small backpack",
                "Water bottle",
                "Light snacks",
              ].map((item, index) => (
                <label key={index} className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2238C3]" />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/01_cruise_ship_ocean_alt.jpg"
            alt="Cruise ship on pristine blue waters"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Money Matters Section */}
      <section id="money-matters" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Money Matters & Budgeting
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-green-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-green-900 mb-4">
                ✅ Included in Your Fare
              </h3>
              <ul className="space-y-2 text-green-800">
                <li>• Stateroom accommodation</li>
                <li>• Main dining room meals</li>
                <li>• Buffet and casual dining</li>
                <li>• Most entertainment</li>
                <li>• Fitness center access</li>
                <li>• Pools and hot tubs</li>
              </ul>
            </div>

            <div className="bg-amber-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-amber-900 mb-4">
                💰 Additional Costs
              </h3>
              <ul className="space-y-2 text-amber-800">
                <li>• Gratuities ($12-15 pp/day)</li>
                <li>• Alcoholic beverages</li>
                <li>• Specialty dining</li>
                <li>• Shore excursions</li>
                <li>• Spa treatments</li>
                <li>• Internet/WiFi</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
              💡 Daily Budget Guidelines
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium text-gray-700">
                  Budget Cruise:
                </span>
                <span className="text-[#2238C3] font-semibold">
                  $50-75 per person per day
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium text-gray-700">Mid-Range:</span>
                <span className="text-[#2238C3] font-semibold">
                  $75-125 per person per day
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">
                  Luxury Experience:
                </span>
                <span className="text-[#2238C3] font-semibold">
                  $125+ per person per day
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Separator 12 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Health & Safety Section */}
      <section id="health-safety" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Health, Safety & Sea Sickness
          </h2>

          <div className="bg-white rounded-xl p-8 mb-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-6">
              🤢 Dealing with Seasickness
            </h3>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-[#2238C3] mb-4">
                  Prevention Strategies:
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Choose lower deck, midship cabin</li>
                  <li>• Stay hydrated</li>
                  <li>• Eat small, frequent meals</li>
                  <li>• Get fresh air on deck</li>
                  <li>• Focus on horizon when outside</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-[#2238C3] mb-4">Remedies:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Dramamine or Bonine</li>
                  <li>• Sea-Bands (acupressure)</li>
                  <li>• Ginger supplements</li>
                  <li>• Green apples</li>
                  <li>• Fresh air and light exercise</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-6">
              🏥 General Health & Safety Tips
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li>
                • Wash hands frequently (hand sanitizer stations everywhere)
              </li>
              <li>• Stay hydrated in the sun</li>
              <li>• Use sunscreen (you're closer to the equator!)</li>
              <li>• Pace yourself with alcohol</li>
              <li>• Be careful on wet decks</li>
              <li>• Attend mandatory muster drill</li>
              <li>• Know your muster station location</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/06_safety_health.jpg"
            alt="Cruise safety briefing at muster station"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Cruise Etiquette Section */}
      <section id="cruise-etiquette" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Cruise Etiquette & Social Tips
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-4">
                🤝 Dining Etiquette
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Use serving utensils at buffet</li>
                <li>• Dress appropriately for venue</li>
                <li>• Be patient with service</li>
                <li>• Try new foods</li>
                <li>• Be kind to staff</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-4">
                🏊 Pool & Deck Etiquette
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Don't save chairs and leave</li>
                <li>• Supervise children</li>
                <li>• Keep music reasonable</li>
                <li>• Share hot tub space</li>
                <li>• Shower before pools</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-4">
                👫 Making Friends
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Chat at the bar</li>
                <li>• Join group activities</li>
                <li>• Attend meetups</li>
                <li>• Talk with tablemates</li>
                <li>• Take group shore excursions</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-4">
                🎭 Entertainment Etiquette
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Turn off cell phones</li>
                <li>• Don't block views</li>
                <li>• Arrive on time</li>
                <li>• Participate enthusiastically</li>
                <li>• Respect quiet zones</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Separator 14 */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Disembarkation Section */}
      <section id="disembarkation" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Disembarkation & Going Home
          </h2>

          <div className="bg-white rounded-xl p-8 mb-8">
            <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-6">
              🧳 Last Night Preparation
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li>
                • <strong>Pack Smart:</strong> Leave out clothes for
                disembarkation day
              </li>
              <li>
                • <strong>Settle Your Bill:</strong> Review and pay final
                account
              </li>
              <li>
                • <strong>Luggage Tags:</strong> Place provided tags on bags for
                pickup
              </li>
              <li>
                • <strong>Set Bags Out:</strong> Usually by 11 PM outside your
                stateroom
              </li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-4">
                Self-Assist (Walk Off)
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Carry all your own luggage</li>
                <li>• Disembark earliest (7:30-8:30 AM)</li>
                <li>• Good for flights after 11 AM</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-lg text-[#2238C3] mb-4">
                Traditional Disembarkation
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Ship delivers luggage to terminal</li>
                <li>• Assigned time by luggage tag color</li>
                <li>• Usually 8:30 AM - 10:30 AM</li>
                <li>• Good for flights after 1 PM</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/07_disembarkation.jpg"
            alt="Passengers disembarking from cruise ship"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Insider Secrets Section */}
      <section id="insider-secrets" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Insider Secrets & Pro Tips
          </h2>

          <div className="grid gap-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-8">
              <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
                🎯 Cruise Hacks You Need to Know
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>
                  • <strong>Best Time to Book:</strong> 12-18 months in advance
                  or last minute (60 days)
                </li>
                <li>
                  • <strong>Cabin Selection:</strong> Midship and lower decks
                  for less motion
                </li>
                <li>
                  • <strong>Bring Your Own Wine:</strong> Most cruise lines
                  allow 1-2 bottles
                </li>
                <li>
                  • <strong>Book Spa on Port Days:</strong> Often discounted
                  when ship is in port
                </li>
                <li>
                  • <strong>Room Service Ice Cream:</strong> Usually free!
                </li>
                <li>
                  • <strong>Late Seating:</strong> Often has better service in
                  main dining room
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-8">
              <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
                📸 Photography Tips
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>• Golden hour photos on deck are magical</li>
                <li>
                  • Professional formal night photos are worth the splurge
                </li>
                <li>• Bring a waterproof case for port adventures</li>
                <li>• Take photos of your room number - you'll forget!</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-8">
              <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
                🔌 Technology Hacks
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>
                  • Download Netflix/Amazon content before cruise for offline
                  viewing
                </li>
                <li>• Bring a power strip (without surge protection)</li>
                <li>• Use airplane mode and ship's WiFi to save data</li>
                <li>• Download offline maps for ports</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-8">
              <h3 className="font-geograph text-xl font-semibold text-gray-900 mb-4">
                🎒 Packing Pro Tips
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li>• Magnetic hooks work on stateroom walls</li>
                <li>• Bring a small laundry bag for wet swimwear</li>
                <li>• Pack medications in multiple places</li>
                <li>• Bring a highlighter for daily activity schedules</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final Thoughts Section */}
      <div className="bg-gradient-to-b from-white to-[#F6F3ED] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-geograph text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Your Cruise Adventure Awaits! 🌊
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Congratulations! You're now armed with everything you need to know
            for an absolutely amazing first cruise experience. Remember, the
            most important thing is to relax, have fun, and embrace the
            adventure.
          </p>
          <p className="text-lg text-gray-700 mb-8">
            Every cruiser's experience is different, and part of the magic is
            discovering what you love most about cruising. Maybe it's the
            incredible food, the Broadway-style shows, the exotic ports, or
            simply lounging by the pool with a good book and a tropical drink.
          </p>

          <div className="mt-12">
            <p className="text-2xl font-geograph font-bold text-[#2238C3] mb-4">
              🎉 Most Importantly: Have FUN!
            </p>
            <p className="text-lg text-gray-700">
              Your first cruise is going to be incredible. Trust us, you're
              going to love it so much that you'll probably start planning your
              next one before you even get home. Welcome to the wonderful world
              of cruising!
            </p>
            <p className="mt-8 text-xl font-semibold text-gray-900">
              Bon voyage from all of us at Zipsea! ⚓
            </p>
          </div>
        </div>
      </div>

      {/* Photo Placeholder */}
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/images/cruise_images_curated/08_happy_cruisers.jpg"
            alt="Happy cruise passengers enjoying their vacation"
            className="rounded-xl w-full h-96 object-cover shadow-lg"
          />
        </div>
      </div>

      {/* Footer Credit */}
      <div className="py-8 text-center">
        <p className="text-gray-600 italic">
          This guide is brought to you by{" "}
          <span className="font-semibold text-[#2238C3]">Zipsea</span> - Your
          ultimate cruise planning companion.
        </p>
      </div>
    </div>
  );
}
