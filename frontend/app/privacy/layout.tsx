import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Zipsea',
  description: 'Learn how Zipsea protects your privacy and handles your personal information when booking cruises.',
  alternates: {
    canonical: 'https://www.zipsea.com/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Privacy Policy - Zipsea',
    description: 'Our commitment to protecting your privacy and personal information.',
    url: 'https://www.zipsea.com/privacy',
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
