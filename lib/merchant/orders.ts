import { randomUUID } from "crypto";
import { getAddress, isAddress } from "viem";
import { getProductById, reserveProductInventory } from "@/lib/commerce/products";
import { getConfiguredMerchantWallet } from "@/lib/blockchain/xsgd";
import { validateAuthorization } from "@/lib/policy/authorization";
import { evaluateSpendingPolicy } from "@/lib/policy/spending-policy";
import type { Order, PurchaseAuthorization } from "@/types";

type SmartMerceStore = {
  authorizations: Map<string, PurchaseAuthorization>;
  orders: Map<string, Order>;
};

const globalStore = globalThis as typeof globalThis & {
  __smartmerceStore?: SmartMerceStore;
};

const store = globalStore.__smartmerceStore ??= {
  authorizations: new Map<string, PurchaseAuthorization>(),
  orders: new Map<string, Order>(),
};

const { authorizations, orders } = store;

export function saveAuthorization(authorization: PurchaseAuthorization) {
  authorizations.set(authorization.id, authorization);
  return authorization;
}

export function getAuthorizationById(id: string) {
  return authorizations.get(id);
}

export function listAuthorizations() {
  return [...authorizations.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listOrders() {
  return [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createVerifiedOrder(input: {
  productId: string;
  authorizationId: string;
  buyerWallet: string;
  paymentMethod: "direct-xsgd" | "straitsx-card";
  transactionHash?: `0x${string}`;
  cardReference?: string;
  status?: Order["status"];
}) {
  const product = getProductById(input.productId);
  if (!product) throw new Error("Product not found.");

  const authorization = getAuthorizationById(input.authorizationId);
  if (!authorization) throw new Error("Authorization not found or expired.");

  const authorizationCheck = validateAuthorization(authorization, {
    productId: product.id,
    exactAmount: product.priceXsgd,
    merchantId: product.merchantId,
  });
  if (!authorizationCheck.valid) throw new Error("Authorization is not valid for this product, amount and merchant.");

  const policy = evaluateSpendingPolicy({
    productId: product.id,
    amount: product.priceXsgd,
    merchantId: product.merchantId,
  });
  if (!policy.allowed) throw new Error("Spending policy rejected checkout.");

  const merchantWallet = getConfiguredMerchantWallet();
  if (input.paymentMethod === "direct-xsgd" && !merchantWallet) {
    throw new Error("Trusted merchant wallet configuration required.");
  }

  if (!isAddress(input.buyerWallet)) {
    throw new Error("Buyer wallet must be a valid EVM address.");
  }

  const reservedProduct = reserveProductInventory(product.id);
  const order: Order = {
    id: `ord_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    productId: reservedProduct.id,
    productName: reservedProduct.name,
    merchant: reservedProduct.merchant,
    buyerWallet: getAddress(input.buyerWallet),
    amountXsgd: reservedProduct.priceXsgd,
    paymentMethod: input.paymentMethod,
    transactionHash: input.transactionHash,
    cardReference: input.cardReference,
    status: input.status ?? "confirmed",
    createdAt: new Date().toISOString(),
  };

  orders.set(order.id, order);
  authorizations.delete(input.authorizationId);
  return order;
}

export function updateOrderFulfillment(id: string, input: Pick<Order,
  "fulfillmentProvider" |
  "fulfillmentStatus" |
  "fulfillmentReference" |
  "fulfillmentUrl" |
  "fulfillmentError"
>) {
  const order = orders.get(id);
  if (!order) throw new Error("Order not found.");

  const updated = {
    ...order,
    ...input,
  };
  orders.set(id, updated);
  return updated;
}
