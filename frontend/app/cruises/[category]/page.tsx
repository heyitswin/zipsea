import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/cruise-categories";
import CategoryCruisesContent from "./CategoryCruisesContent";

export default function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const category = getCategoryBySlug(params.category);

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
