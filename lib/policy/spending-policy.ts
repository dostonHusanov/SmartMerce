import { getProductById, trustedMerchantIds } from "@/lib/commerce/products";
import type { PolicyCheck, PolicyResult, ShoppingIntent } from "@/types";

function numberFromEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const defaultSpendingPolicy = {
  maxTransactionXsgd: numberFromEnv("NEXT_PUBLIC_MAX_TRANSACTION_XSGD", 60),
  dailyLimitXsgd: numberFromEnv("NEXT_PUBLIC_DAILY_LIMIT_XSGD", 100),
  requireUserApproval: true,
  allowedMerchantIds: trustedMerchantIds,
};

function check(id: string, label: string, passed: boolean, reason: string): PolicyCheck {
  return { id, label, passed, reason };
}

export function evaluateSpendingPolicy(input: {
  productId: string;
  amount: number;
  merchantId: string;
  intent?: ShoppingIntent;
  dailySpendXsgd?: number;
  serverPriceOverride?: number;
}): PolicyResult {
  const product = getProductById(input.productId);
  const serverPrice = input.serverPriceOverride ?? product?.priceXsgd;
  const dailySpend = input.dailySpendXsgd ?? 0;

  const checks: PolicyCheck[] = [
    check("positive_amount", "Real price", input.amount > 0, "The item must have a valid XSGD price."),
    check(
      "transaction_limit",
      "Within your limit",
      input.amount <= defaultSpendingPolicy.maxTransactionXsgd,
      `${input.amount.toFixed(2)} XSGD is checked against your ${defaultSpendingPolicy.maxTransactionXsgd} XSGD limit.`,
    ),
    check(
      "daily_limit",
      "Daily budget available",
      dailySpend + input.amount <= defaultSpendingPolicy.dailyLimitXsgd,
      `Today total would be ${(dailySpend + input.amount).toFixed(2)} XSGD out of ${defaultSpendingPolicy.dailyLimitXsgd} XSGD.`,
    ),
    check(
      "merchant_allowlist",
      "Store is trusted",
      defaultSpendingPolicy.allowedMerchantIds.includes(input.merchantId),
      "The store must be approved before payment.",
    ),
    check("product_exists", "Item is available", Boolean(product), "The item must be available for checkout."),
    check("in_stock", "In stock", Boolean(product?.inStock), "The item must be in stock."),
    check(
      "price_verified",
      "Price confirmed",
      serverPrice !== undefined && Math.abs(serverPrice - input.amount) < 0.001,
      "The payment amount must match the verified item price.",
    ),
    check(
      "requested_budget",
      "Within requested budget",
      input.intent?.maxBudgetXsgd === undefined || input.amount <= input.intent.maxBudgetXsgd,
      input.intent?.maxBudgetXsgd
        ? `${input.amount.toFixed(2)} XSGD must be within ${input.intent.maxBudgetXsgd.toFixed(2)} XSGD.`
        : "No shopper budget was supplied.",
    ),
  ];

  return {
    allowed: checks.every((item) => item.passed),
    checks,
  };
}
