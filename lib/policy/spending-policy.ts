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
    check("positive_amount", "Positive amount", input.amount > 0, "Amount must be greater than 0 XSGD."),
    check(
      "transaction_limit",
      `Within ${defaultSpendingPolicy.maxTransactionXsgd} XSGD transaction limit`,
      input.amount <= defaultSpendingPolicy.maxTransactionXsgd,
      `${input.amount.toFixed(2)} XSGD requested against a ${defaultSpendingPolicy.maxTransactionXsgd} XSGD limit.`,
    ),
    check(
      "daily_limit",
      "Daily budget available",
      dailySpend + input.amount <= defaultSpendingPolicy.dailyLimitXsgd,
      `${(dailySpend + input.amount).toFixed(2)} XSGD projected daily spend against ${defaultSpendingPolicy.dailyLimitXsgd} XSGD.`,
    ),
    check(
      "merchant_allowlist",
      "Trusted merchant",
      defaultSpendingPolicy.allowedMerchantIds.includes(input.merchantId),
      `${input.merchantId} must be in the trusted merchant allowlist.`,
    ),
    check("product_exists", "Product exists", Boolean(product), "Product must exist in the trusted catalogue."),
    check("in_stock", "Product available", Boolean(product?.inStock), "Product must be in stock."),
    check(
      "price_verified",
      "Price verified",
      serverPrice !== undefined && Math.abs(serverPrice - input.amount) < 0.001,
      "Requested amount must match the server-side catalogue price.",
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
