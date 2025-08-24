'use client';
import Image from "next/image";

export default function WhyZipsea() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-[30px] px-[60px]" style={{ backgroundColor: 'transparent' }}>
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
          
          {/* Navigation Links and Button */}
          <div className="flex items-center gap-8">
            <a 
              href="/why-zipsea" 
              className="flex items-center text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <path d="M6.06934 6.31836C6.46126 6.14636 7.28356 5.90302 8.08594 6.04004C9.17853 6.22685 9.51264 6.66491 9.64844 6.77441C9.77739 6.87847 10.594 7.75839 11.8145 7.09766C11.897 7.05299 12 7.11255 12 7.20996V9.47949C12 9.53181 11.9688 9.57887 11.9219 9.59668L9.50684 10.5137C9.41136 10.5499 9.39926 10.6895 9.48145 10.752C9.50252 10.7679 9.52317 10.7842 9.54297 10.8008C10.0429 11.2194 10.3024 11.4638 10.833 11.4639C11.2557 11.4639 11.5536 11.3538 11.8193 11.208C11.9005 11.1636 12 11.2233 12 11.3193V12.7012C12 12.7522 11.9707 12.7988 11.9248 12.8154C11.6062 12.9306 10.964 13.0773 10.333 12.9521C9.63193 12.813 9.10651 12.4344 8.93164 12.2627C8.68655 12.05 8.0849 11.6332 7.63574 11.6641C7.11178 11.7001 7.00654 11.6684 6.16797 12.0615C6.08928 12.0984 6.00006 12.0386 6 11.9482V9.71973C6 9.66741 6.03125 9.62035 6.07812 9.60254L9.21387 8.41211C9.24017 8.40213 9.24459 8.3647 9.22266 8.34668C8.93261 8.11484 8.16089 7.50289 7.56836 7.52832C7.04679 7.551 6.6588 7.67374 6.17773 7.93555C6.09755 7.97919 6 7.919 6 7.82422V6.42969C6.00014 6.3813 6.02682 6.3371 6.06934 6.31836Z" fill="white"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.25C13.8325 0.25 17.75 4.16751 17.75 9C17.75 13.8325 13.8325 17.75 9 17.75C4.16751 17.75 0.25 13.8325 0.25 9C0.25 4.16751 4.16751 0.25 9 0.25ZM9 1.75C4.99594 1.75 1.75 4.99594 1.75 9C1.75 13.0041 4.99594 16.25 9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75Z" fill="white"/>
              </svg>
              Why Zipsea
            </a>
            <a 
              href="/faqs" 
              className="flex items-center text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 18 19" fill="none" className="mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <path d="M6.8667 7.36535C6.86677 6.97426 6.97435 6.59071 7.17768 6.25663C7.38101 5.92255 7.67226 5.65079 8.01961 5.47106C8.36695 5.29132 8.75702 5.21053 9.14718 5.2375C9.53734 5.26448 9.91258 5.39819 10.2319 5.62401C10.5512 5.84984 10.8023 6.1591 10.9577 6.51798C11.1131 6.87686 11.1669 7.27157 11.1131 7.65895C11.0594 8.04633 10.9002 8.41148 10.6529 8.71449C10.4057 9.0175 10.0799 9.24672 9.71114 9.37708C9.50309 9.45064 9.32297 9.58692 9.19561 9.76713C9.06825 9.94735 8.99992 10.1626 9.00003 10.3833V11.0987" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M9 12.75C8.85166 12.75 8.70666 12.794 8.58332 12.8764C8.45999 12.9588 8.36386 13.0759 8.30709 13.213C8.25032 13.35 8.23547 13.5008 8.26441 13.6463C8.29335 13.7918 8.36478 13.9254 8.46967 14.0303C8.57456 14.1352 8.7082 14.2066 8.85368 14.2356C8.99917 14.2645 9.14997 14.2497 9.28701 14.1929C9.42406 14.1361 9.54119 14.04 9.6236 13.9167C9.70601 13.7933 9.75 13.6483 9.75 13.5C9.75 13.3011 9.67098 13.1103 9.53033 12.9697C9.38968 12.829 9.19891 12.75 9 12.75Z" fill="white"/>
                <path d="M9 17.5C13.4183 17.5 17 13.9183 17 9.5C17 5.08172 13.4183 1.5 9 1.5C4.58172 1.5 1 5.08172 1 9.5C1 13.9183 4.58172 17.5 9 17.5Z" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
              </svg>
              FAQs
            </a>
            <a 
              href="#" 
              className="flex items-center text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <path d="M9.53333 1.25001C8.2027 1.24809 6.89579 1.60231 5.74825 2.27589C4.6007 2.94948 3.65432 3.91789 3.00732 5.08063C2.36032 6.24337 2.03627 7.55808 2.06881 8.88831C2.10135 10.2185 2.48928 11.5158 3.19235 12.6456L1 17.25L5.60373 15.0569C6.58554 15.6676 7.69576 16.0419 8.8469 16.1504C9.99804 16.2589 11.1586 16.0985 12.2372 15.682C13.3158 15.2654 14.283 14.6041 15.0624 13.7501C15.8418 12.896 16.4123 11.8727 16.7288 10.7606C17.0453 9.64851 17.0992 8.47813 16.8863 7.34166C16.6734 6.2052 16.1994 5.13372 15.5018 4.21165C14.8042 3.28958 13.902 2.54212 12.8662 2.02817C11.8305 1.51423 10.6896 1.24785 9.53333 1.25001Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M7.85226 7.4727C7.7214 7.20606 7.51841 6.98144 7.26632 6.82435C7.01424 6.66726 6.72316 6.58398 6.42613 6.58398C6.12911 6.58398 5.83803 6.66726 5.58594 6.82435C5.33386 6.98144 5.13086 7.20606 5 7.4727" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M14.2483 7.4727C14.1174 7.20606 13.9144 6.98144 13.6623 6.82435C13.4102 6.66726 13.1192 6.58398 12.8221 6.58398C12.5251 6.58398 12.234 6.66726 11.9819 6.82435C11.7299 6.98144 11.5269 7.20606 11.396 7.4727" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                <path d="M6.87061 11.3828C7.62326 12.0691 8.6051 12.4495 9.62367 12.4495C10.6422 12.4495 11.6241 12.0691 12.3767 11.3828" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
              </svg>
              Chat with us
            </a>
            
            {/* Sign up/Log in Button */}
            <button 
              className="px-5 py-3.5 border border-white rounded-full text-white text-[16px] font-medium font-geograph hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'transparent' }}
            >
              Sign up/Log in
            </button>
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
                  <svg width="24" height="24" viewBox="0 0 18 18" fill="none" className="mr-3" style={{ shapeRendering: 'geometricPrecision' }}>
                    <path d="M6.06934 6.31836C6.46126 6.14636 7.28356 5.90302 8.08594 6.04004C9.17853 6.22685 9.51264 6.66491 9.64844 6.77441C9.77739 6.87847 10.594 7.75839 11.8145 7.09766C11.897 7.05299 12 7.11255 12 7.20996V9.47949C12 9.53181 11.9688 9.57887 11.9219 9.59668L9.50684 10.5137C9.41136 10.5499 9.39926 10.6895 9.48145 10.752C9.50252 10.7679 9.52317 10.7842 9.54297 10.8008C10.0429 11.2194 10.3024 11.4638 10.833 11.4639C11.2557 11.4639 11.5536 11.3538 11.8193 11.208C11.9005 11.1636 12 11.2233 12 11.3193V12.7012C12 12.7522 11.9707 12.7988 11.9248 12.8154C11.6062 12.9306 10.964 13.0773 10.333 12.9521C9.63193 12.813 9.10651 12.4344 8.93164 12.2627C8.68655 12.05 8.0849 11.6332 7.63574 11.6641C7.11178 11.7001 7.00654 11.6684 6.16797 12.0615C6.08928 12.0984 6.00006 12.0386 6 11.9482V9.71973C6 9.66741 6.03125 9.62035 6.07812 9.60254L9.21387 8.41211C9.24017 8.40213 9.24459 8.3647 9.22266 8.34668C8.93261 8.11484 8.16089 7.50289 7.56836 7.52832C7.04679 7.551 6.6588 7.67374 6.17773 7.93555C6.09755 7.97919 6 7.919 6 7.82422V6.42969C6.00014 6.3813 6.02682 6.3371 6.06934 6.31836Z" fill="#2f2f2f"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M9 0.25C13.8325 0.25 17.75 4.16751 17.75 9C17.75 13.8325 13.8325 17.75 9 17.75C4.16751 17.75 0.25 13.8325 0.25 9C0.25 4.16751 4.16751 0.25 9 0.25ZM9 1.75C4.99594 1.75 1.75 4.99594 1.75 9C1.75 13.0041 4.99594 16.25 9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75Z" fill="#2f2f2f"/>
                  </svg>
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
                  <svg width="24" height="24" viewBox="0 0 18 19" fill="none" className="mr-3" style={{ shapeRendering: 'geometricPrecision' }}>
                    <path d="M6.8667 7.36535C6.86677 6.97426 6.97435 6.59071 7.17768 6.25663C7.38101 5.92255 7.67226 5.65079 8.01961 5.47106C8.36695 5.29132 8.75702 5.21053 9.14718 5.2375C9.53734 5.26448 9.91258 5.39819 10.2319 5.62401C10.5512 5.84984 10.8023 6.1591 10.9577 6.51798C11.1131 6.87686 11.1669 7.27157 11.1131 7.65895C11.0594 8.04633 10.9002 8.41148 10.6529 8.71449C10.4057 9.0175 10.0799 9.24672 9.71114 9.37708C9.50309 9.45064 9.32297 9.58692 9.19561 9.76713C9.06825 9.94735 8.99992 10.1626 9.00003 10.3833V11.0987" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M9 12.75C8.85166 12.75 8.70666 12.794 8.58332 12.8764C8.45999 12.9588 8.36386 13.0759 8.30709 13.213C8.25032 13.35 8.23547 13.5008 8.26441 13.6463C8.29335 13.7918 8.36478 13.9254 8.46967 14.0303C8.57456 14.1352 8.7082 14.2066 8.85368 14.2356C8.99917 14.2645 9.14997 14.2497 9.28701 14.1929C9.42406 14.1361 9.54119 14.04 9.6236 13.9167C9.70601 13.7933 9.75 13.6483 9.75 13.5C9.75 13.3011 9.67098 13.1103 9.53033 12.9697C9.38968 12.829 9.19891 12.75 9 12.75Z" fill="#2f2f2f"/>
                    <path d="M9 17.5C13.4183 17.5 17 13.9183 17 9.5C17 5.08172 13.4183 1.5 9 1.5C4.58172 1.5 1 5.08172 1 9.5C1 13.9183 4.58172 17.5 9 17.5Z" stroke="#2f2f2f" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  </svg>
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
                  <svg width="24" height="24" viewBox="0 0 18 18" fill="none" className="mr-3" style={{ shapeRendering: 'geometricPrecision' }}>
                    <path d="M9.53333 1.25001C8.2027 1.24809 6.89579 1.60231 5.74825 2.27589C4.6007 2.94948 3.65432 3.91789 3.00732 5.08063C2.36032 6.24337 2.03627 7.55808 2.06881 8.88831C2.10135 10.2185 2.48928 11.5158 3.19235 12.6456L1 17.25L5.60373 15.0569C6.58554 15.6676 7.69576 16.0419 8.8469 16.1504C9.99804 16.2589 11.1586 16.0985 12.2372 15.682C13.3158 15.2654 14.283 14.6041 15.0624 13.7501C15.8418 12.896 16.4123 11.8727 16.7288 10.7606C17.0453 9.64851 17.0992 8.47813 16.8863 7.34166C16.6734 6.2052 16.1994 5.13372 15.5018 4.21165C14.8042 3.28958 13.902 2.54212 12.8662 2.02817C11.8305 1.51423 10.6896 1.24785 9.53333 1.25001Z" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M7.85226 7.4727C7.7214 7.20606 7.51841 6.98144 7.26632 6.82435C7.01424 6.66726 6.72316 6.58398 6.42613 6.58398C6.12911 6.58398 5.83803 6.66726 5.58594 6.82435C5.33386 6.98144 5.13086 7.20606 5 7.4727" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M14.2483 7.4727C14.1174 7.20606 13.9144 6.98144 13.6623 6.82435C13.4102 6.66726 13.1192 6.58398 12.8221 6.58398C12.5251 6.58398 12.234 6.66726 11.9819 6.82435C11.7299 6.98144 11.5269 7.20606 11.396 7.4727" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                    <path d="M6.87061 11.3828C7.62326 12.0691 8.6051 12.4495 9.62367 12.4495C10.6422 12.4495 11.6241 12.0691 12.3767 11.3828" stroke="#2f2f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                  </svg>
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
                  <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                    <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                    <path d="M29.5162 16.3304C29.3707 16.2552 29.229 16.1727 29.0917 16.0834C28.6925 15.8194 28.3264 15.5084 28.0015 15.1571C27.1884 14.2267 26.8847 13.2829 26.7729 12.6221H26.7774C26.6839 12.0736 26.7226 11.7188 26.7284 11.7188H23.025V26.0389C23.025 26.2312 23.025 26.4212 23.0169 26.609C23.0169 26.6324 23.0147 26.6539 23.0134 26.6791C23.0134 26.6894 23.0134 26.7002 23.0111 26.711C23.0111 26.7137 23.0111 26.7164 23.0111 26.7191C22.9721 27.2329 22.8074 27.7292 22.5315 28.1644C22.2556 28.5996 21.877 28.9604 21.429 29.2149C20.962 29.4806 20.4339 29.6199 19.8967 29.6192C18.1712 29.6192 16.7728 28.2123 16.7728 26.4747C16.7728 24.7371 18.1712 23.3302 19.8967 23.3302C20.2233 23.3299 20.5479 23.3813 20.8584 23.4824L20.8629 19.7117C19.9202 19.5899 18.9624 19.6648 18.0501 19.9317C17.1378 20.1986 16.2906 20.6517 15.5622 21.2624C14.9238 21.817 14.3872 22.4788 13.9764 23.2179C13.8201 23.4874 13.2303 24.5704 13.1588 26.3282C13.1139 27.326 13.4135 28.3596 13.5564 28.7868V28.7958C13.6462 29.0474 13.9944 29.9058 14.5617 30.6295C15.0193 31.21 15.5598 31.72 16.1659 32.1429V32.1339L16.1749 32.1429C17.9677 33.3612 19.9555 33.2812 19.9555 33.2812C20.2996 33.2673 21.4523 33.2812 22.7613 32.6609C24.2132 31.9731 25.0398 30.9485 25.0398 30.9485C25.5678 30.3362 25.9877 29.6385 26.2814 28.8852C26.6165 28.0043 26.7284 26.9477 26.7284 26.5254V18.9283C26.7733 18.9552 27.3717 19.351 27.3717 19.351C27.3717 19.351 28.2337 19.9035 29.5787 20.2633C30.5436 20.5194 31.8436 20.5733 31.8436 20.5733V16.8969C31.3881 16.9463 30.4632 16.8026 29.5162 16.3304Z" fill="white"/>
                  </svg>
                </a>
                
                {/* Instagram Icon */}
                <a 
                  href="https://www.instagram.com/zipseacruises/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                    <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                    <g clipPath="url(#clip0_637_3559_why)">
                      <path d="M23 13.163C26.204 13.163 26.584 13.175 27.85 13.233C31.102 13.381 32.621 14.924 32.769 18.152C32.827 19.417 32.838 19.797 32.838 23.001C32.838 26.206 32.826 26.585 32.769 27.85C32.62 31.075 31.105 32.621 27.85 32.769C26.584 32.827 26.206 32.839 23 32.839C19.796 32.839 19.416 32.827 18.151 32.769C14.891 32.62 13.38 31.07 13.232 27.849C13.174 26.584 13.162 26.205 13.162 23C13.162 19.796 13.175 19.417 13.232 18.151C13.381 14.924 14.896 13.38 18.151 13.232C19.417 13.175 19.796 13.163 23 13.163ZM23 11C19.741 11 19.333 11.014 18.053 11.072C13.695 11.272 11.273 13.69 11.073 18.052C11.014 19.333 11 19.741 11 23C11 26.259 11.014 26.668 11.072 27.948C11.272 32.306 13.69 34.728 18.052 34.928C19.333 34.986 19.741 35 23 35C26.259 35 26.668 34.986 27.948 34.928C32.302 34.728 34.73 32.31 34.927 27.948C34.986 26.668 35 26.259 35 23C35 19.741 34.986 19.333 34.928 18.053C34.732 13.699 32.311 11.273 27.949 11.073C26.668 11.014 26.259 11 23 11ZM23 16.838C19.597 16.838 16.838 19.597 16.838 23C16.838 26.403 19.597 29.163 23 29.163C26.403 29.163 29.162 26.404 29.162 23C29.162 19.597 26.403 16.838 23 16.838ZM23 27C20.791 27 19 25.21 19 23C19 20.791 20.791 19 23 19C25.209 19 27 20.791 27 23C27 25.21 25.209 27 23 27ZM29.406 15.155C28.61 15.155 27.965 15.8 27.965 16.595C27.965 17.39 28.61 18.035 29.406 18.035C30.201 18.035 30.845 17.39 30.845 16.595C30.845 15.8 30.201 15.155 29.406 15.155Z" fill="white"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_637_3559_why">
                        <rect width="24" height="24" fill="white" transform="translate(11 11)"/>
                      </clipPath>
                    </defs>
                  </svg>
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