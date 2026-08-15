import { createHash } from "node:crypto";
import type { Product, ProductCategory, ShoppingIntent } from "@/types";

type SerpApiShoppingResult = {
  title?: string;
  source?: string;
  link?: string;
  product_link?: string;
  thumbnail?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
};

type SerpApiShoppingResponse = {
  shopping_results?: SerpApiShoppingResult[];
};

const fallbackImages: Record<ProductCategory, string> = {
  "smart watches": "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=80",
  earbuds: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=80",
  headphones: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  mouse: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=80",
  keyboard: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80",
  "usb-c cables": "https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=900&q=80",
  chargers: "https://images.unsplash.com/photo-1586253634026-8cb574908d1d?auto=format&fit=crop&w=900&q=80",
  "phone accessories": "https://images.unsplash.com/photo-1616410011236-7a42121dd981?auto=format&fit=crop&w=900&q=80",
  "power banks": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80",
  "desk accessories": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
  "fitness gear": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  bags: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
  stationery: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=80",
  "home accessories": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80",
};

function hashId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function normalizePrice(result: SerpApiShoppingResult) {
  if (typeof result.extracted_price === "number" && Number.isFinite(result.extracted_price)) {
    return Number(result.extracted_price.toFixed(2));
  }

  const match = result.price?.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(Number(match[1]).toFixed(2)) : undefined;
}

function searchQuery(intent: ShoppingIntent) {
  const query = intent.query || intent.category || "product";
  const budget = intent.maxBudgetXsgd ? ` under ${intent.maxBudgetXsgd} SGD` : "";
  return `${query}${budget} Singapore buy online`;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

const relevanceStopWords = new Set([
  "and",
  "best",
  "buy",
  "cheap",
  "compare",
  "fast",
  "find",
  "for",
  "good",
  "high",
  "me",
  "online",
  "option",
  "options",
  "rating",
  "reviews",
  "shipping",
  "shop",
  "singapore",
  "sgd",
  "the",
  "under",
  "value",
  "with",
  "xsgd",
]);

function queryTerms(query: string) {
  return normalizeText(query)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !relevanceStopWords.has(term));
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function termVariants(term: string) {
  const variants = [term];

  if (term.endsWith("en") && term.length > 5) variants.push(term.slice(0, -2));
  if (term.endsWith("es") && term.length > 4) variants.push(term.slice(0, -2));
  if (term.endsWith("s") && term.length > 3) variants.push(term.slice(0, -1));

  return variants;
}

function titleIncludesTerm(title: string, term: string) {
  return termVariants(term).some((variant) => title.includes(variant));
}

function resultMatchesIntent(result: SerpApiShoppingResult, intent: ShoppingIntent) {
  const title = normalizeText(result.title ?? "");
  const query = normalizeText(intent.query);

  if (!title || !query) return false;

  if (intent.category === "phone accessories") {
    const wantsCase = query.includes("case") || query.includes("cover");
    const wantsHolder = query.includes("holder") || query.includes("stand");
    const phoneTerms = ["phone", "iphone", "samsung", "galaxy", "pixel", "mobile", "cell"];

    if (wantsCase) return hasAny(title, phoneTerms) && hasAny(title, ["case", "cover"]);
    if (wantsHolder) return hasAny(title, [...phoneTerms, "tablet"]) && hasAny(title, ["holder", "stand", "mount"]);
  }

  const terms = queryTerms(query);
  if (terms.length === 0) return true;

  const matchedTerms = terms.filter((term) => titleIncludesTerm(title, term));
  const requiredMatches = terms.length <= 3 ? terms.length : Math.ceil(terms.length * 0.7);

  return matchedTerms.length >= requiredMatches;
}

function mapResultToProduct(result: SerpApiShoppingResult, intent: ShoppingIntent, index: number): Product | undefined {
  const name = result.title?.trim();
  const priceXsgd = normalizePrice(result);
  const sourceUrl = result.product_link || result.link;

  if (!name || !priceXsgd || priceXsgd <= 0 || !sourceUrl) return undefined;
  if (!resultMatchesIntent(result, intent)) return undefined;
  if (intent.maxBudgetXsgd !== undefined && priceXsgd > intent.maxBudgetXsgd) return undefined;

  const category = intent.category ?? "home accessories";
  const sourceMerchant = result.source?.trim() || new URL(sourceUrl).hostname.replace(/^www\./, "");

  return {
    id: `web-${hashId(`${name}|${sourceUrl}|${priceXsgd}`)}`,
    sku: `WEB-${hashId(sourceUrl).slice(0, 8).toUpperCase()}`,
    name,
    description: `Live product result from ${sourceMerchant}. SmartMerce imported this listing for policy and payment verification.`,
    category,
    merchant: sourceMerchant,
    merchantId: "internet-merchant",
    priceXsgd,
    rating: typeof result.rating === "number" && Number.isFinite(result.rating) ? result.rating : 4.2,
    reviewCount: typeof result.reviews === "number" && Number.isFinite(result.reviews) ? result.reviews : Math.max(25, 120 - index * 17),
    shippingEstimate: "Merchant checkout",
    image: result.thumbnail || fallbackImages[category],
    inStock: true,
    inventory: 1,
    source: "internet",
    sourceUrl,
    sourceMerchant,
  };
}

export async function discoverInternetProducts(intent: ShoppingIntent): Promise<Product[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: searchQuery(intent),
    api_key: apiKey,
    gl: "sg",
    hl: "en",
    google_domain: "google.com.sg",
    num: "10",
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Internet product discovery failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as SerpApiShoppingResponse;
  const products = payload.shopping_results
    ?.map((result, index) => mapResultToProduct(result, intent, index))
    .filter((product): product is Product => Boolean(product)) ?? [];

  return products.slice(0, 6);
}

export function isInternetDiscoveryConfigured() {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}
