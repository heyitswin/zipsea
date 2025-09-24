import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Zipsea",
  description: "Read Zipsea's terms of service. We help you find the best cruise deals with maximum onboard credit.",
  openGraph: {
    title: "Terms of Service | Zipsea",
    description: "Read Zipsea's terms of service. We help you find the best cruise deals with maximum onboard credit.",
    type: "website",
    url: "https://www.zipsea.com/terms",
    siteName: "Zipsea",
    images: [
      {
        url: "https://www.zipsea.com/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zipsea - Maximum Onboard Credit for Your Cruise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | Zipsea",
    description: "Read Zipsea's terms of service. We help you find the best cruise deals with maximum onboard credit.",
    images: ["https://www.zipsea.com/images/og-image.png"],
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
