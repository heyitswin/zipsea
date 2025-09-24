import { Metadata } from "next";

export const metadata: Metadata = {
  title: "First Time Cruisers Guide - Everything You Need to Know | Zipsea",
  description:
    "First-time cruiser guide: choosing cruises, packing tips, onboard activities, dining. Everything you need for your first cruise.",
  alternates: {
    canonical: "https://www.zipsea.com/first-time-cruisers-guide",
  },
  openGraph: {
    title: "First Time Cruisers Guide - Everything You Need to Know",
    description:
      "Your complete guide to cruising for beginners. Tips, advice, and everything you need for your first cruise.",
    url: "https://www.zipsea.com/first-time-cruisers-guide",
  },
};

export default function FirstTimeCruisersGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
