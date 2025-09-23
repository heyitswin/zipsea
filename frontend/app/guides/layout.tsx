import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Zipsea Cruise Guides',
    default: 'Cruise Port Guides | Zipsea',
  },
  description: 'Expert cruise port guides to help you make the most of every destination. Detailed information on beaches, attractions, dining, and transportation.',
  alternates: {
    canonical: 'https://www.zipsea.com/guides',
  },
};

export default function GuidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
