import { NextResponse } from "next/server";
import { productCategorySchema } from "@/lib/ai/schemas";
import { listProducts, searchCatalogue } from "@/lib/commerce/products";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category") ?? undefined;
  const category = categoryParam ? productCategorySchema.safeParse(categoryParam) : undefined;
  const maxPriceParam = searchParams.get("maxPrice");

  const hasFilters = searchParams.has("q")
    || searchParams.has("category")
    || searchParams.has("maxPrice")
    || searchParams.has("sort")
    || searchParams.has("includeOutOfStock");
  const products = hasFilters
    ? searchCatalogue({
        q: searchParams.get("q") ?? undefined,
        category: category?.success ? category.data : undefined,
        maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
        sort: searchParams.get("sort") ?? undefined,
        includeOutOfStock: searchParams.get("includeOutOfStock") === "true",
      })
    : listProducts();

  return NextResponse.json({ products });
}
