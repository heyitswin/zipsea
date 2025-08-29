'use client';

export default function PrivacyPolicy() {
  return (
    <>
      {/* Hero Section - Mobile Responsive */}
      <section className="relative pt-[100px] pb-[80px]" style={{ backgroundColor: '#0E1B4D' }}>
        <div className="max-w-4xl mx-auto px-8 text-center">
          {/* Title - Mobile Responsive */}
          <h1 
            className="mb-0 md:mb-0 font-whitney font-black uppercase text-[52px] md:text-[72px]"
            style={{
              color: '#F7F170',
              letterSpacing: '-0.02em'
            }}
          >
            Privacy Policy
          </h1>

          {/* Subtitle - Mobile Responsive */}
          <p 
            className="font-geograph font-medium text-[16px] md:text-[24px]"
            style={{
              color: '#F7F170',
              letterSpacing: '-0.02em',
              lineHeight: '1.4'
            }}
          >
            Effective Date: January 1, 2025
          </p>
        </div>
      </section>

      {/* Separator Image */}
      <div 
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-2.png")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '1749px 21px',
          backgroundPosition: 'left top'
        }}
      />

      {/* Main Content - Mobile Responsive */}
      <main style={{ backgroundColor: '#F5F5F5' }} className="py-[40px] md:py-[80px]">
        <section className="px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-8 md:p-12 shadow-lg">
              
              {/* Introduction */}
              <div className="mb-8">
                <p 
                  className="font-geograph text-[16px] md:text-[18px]"
                  style={{
                    color: '#2f2f2f',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.75'
                  }}
                >
                  We value your privacy. This Privacy Policy explains what data we collect, how we use it, and your rights.
                </p>
              </div>

              {/* Content Sections */}
              <div className="space-y-8">
                {/* Section 1 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    1. What We Collect
                  </h2>
                  <div 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    <p className="mb-4">When you use Zipsea, we may collect:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Personal info: name, email, phone, address, passport details (if required by cruise line).</li>
                      <li>Booking details: cruise line, sailing date, cabin preferences.</li>
                      <li>Payment info (processed securely via our host agency, not stored by us).</li>
                      <li>Usage data: browser type, device, IP address, and analytics.</li>
                    </ul>
                  </div>
                </div>

                {/* Section 2 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    2. How We Use Your Data
                  </h2>
                  <div 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    <p className="mb-4">We use your data to:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Process cruise bookings and provide confirmations.</li>
                      <li>Communicate with you about your trip.</li>
                      <li>Offer customer support.</li>
                      <li>Improve our website and services using analytics (we use Posthog).</li>
                      <li>Send promotional emails if you opt in.</li>
                    </ul>
                  </div>
                </div>

                {/* Section 3 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    3. Sharing Information
                  </h2>
                  <div 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    <p className="mb-4">We may share your data with:</p>
                    <ul className="list-disc pl-6 space-y-2 mb-4">
                      <li>Cruise lines and suppliers to complete bookings.</li>
                      <li>Our host agency for payment processing.</li>
                      <li>Third-party providers like Traveltek (API) and analytics tools.</li>
                    </ul>
                    <p className="font-medium">We never sell your personal data.</p>
                  </div>
                </div>

                {/* Section 4 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    4. Cookies & Tracking
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    We use cookies and tracking tools (including Posthog) to understand site performance and improve user experience.
                  </p>
                </div>

                {/* Section 5 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    5. Data Retention
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    We keep booking data as long as necessary to fulfill your trip and comply with legal obligations.
                  </p>
                </div>

                {/* Section 6 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    6. Your Rights
                  </h2>
                  <div 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    <p className="mb-4">Depending on where you live, you may have rights to:</p>
                    <ul className="list-disc pl-6 space-y-2 mb-4">
                      <li>Access your personal data.</li>
                      <li>Correct or delete your data.</li>
                      <li>Opt out of marketing communications.</li>
                    </ul>
                    <p>
                      To exercise your rights, email{' '}
                      <a 
                        href="mailto:win@zipsea.com"
                        className="text-dark-blue underline hover:opacity-80 transition-opacity"
                      >
                        win@zipsea.com
                      </a>
                    </p>
                  </div>
                </div>

                {/* Section 7 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    7. Security
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    We use industry-standard practices to protect your data. However, no online system is 100% secure.
                  </p>
                </div>

                {/* Section 8 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    8. Third-Party Links
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    Our site may contain links to cruise line or partner websites. We're not responsible for their privacy practices.
                  </p>
                </div>

                {/* Section 9 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    9. Changes to Policy
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    We may update this Privacy Policy from time to time. Updates will be posted here.
                  </p>
                </div>

                {/* Section 10 */}
                <div>
                  <h2 
                    className="font-whitney font-black mb-4 text-[24px] md:text-[28px]"
                    style={{
                      color: '#0E1B4D',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    10. Contact Us
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    Questions? Email{' '}
                    <a 
                      href="mailto:win@zipsea.com"
                      className="text-dark-blue underline hover:opacity-80 transition-opacity"
                    >
                      win@zipsea.com
                    </a>
                  </p>
                </div>

                {/* Back to Home */}
                <div className="mt-12 text-center">
                  <a 
                    href="/"
                    className="inline-flex items-center font-geograph font-medium text-[16px] md:text-[18px] px-6 py-3 bg-dark-blue text-white rounded-full hover:bg-dark-blue/90 transition-colors"
                    style={{
                      letterSpacing: '-0.02em'
                    }}
                  >
                    ← Back to Home
                  </a>
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
    </>
  );
}