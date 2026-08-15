import type { Product, RankedProduct, ShoppingIntent } from "@/types";

function shippingScore(shipping: string) {
  if (/same/i.test(shipping)) return 1;
  if (/tomorrow/i.test(shipping)) return 0.75;
  return 0.45;
}

export function rankProducts(products: Product[], intent: ShoppingIntent): RankedProduct[] {
  const budget = intent.maxBudgetXsgd;
  const values = products.map((product) => {
    const priceFit = budget ? Math.max(0, (budget - product.priceXsgd) / budget) : 0.5;
    const ratingScore = product.rating / 5;
    const reviewScore = Math.min(1, Math.log10(product.reviewCount + 1) / 3.2);
    const valueScore = product.rating / product.priceXsgd / 2;
    const speedScore = shippingScore(product.shippingEstimate);
    const prefersValue = intent.preferences.some((preference) => /value|cheap|price/i.test(preference));
    const prefersRating = intent.preferences.some((preference) => /rating|quality|best/i.test(preference));

    let score =
      ratingScore * (prefersRating ? 32 : 24) +
      reviewScore * 18 +
      valueScore * (prefersValue ? 34 : 24) +
      priceFit * 16 +
      speedScore * 10;

    if (intent.sortPreference === "value") score += valueScore * 18;
    if (!product.inStock) score -= 100;

    const reasons = [
      `${product.rating.toFixed(1)} rating across ${product.reviewCount} reviews`,
      `${product.priceXsgd.toFixed(2)} XSGD fits the requested spend profile`,
      `${product.shippingEstimate} shipping from ${product.merchant}`,
    ];

    return { ...product, score: Number(score.toFixed(2)), reasons };
  });

  return values.sort((a, b) => b.score - a.score);
}

export function recommendationExplanation(product: RankedProduct, intent: ShoppingIntent) {
  const budgetText = intent.maxBudgetXsgd
    ? ` within your ${intent.maxBudgetXsgd.toFixed(0)} XSGD budget`
    : "";
  return `${product.name} has the strongest balance of price, rating and review confidence${budgetText}. It costs ${product.priceXsgd.toFixed(2)} XSGD, is in stock, and ships ${product.shippingEstimate.toLowerCase()}.`;
}
