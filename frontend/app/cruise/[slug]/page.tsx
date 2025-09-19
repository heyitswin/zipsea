import { Metadata } from "next";
import { getCruiseBySlug } from "../../../lib/api";
import { parseCruiseSlug } from "../../../lib/slug";
import CruiseDetailClient from "./CruiseDetailClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const parsedSlug = parseCruiseSlug(slug);

    if (!parsedSlug) {
      return {
        title: "Cruise Not Found - Zipsea",
        description: "The cruise you're looking for could not be found.",
      };
    }

    // Try to get cruise data
    const comprehensiveData = await getCruiseBySlug(slug);

    if (!comprehensiveData) {
      return {
        title: "Cruise Not Found - Zipsea",
        description: "The cruise you're looking for could not be found.",
      };
    }

    const cruise = comprehensiveData.cruise;
    const ship = comprehensiveData.ship;
    const cruiseLine = comprehensiveData.cruiseLine;

    // Format the title and description
    const title = `${cruise.name} - ${cruise.nights} Night Cruise | Zipsea`;
    const sailDate = new Date(cruise.sailingDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Get the cheapest price for the description
    let priceText = "";
    const pricing = comprehensiveData.cheapestPricing;
    if (pricing) {
      if (pricing.interiorPrice && parseFloat(pricing.interiorPrice) > 0) {
        priceText = `From $${Math.round(parseFloat(pricing.interiorPrice))} - `;
      } else if (
        pricing.oceanviewPrice &&
        parseFloat(pricing.oceanviewPrice) > 0
      ) {
        priceText = `From $${Math.round(parseFloat(pricing.oceanviewPrice))} - `;
      } else if (pricing.balconyPrice && parseFloat(pricing.balconyPrice) > 0) {
        priceText = `From $${Math.round(parseFloat(pricing.balconyPrice))} - `;
      } else if (pricing.suitePrice && parseFloat(pricing.suitePrice) > 0) {
        priceText = `From $${Math.round(parseFloat(pricing.suitePrice))} - `;
      } else if (
        pricing.cheapestPrice &&
        parseFloat(pricing.cheapestPrice) > 0
      ) {
        priceText = `From $${Math.round(parseFloat(pricing.cheapestPrice))} - `;
      }
    }

    const description = `${priceText}${cruise.nights} night ${cruiseLine?.name || ""} cruise departing ${sailDate}. ${ship?.name ? `Sail aboard ${ship.name}.` : ""} Book your dream cruise vacation with Zipsea!`;

    // Try to use the ship image if available
    let ogImage = "/images/opengraph.png"; // Default fallback

    // Use image proxy for ship images to avoid CORS issues
    if (ship?.defaultShipImage) {
      ogImage = `/api/image-proxy?url=${encodeURIComponent(ship.defaultShipImage)}`;
    }

    return {
      title,
      description,
      openGraph: {
        type: "website",
        locale: "en_US",
        url: `https://www.zipsea.com/cruise/${slug}`,
        siteName: "Zipsea",
        title,
        description,
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: `${cruise.name} - ${ship?.name || "Cruise Ship"}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch (error) {
    console.error("Error generating cruise metadata:", error);

    // Return default metadata on error
    return {
      title: "Find Your Perfect Cruise - Zipsea",
      description:
        "Discover amazing cruise deals and book your perfect vacation with Zipsea",
      openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://www.zipsea.com",
        siteName: "Zipsea",
        title: "Find Your Perfect Cruise - Zipsea",
        description:
          "Discover amazing cruise deals and book your perfect vacation with Zipsea",
        images: [
          {
            url: "/images/opengraph.png",
            width: 1200,
            height: 630,
            alt: "Zipsea - Your Gateway to Amazing Cruise Deals",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Find Your Perfect Cruise - Zipsea",
        description:
          "Discover amazing cruise deals and book your perfect vacation with Zipsea",
        images: ["/images/opengraph.png"],
      },
    };
  }
}

export default function CruiseDetailPage({ params }: Props) {
  return <CruiseDetailClient />;
}
