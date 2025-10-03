import { MetadataRoute } from "next";
import { getCategorySitemapEntries } from "../lib/cruise-categories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.zipsea.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/cruises`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/top-destinations`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/cruise-lines`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/departure-ports`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/special-cruises`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/why-zipsea`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faqs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/first-time-cruisers-guide`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/onboard-credit-calculator`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },

    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Port guides
  const guidePages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/guides/nassau`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/guides/cozumel`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Cruise category pages (Caribbean, Alaska, Royal Caribbean, etc.)
  const categoryPages = getCategorySitemapEntries().map((entry) => ({
    ...entry,
    url: `${baseUrl}${entry.url}`,
  }));

  // Fetch cruise pages from API
  let cruisePages: MetadataRoute.Sitemap = [];
  try {
    // Fetch cruises departing in next 90 days for sitemap
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.zipsea.com";
    const response = await fetch(
      `${apiUrl}/api/v1/search?limit=5000&minDate=${new Date().toISOString().split("T")[0]}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    );

    if (response.ok) {
      const data = await response.json();
      const cruises = data.cruises || [];

      cruisePages = cruises.map((cruise: any) => ({
        url: `${baseUrl}/cruise/${cruise.slug}`,
        lastModified: cruise.updatedAt
          ? new Date(cruise.updatedAt)
          : new Date(),
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));

      console.log(`[Sitemap] Added ${cruisePages.length} cruise pages`);
    }
  } catch (error) {
    console.error("[Sitemap] Failed to fetch cruise pages:", error);
  }

  return [...staticPages, ...guidePages, ...categoryPages, ...cruisePages];
}
