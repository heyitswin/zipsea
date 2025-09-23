import { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/cruise-categories";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getCategoryBySlug(categorySlug);

  if (!category) {
    return {
      title: "Category Not Found | Zipsea",
      description: "The requested cruise category could not be found.",
    };
  }

  const baseUrl = "https://www.zipsea.com";
  const canonicalUrl = `${baseUrl}/cruises/${category.slug}`;

  return {
    title: category.metaTitle,
    description: category.metaDescription,
    keywords: category.keywords?.join(", "),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: category.metaTitle,
      description: category.metaDescription,
      url: canonicalUrl,
      type: "website",
      siteName: "Zipsea",
      images: [
        {
          url: `${baseUrl}/images/og-cruise-deals.jpg`,
          width: 1200,
          height: 630,
          alt: category.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: category.metaTitle,
      description: category.metaDescription,
      images: [`${baseUrl}/images/og-cruise-deals.jpg`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

// Generate static params for known categories at build time
export async function generateStaticParams() {
  const { allCategories } = await import("@/lib/cruise-categories");

  return allCategories.map((category) => ({
    category: category.slug,
  }));
}

export default function CategoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
