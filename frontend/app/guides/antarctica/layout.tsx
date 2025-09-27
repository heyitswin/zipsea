import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Antarctica Cruise Guide - The Ultimate Expedition to the Seventh Continent | Zipsea",
  description:
    "Antarctica expedition cruise guide: Drake Passage crossing, Zodiac landings, wildlife encounters, adventure activities, weather conditions, and essential tips for your journey to the Seventh Continent.",
  keywords:
    "Antarctica cruise, Antarctic expedition, Drake Passage, Zodiac landings, Antarctic Peninsula, South Shetland Islands, penguin colonies, whale watching, polar snorkeling, Antarctic camping, Ushuaia departure, expedition parka, IAATO guidelines, Antarctic wildlife",
  openGraph: {
    title:
      "Antarctica Cruise Guide - The Ultimate Expedition to the Seventh Continent",
    description:
      "Complete guide to Antarctic expeditions: Drake Passage, wildlife encounters, adventure activities, and essential tips for the journey of a lifetime.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=2000&q=80",
        width: 1200,
        height: 630,
        alt: "Antarctic expedition cruise ship among icebergs",
      },
    ],
    type: "article",
    siteName: "Zipsea",
  },
  twitter: {
    card: "summary_large_image",
    title: "Antarctica Cruise Guide - Complete Expedition Guide",
    description:
      "Plan your Antarctic expedition with our comprehensive guide covering everything from Drake Passage to penguin encounters.",
    images: [
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=2000&q=80",
    ],
  },
  alternates: {
    canonical: "https://www.zipsea.com/guides/antarctica",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function AntarcticaGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
