'use client';
import Image from "next/image";
import { useState } from "react";

interface FAQ {
  id: number;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: 1,
    question: "What is onboard credit (OBC)?",
    answer: "Onboard credit is ship money you can use during your cruise—like having a prepaid gift card. You can spend it on drinks, specialty dining, Wi-Fi, spa treatments, excursions, or even onboard shopping."
  },
  {
    id: 2,
    question: "How does Zipsea give me more onboard credit than others?",
    answer: "Travel agents earn commission from every booking. Most keep it. We don't. We pass back the maximum onboard credit allowed by the cruise lines every single time."
  },
  {
    id: 3,
    question: "Is this too good to be true?",
    answer: "Nope. Cruise lines set caps on how much OBC can be given. We simply give you that maximum—while other agents usually pocket it as extra commission."
  },
  {
    id: 4,
    question: "How much onboard credit will I actually get?",
    answer: "It depends on your cruise fare and the cruise line's rules. As a ballpark: shorter cruises usually allow $50–$100, longer cruises $150–$500+. When you search a cruise, we'll show you exactly how much."
  },
  {
    id: 5,
    question: "Does onboard credit expire?",
    answer: "Yes, it's only valid for the duration of your sailing. Use it onboard for drinks, dining, spa, excursions, or shopping. It disappears when your cruise ends."
  },
  {
    id: 6,
    question: "What if I cancel my cruise?",
    answer: "Your onboard credit is tied to your booking. If you cancel, the OBC is canceled too. Refunds follow the cruise line's cancellation policy."
  },
  {
    id: 7,
    question: "Can I combine Zipsea's onboard credit with cruise line promotions?",
    answer: "Yes. Our OBC stacks with cruise line sales, loyalty perks, or group offers. The only limit is the cruise line's cap."
  },
  {
    id: 8,
    question: "Do I pay more to book with Zipsea?",
    answer: "No. You pay the same published fare you'd see on the cruise line's website—except we give you back the max OBC."
  },
  {
    id: 9,
    question: "How do I use my onboard credit once onboard?",
    answer: "It's automatically applied to your onboard account. You'll see it on your ship card or app as a credit balance. Just swipe and it deducts."
  },
  {
    id: 10,
    question: "Who is Zipsea? Are you real travel agents?",
    answer: "Yes! We're licensed, accredited travel agents. We just run things lean and tech-driven so we can give you back more of the commission."
  },
  {
    id: 11,
    question: "Can I book online, or do I need to call?",
    answer: "Right now you can search and request a quote online, then we finalize the booking for you. Soon, you'll be able to book directly through our site."
  },
  {
    id: 12,
    question: "What kinds of cruises can I book with Zipsea?",
    answer: "We support all the major ocean cruise lines—and we're expanding to river and expedition cruises soon."
  },
  {
    id: 13,
    question: "What happens after I book?",
    answer: "You'll get a confirmation from both the cruise line and from us. Your onboard credit will appear on your account when you board."
  },
  {
    id: 14,
    question: "Is my money safe if I book through Zipsea?",
    answer: "Absolutely. All payments go directly to the cruise line. We never hold your funds—we just facilitate the booking and perks."
  },
  {
    id: 15,
    question: "Why should I book with Zipsea instead of directly with the cruise line?",
    answer: "Because you'll get the same cabin, same price, same cruise—but more money to spend onboard. It's that simple."
  }
];

export default function FAQs() {
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  const toggleAccordion = (id: number) => {
    setOpenAccordion(openAccordion === id ? null : id);
  };

  return (
    <>

      {/* Hero Section */}
      <section className="relative pt-[100px] pb-[80px]" style={{ backgroundColor: '#0E1B4D' }}>
        <div className="max-w-4xl mx-auto px-8 text-center">
          {/* Title */}
          <h1 
            className="font-whitney font-black uppercase"
            style={{
              color: '#F7F170',
              fontSize: '72px',
              letterSpacing: '-0.02em'
            }}
          >
            FAQs
          </h1>
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
        {/* FAQ Section */}
        <section className="px-8">
          <div className="max-w-4xl mx-auto">

            {/* FAQ Accordion */}
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div 
                  key={faq.id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
                >
                  {/* Question Button */}
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 
                      className="font-geograph font-medium pr-8"
                      style={{
                        fontSize: '20px',
                        color: '#0E1B4D',
                        letterSpacing: '-0.02em',
                        lineHeight: '1.3'
                      }}
                    >
                      {faq.question}
                    </h3>
                    <div 
                      className={`w-6 h-6 flex items-center justify-center transition-transform duration-300 ${
                        openAccordion === faq.id ? 'rotate-180' : ''
                      }`}
                    >
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none"
                        className="text-dark-blue"
                      >
                        <path 
                          d="M6 9L12 15L18 9" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Answer Panel */}
                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      openAccordion === faq.id 
                        ? 'max-h-96 opacity-100' 
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-8 pb-6 pt-2">
                      <p 
                        className="font-geograph"
                        style={{
                          fontSize: '18px',
                          color: '#0E1B4D',
                          letterSpacing: '-0.02em',
                          lineHeight: '1.6'
                        }}
                      >
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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