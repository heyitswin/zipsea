import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why Zipsea - Maximum Onboard Credit on Every Cruise',
  description: 'Learn why Zipsea gives you more onboard credit than other travel agents. We pass back the maximum commission allowed as onboard credit on every booking.',
  alternates: {
    canonical: 'https://www.zipsea.com/why-zipsea',
  },
  openGraph: {
    title: 'Why Zipsea - Maximum Onboard Credit on Every Cruise',
    description: 'Discover how Zipsea gives you more money to spend onboard by passing back agent commissions as onboard credit.',
    url: 'https://www.zipsea.com/why-zipsea',
  },
};

export default function WhyZipseaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
