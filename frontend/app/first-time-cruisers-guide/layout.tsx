import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'First Time Cruisers Guide - Everything You Need to Know | Zipsea',
  description: 'Complete guide for first-time cruisers. Learn about choosing the right cruise, what to pack, onboard activities, dining, and tips for making the most of your cruise vacation.',
  alternates: {
    canonical: 'https://www.zipsea.com/first-time-cruisers-guide',
  },
  openGraph: {
    title: 'First Time Cruisers Guide - Everything You Need to Know',
    description: 'Your complete guide to cruising for beginners. Tips, advice, and everything you need for your first cruise.',
    url: 'https://www.zipsea.com/first-time-cruisers-guide',
  },
};

export default function FirstTimeCruisersGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
