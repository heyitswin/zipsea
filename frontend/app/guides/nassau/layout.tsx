import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nassau Cruise Port Guide 2025: Complete Bahamas Day Pass | Zipsea',
  description: 'Complete Nassau cruise port guide with transportation tips, beach recommendations, Atlantis day passes, dining spots, and time management for your perfect Bahamas port day. Updated for 2025.',
  keywords: 'Nassau cruise port, Bahamas cruise guide, Prince George Wharf, Atlantis day pass, Nassau beaches, Paradise Island, Cable Beach, Junkanoo Beach, Nassau shore excursions, Fish Fry Nassau, Straw Market, Nassau cruise terminal, Blue Lagoon Island, Nassau taxi rates, jitney buses Nassau, Queen\'s Staircase, Nassau cruise tips',
  alternates: {
    canonical: 'https://www.zipsea.com/guides/nassau',
  },
  openGraph: {
    title: 'Nassau Cruise Port Guide: Your Complete Bahamas Day Pass',
    description: 'Everything you need to know for your Nassau cruise stop - beaches, Atlantis, dining, shopping, and transportation. Make the most of your Bahamas port day.',
    url: 'https://www.zipsea.com/guides/nassau',
    type: 'article',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1580541832626-2a7131ee809f?auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Nassau cruise port with ships docked'
      }
    ],
    locale: 'en_US',
    siteName: 'Zipsea',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nassau Cruise Port Guide 2025 | Zipsea',
    description: 'Complete guide to Nassau for cruise passengers - beaches, attractions, dining, and insider tips.',
    images: ['https://images.unsplash.com/photo-1580541832626-2a7131ee809f?auto=format&fit=crop&w=1200&q=80'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  authors: [{ name: 'Zipsea Travel Experts' }],
  publisher: 'Zipsea',
};

export default function NassauGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
