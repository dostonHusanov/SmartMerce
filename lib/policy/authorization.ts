import { randomUUID } from "crypto";
import { getProductById } from "@/lib/commerce/products";
import { evaluateSpendingPolicy } from "@/lib/policy/spending-policy";
import type { PurchaseAuthorization } from "@/types";

export function createAuthorization(input: {
  productId: string;
  exactAmount: number;
  merchantId: string;
  now?: Date;
}): PurchaseAuthorization {
  const policy = evaluateSpendingPolicy({
    productId: input.productId,
    amount: input.exactAmount,
    merchantId: input.merchantId,
  });

  if (!policy.allowed) {
    throw new Error("Authorization cannot be created because spending policy failed.");
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  return {
    id: randomUUID(),
    productId: input.productId,
    exactAmount: input.exactAmount,
    merchantId: input.merchantId,
    network: "avalanche-mainnet",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: randomUUID().replace(/-/g, "").slice(0, 16),
    status: "authorized",
  };
}

export function validateAuthorization(
  authorization: PurchaseAuthorization,
  input: {
    productId: string;
    exactAmount: number;
    merchantId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const product = getProductById(input.productId);
  const checks = [
    {
      id: "not_expired",
      passed: new Date(authorization.expiresAt).getTime() > now.getTime(),
      reason: "Authorization must not be expired.",
    },
    {
      id: "product_match",
      passed: authorization.productId === input.productId,
      reason: "Authorization is scoped to the exact product.",
    },
    {
      id: "amount_match",
      passed: Math.abs(authorization.exactAmount - input.exactAmount) < 0.001,
      reason: "Authorization is scoped to the exact amount.",
    },
    {
      id: "merchant_match",
      passed: authorization.merchantId === input.merchantId,
      reason: "Authorization is scoped to the exact merchant.",
    },
    {
      id: "server_price_match",
      passed: Boolean(product) && Math.abs((product?.priceXsgd ?? 0) - input.exactAmount) < 0.001,
      reason: "Current server price must still match.",
    },
  ];

  return {
    valid: authorization.status === "authorized" && checks.every((check) => check.passed),
    checks,
  };
}
