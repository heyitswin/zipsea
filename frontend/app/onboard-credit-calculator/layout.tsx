import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboard Credit Calculator - Plan Your Cruise Spending | Zipsea",
  description:
    "Calculate how to spend your onboard credit wisely. Plan your cruise budget for dining, spa, excursions, and beverages across major lines.",
  alternates: {
    canonical: "https://www.zipsea.com/onboard-credit-calculator",
  },
  openGraph: {
    title: "Onboard Credit Calculator - Plan Your Cruise Spending",
    description:
      "Free tool to help you plan how to use your onboard credit for maximum value on your cruise.",
    url: "https://www.zipsea.com/onboard-credit-calculator",
  },
};

export default function OnboardCreditCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
