import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/cruise-categories";
import CategoryCruisesContent from "./CategoryCruisesContent";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const category = getCategoryBySlug(categorySlug);

  if (!category) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          Loading {category.name} cruises...
        </div>
      }
    >
      <CategoryCruisesContent category={category} />
    </Suspense>
  );
}
