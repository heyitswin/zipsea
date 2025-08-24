'use client';
import Image from "next/image";

export default function WhyZipsea() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-light-blue py-[30px] px-[60px]">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="w-[110px]">
            <a href="/">
              <Image
                src="/images/zipsea-logo.svg"
                alt="Zipsea"
                width={110}
                height={40}
                className="brightness-0 invert"
                priority
              />
            </a>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <a 
              href="/why-zipsea" 
              className="text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              Why Zipsea
            </a>
            <a 
              href="/faqs" 
              className="text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              FAQ
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="bg-[#F5F1E7] pt-[100px]">
        {/* Why Zipsea Section */}
        <section className="py-[80px] px-8">
          <div className="max-w-4xl mx-auto">
            {/* Title */}
            <h1 
              className="text-center mb-[30px] font-whitney font-black"
              style={{
                color: '#0E1B4D',
                fontSize: '52px',
                letterSpacing: '-0.02em'
              }}
            >
              Why Zipsea
            </h1>

            {/* Subtitle */}
            <p 
              className="text-center mb-[80px] font-geograph font-medium"
              style={{
                color: '#0E1B4D',
                fontSize: '24px',
                letterSpacing: '-0.02em',
                lineHeight: '1.4'
              }}
            >
              Because cruise booking needs a serious glow-up.
            </p>

            {/* Content Sections */}
            <div className="space-y-[60px]">
              {/* Section 1 */}
              <div className="text-center">
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '18px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.6'
                  }}
                >
                  We get it. Most cruise booking sites still look like they were coded on a dial-up modem back in 1999. Tiny text, clunky forms, and search tools that make you want to close the tab and just… give up. We thought: It's 2025. Why should booking a cruise feel stuck in the past?
                </p>
              </div>

              {/* Section 2 */}
              <div className="text-center">
                <h2 
                  className="font-geograph font-bold mb-[20px]"
                  style={{
                    fontSize: '22px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.3'
                  }}
                >
                  We're not like the old guard.
                </h2>
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '18px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.6'
                  }}
                >
                  A lot of travel agents keep as much of their commission as they can, giving you little (if any) back. That means less onboard credit in your pocket and more money in theirs. At Zipsea, we flip the script: we give you the maximum onboard credit the cruise lines allow — every single time. Because your vacation should benefit you, not just your agent.
                </p>
              </div>

              {/* Section 3 */}
              <div className="text-center">
                <h2 
                  className="font-geograph font-bold mb-[20px]"
                  style={{
                    fontSize: '22px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.3'
                  }}
                >
                  We're built with tech that makes sense today.
                </h2>
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '18px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.6'
                  }}
                >
                  No more calling a 1-800 number just to hold a cabin. No more waiting for "office hours." We built Zipsea so you can browse, compare, and book online — with a modern design, clear pricing, and instant onboard credit shown upfront. The way booking should feel in 2025.
                </p>
              </div>

              {/* Section 4 */}
              <div className="text-center">
                <h2 
                  className="font-geograph font-bold mb-[20px]"
                  style={{
                    fontSize: '22px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.3'
                  }}
                >
                  We're made for modern travelers.
                </h2>
                <p 
                  className="font-geograph"
                  style={{
                    fontSize: '18px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.6'
                  }}
                >
                  Cruising isn't just for retirees anymore. Younger families, first-timers, and adventure-seekers are heading to sea in record numbers. We've designed Zipsea with you in mind — fresh, approachable, and actually fun to use. Because booking your dream vacation should feel as exciting as setting sail.
                </p>
              </div>

              {/* Section 5 */}
              <div className="text-center">
                <h2 
                  className="font-geograph font-bold mb-[20px]"
                  style={{
                    fontSize: '22px',
                    color: '#0E1B4D',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.3'
                  }}
                >
                  The bottom line?
                </h2>
                <div 
                  className="font-geograph"
                  style={{
                    fontSize: '18px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.6'
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
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />

      {/* Footer Section */}
      <footer className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex justify-between items-start">
            {/* Left side - Logo and links */}
            <div className="flex flex-col">
              {/* Zipsea Logo */}
              <div className="mb-6">
                <a href="/">
                  <Image
                    src="/images/zipsea-logo.svg"
                    alt="Zipsea"
                    width={110}
                    height={40}
                    className="brightness-0"
                    style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(89%)' }}
                  />
                </a>
              </div>
              
              {/* Terms & Conditions Link */}
              <a 
                href="#" 
                className="font-geograph font-bold mb-3"
                style={{
                  fontSize: '9px',
                  color: '#2f2f2f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}
              >
                TERMS & CONDITIONS
              </a>
              
              {/* Privacy Policy Link */}
              <a 
                href="#" 
                className="font-geograph font-bold"
                style={{
                  fontSize: '9px',
                  color: '#2f2f2f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}
              >
                PRIVACY POLICY
              </a>
            </div>
            
            {/* Right side - Navigation links and social icons */}
            <div className="flex items-center gap-8">
              {/* Navigation Links */}
              <div className="flex items-center gap-8">
                {/* Why Zipsea */}
                <a 
                  href="/why-zipsea" 
                  className="flex items-center font-geograph font-medium hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '16px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em'
                  }}
                >
                  <Image
                    src="/images/why-zipsea.svg"
                    alt=""
                    width={24}
                    height={24}
                    className="mr-3"
                  />
                  Why Zipsea
                </a>
                
                {/* FAQs */}
                <a 
                  href="/faqs" 
                  className="flex items-center font-geograph font-medium hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '16px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em'
                  }}
                >
                  <Image
                    src="/images/faqs.svg"
                    alt=""
                    width={24}
                    height={24}
                    className="mr-3"
                  />
                  FAQs
                </a>
                
                {/* Chat with us */}
                <a 
                  href="#" 
                  className="flex items-center font-geograph font-medium hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '16px',
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em'
                  }}
                >
                  <Image
                    src="/images/chat-with-us.svg"
                    alt=""
                    width={24}
                    height={24}
                    className="mr-3"
                  />
                  Chat with us
                </a>
              </div>
              
              {/* Social Icons with reduced spacing */}
              <div className="flex items-center gap-4">
                {/* TikTok Icon */}
                <a 
                  href="https://www.tiktok.com/@zipseacruises"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <Image
                    src="/images/tiktok.svg"
                    alt="TikTok"
                    width={45}
                    height={45}
                  />
                </a>
                
                {/* Instagram Icon */}
                <a 
                  href="https://www.instagram.com/zipseacruises/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <Image
                    src="/images/instagram.svg"
                    alt="Instagram"
                    width={45}
                    height={45}
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom spacing */}
        <div className="h-[300px]" />
      </footer>
    </>
  );
}