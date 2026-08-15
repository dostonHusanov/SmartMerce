import { discoverInternetProducts, isInternetDiscoveryConfigured } from "@/lib/commerce/web-discovery";
import { searchCatalogue, getProductById, upsertDiscoveredProducts } from "@/lib/commerce/products";
import { rankProducts, recommendationExplanation } from "@/lib/commerce/ranking";
import { evaluateSpendingPolicy } from "@/lib/policy/spending-policy";
import { createAuthorization } from "@/lib/policy/authorization";
import type { Product, ShoppingIntent } from "@/types";

export async function searchProducts(intent: ShoppingIntent) {
  const internetProducts = await discoverInternetProducts(intent);
  if (isInternetDiscoveryConfigured()) {
    return upsertDiscoveredProducts(internetProducts);
  }

  return searchCatalogue({
    q: intent.query,
    category: intent.category,
    maxPrice: intent.maxBudgetXsgd,
    sort: intent.sortPreference,
  });
}

export function compareProducts(intent: ShoppingIntent, productIds?: string[]) {
  const candidates = productIds
    ? productIds.map((id) => getProductById(id)).filter((product): product is Product => Boolean(product))
    : searchCatalogue({
        q: intent.query,
        category: intent.category,
        maxPrice: intent.maxBudgetXsgd,
        sort: intent.sortPreference,
      });
  return rankProducts(candidates, intent).slice(0, 3);
}

export function checkSpendingPolicy(input: {
  productId: string;
  amount: number;
  merchantId: string;
  intent: ShoppingIntent;
  dailySpendXsgd?: number;
}) {
  return evaluateSpendingPolicy(input);
}

export function preparePurchase(input: {
  productId: string;
  exactAmount: number;
  merchantId: string;
}) {
  return createAuthorization(input);
}

export { recommendationExplanation };
