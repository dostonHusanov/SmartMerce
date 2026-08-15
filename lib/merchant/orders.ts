import { randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

type PersistedSmartMerceStore = {
  authorizations: PurchaseAuthorization[];
  orders: Order[];
};

const globalStore = globalThis as typeof globalThis & {
  __smartmerceStore?: SmartMerceStore;
};

const persistenceDisabled = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const stateDirectory = process.env.NODE_ENV === "development"
  ? join(process.cwd(), ".smartmerce")
  : join(tmpdir(), "smartmerce");
const stateFile = join(stateDirectory, "orders.json");

function createEmptyStore(): SmartMerceStore {
  return {
    authorizations: new Map<string, PurchaseAuthorization>(),
    orders: new Map<string, Order>(),
  };
}

function loadPersistedStore(): SmartMerceStore {
  if (persistenceDisabled) return createEmptyStore();

  try {
    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as Partial<PersistedSmartMerceStore>;
    return {
      authorizations: new Map((parsed.authorizations ?? []).map((authorization) => [authorization.id, authorization])),
      orders: new Map((parsed.orders ?? []).map((order) => [order.id, order])),
    };
  } catch {
    return createEmptyStore();
  }
}

function persistStore() {
  if (persistenceDisabled) return;

  const payload: PersistedSmartMerceStore = {
    authorizations: [...authorizations.values()],
    orders: [...orders.values()],
  };

  try {
    mkdirSync(stateDirectory, { recursive: true });
    writeFileSync(stateFile, JSON.stringify(payload, null, 2));
  } catch {
    // Serverless filesystems may be ephemeral or read-only. Keep the in-memory store alive for this runtime.
  }
}

const store = globalStore.__smartmerceStore ??= loadPersistedStore();

const { authorizations, orders } = store;

export function saveAuthorization(authorization: PurchaseAuthorization) {
  authorizations.set(authorization.id, authorization);
  persistStore();
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
  persistStore();
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
  persistStore();
  return updated;
}
