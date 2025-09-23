import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQs - Zipsea Cruise Booking',
  description: 'Frequently asked questions about booking cruises with Zipsea. Learn about onboard credit, pricing, cancellations, and how we help you save on every cruise.',
  alternates: {
    canonical: 'https://www.zipsea.com/faqs',
  },
  openGraph: {
    title: 'FAQs - Zipsea Cruise Booking',
    description: 'Get answers to common questions about booking cruises with Zipsea and maximizing your onboard credit.',
    url: 'https://www.zipsea.com/faqs',
  },
};

export default function FAQsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
