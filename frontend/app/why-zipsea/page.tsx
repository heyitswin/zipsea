'use client';
import Image from "next/image";

export default function WhyZipsea() {
  return (
    <>

      {/* Hero Section */}
      <section className="relative pt-[100px] pb-[80px]" style={{ backgroundColor: '#0E1B4D' }}>
        <div className="max-w-4xl mx-auto px-8 text-center">
          {/* Title */}
          <h1 
            className="mb-0 font-whitney font-black uppercase"
            style={{
              color: '#F7F170',
              fontSize: '72px',
              letterSpacing: '-0.02em'
            }}
          >
            Why Zipsea
          </h1>

          {/* Subtitle */}
          <p 
            className="font-geograph font-medium"
            style={{
              color: '#F7F170',
              fontSize: '24px',
              letterSpacing: '-0.02em',
              lineHeight: '1.4'
            }}
          >
            Because cruise booking needs a serious glow-up.
          </p>
        </div>
      </section>

      {/* Separator Image */}
      <div 
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-5.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />

      {/* Main Content */}
      <main style={{ backgroundColor: '#E9B4EB' }} className="py-[80px]">
        {/* Why Zipsea Section */}
        <section className="px-8">
          <div className="max-w-4xl mx-auto">

            {/* Content Sections */}
            <div className="space-y-[60px]">
              {/* Section 1 */}
              <div className="text-center">
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '24px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.5'
                  }}
                >
                  We get it. Most cruise booking sites still look like they were coded on a dial-up modem back in 1999. Tiny text, clunky forms, and search tools that make you want to close the tab and just… give up. We thought: It's 2025. Why should booking a cruise feel stuck in the past?
                </p>
              </div>

              {/* Section 2 */}
              <div className="text-center">
                <h2 
                  className="font-whitney font-black mb-[20px] uppercase"
                  style={{
                    fontSize: '42px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1'
                  }}
                >
                  We're not like the old guard.
                </h2>
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '24px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.5'
                  }}
                >
                  A lot of travel agents keep as much of their commission as they can, giving you little (if any) back. That means less onboard credit in your pocket and more money in theirs. At Zipsea, we flip the script: we give you the maximum onboard credit the cruise lines allow — every single time. Because your vacation should benefit you, not just your agent.
                </p>
              </div>

              {/* Section 3 */}
              <div className="text-center">
                <h2 
                  className="font-whitney font-black mb-[20px] uppercase"
                  style={{
                    fontSize: '42px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1'
                  }}
                >
                  We're built with tech that makes sense today.
                </h2>
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '24px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.5'
                  }}
                >
                  No more calling a 1-800 number just to hold a cabin. No more waiting for "office hours." We built Zipsea so you can browse, compare, and book online — with a modern design, clear pricing, and instant onboard credit shown upfront. The way booking should feel in 2025.
                </p>
              </div>

              {/* Section 4 */}
              <div className="text-center">
                <h2 
                  className="font-whitney font-black mb-[20px] uppercase"
                  style={{
                    fontSize: '42px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1'
                  }}
                >
                  We're made for modern travelers.
                </h2>
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '24px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.5'
                  }}
                >
                  Cruising isn't just for retirees anymore. Younger families, first-timers, and adventure-seekers are heading to sea in record numbers. We've designed Zipsea with you in mind — fresh, approachable, and actually fun to use. Because booking your dream vacation should feel as exciting as setting sail.
                </p>
              </div>

              {/* Section 5 */}
              <div className="text-center">
                <h2 
                  className="font-whitney font-black mb-[20px] uppercase"
                  style={{
                    fontSize: '42px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1'
                  }}
                >
                  The bottom line?
                </h2>
                <div 
                  className="font-geograph"
                  style={{
                    fontSize: '24px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.5'
                  }}
                >
                  <p className="mb-4">We're here to make cruise booking transparent, modern, and rewarding.</p>
                  <p className="mb-4">Better design. Better perks. Better experience.</p>
                  <p className="font-medium" style={{ color: '#0E1B4D' }}>That's why Zipsea.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Separator Image 3 */}
      <div 
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-6.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />

    </>
  );
}