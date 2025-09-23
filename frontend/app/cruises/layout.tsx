import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Cruises - Find Your Perfect Cruise Deal | Zipsea',
  description: 'Search and compare thousands of cruise deals. Filter by cruise line, destination, departure date, and price. Get maximum onboard credit on every booking.',
  alternates: {
    canonical: 'https://www.zipsea.com/cruises',
  },
  openGraph: {
    title: 'Browse Cruises - Find Your Perfect Cruise Deal',
    description: 'Search thousands of cruises and get the best deals with maximum onboard credit.',
    url: 'https://www.zipsea.com/cruises',
  },
};

export default function CruisesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
