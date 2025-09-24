import { MetadataRoute } from "next";
import { getCategorySitemapEntries } from "../lib/cruise-categories";

export default function sitemap(): MetadataRoute.Sitemap {
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

  // TODO: Add dynamic cruise pages here by fetching from API
  // const cruisePages = await fetchCruisePages();

  return [...staticPages, ...guidePages, ...categoryPages];
}
