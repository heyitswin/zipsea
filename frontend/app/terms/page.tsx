'use client';

export default function TermsOfService() {
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
            Terms of Service
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
          backgroundImage: 'url("/images/separator-1.png")',
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
                  Welcome to Zipsea, operated by Zipsea, Inc. ("Zipsea," "we," "our," or "us"). By using our website and services, you agree to these Terms of Service ("Terms"). Please read carefully.
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
                    1. Who We Are
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    Zipsea is a travel agency specializing in cruise bookings. We provide access to cruise fares and packages through our host agency and partners, including insurance options. All bookings are subject to the cruise line's own terms, conditions, and cancellation policies.
                  </p>
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
                    2. Eligibility
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    You must be at least 18 years old to make a booking. By using Zipsea, you confirm you have the legal authority to enter into this agreement and to make travel arrangements for yourself or others.
                  </p>
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
                    3. How Bookings Work
                  </h2>
                  <div 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Cruise data is provided via Traveltek's API.</li>
                      <li>Actual reservations and payments are processed through our licensed host agency with the cruise line.</li>
                      <li>Once you confirm a booking, you will receive a confirmation email. Your contract for travel services is ultimately with the cruise line.</li>
                    </ul>
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
                    4. Payments
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    All payments go directly to the cruise line via our host agency. Zipsea does not store your credit card information.
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
                    5. Cancellations & Refunds
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    All cancellations, refunds, and penalties follow the cruise line's policies. Zipsea has no authority to override or waive cruise line rules.
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
                    6. Onboard Credit (OBC)
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    When possible, Zipsea will apply the maximum onboard credit allowed by the cruise line. Onboard credit is non-transferable, non-refundable, and valid only during your sailing.
                  </p>
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
                    7. Liability Disclaimer
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    Zipsea acts as an agent for cruise lines and suppliers. We are not liable for acts, errors, omissions, warranties, or negligence of third parties, including cruise operators, travel providers, or insurers.
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
                    8. Changes to Terms
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    We may update these Terms occasionally. Your continued use of Zipsea after updates means you agree to the new Terms.
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
                    9. Governing Law
                  </h2>
                  <p 
                    className="font-geograph text-[16px] md:text-[18px]"
                    style={{
                      color: '#2f2f2f',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.75'
                    }}
                  >
                    These Terms are governed by the laws of the State of Delaware, USA.
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