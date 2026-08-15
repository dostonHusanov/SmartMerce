import type { DeliveryInfo, Order, Product } from "@/types";

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type FulfillmentResult = {
  provider?: "shopify";
  status: "not_configured" | "created" | "failed";
  reference?: string;
  url?: string;
  error?: string;
};

function getShopifyConfig() {
  const provider = process.env.FULFILLMENT_PROVIDER?.trim() || process.env.NEXT_PUBLIC_FULFILLMENT_PROVIDER?.trim();
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2026-07";
  const variantMapRaw = process.env.SHOPIFY_PRODUCT_VARIANT_MAP?.trim();

  if (provider !== "shopify") return undefined;
  if (!shopDomain || !accessToken || !variantMapRaw) return undefined;

  let variantMap: Record<string, string>;
  try {
    variantMap = JSON.parse(variantMapRaw) as Record<string, string>;
  } catch {
    throw new Error("SHOPIFY_PRODUCT_VARIANT_MAP must be valid JSON.");
  }

  return {
    shopDomain: shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    accessToken,
    apiVersion,
    variantMap,
    completeDraftOrder: process.env.SHOPIFY_COMPLETE_DRAFT_ORDER === "true",
  };
}

async function shopifyGraphql<T>(input: {
  query: string;
  variables: Record<string, unknown>;
}) {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify fulfillment is not configured.");

  const response = await fetch(`https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken,
    },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null) as ShopifyGraphqlResponse<T> | null;
  if (!response.ok) throw new Error(`Shopify Admin API failed with HTTP ${response.status}.`);
  if (body?.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  if (!body?.data) throw new Error("Shopify Admin API returned no data.");
  return body.data;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts.slice(0, -1).join(" ") || parts[0],
    lastName: parts.length > 1 ? parts.at(-1) : undefined,
  };
}

function shippingAddress(delivery: DeliveryInfo) {
  const name = splitName(delivery.fullName);
  return {
    ...name,
    address1: delivery.address1,
    city: delivery.city,
    province: delivery.province || undefined,
    country: delivery.country,
    zip: delivery.zip,
  };
}

export function isFulfillmentConfigured() {
  return Boolean(getShopifyConfig());
}

export async function createRealWorldFulfillment(input: {
  order: Order;
  product: Product;
  delivery?: DeliveryInfo;
}): Promise<FulfillmentResult> {
  const config = getShopifyConfig();
  if (!config) return { status: "not_configured" };
  if (!input.delivery) throw new Error("Delivery information is required for Shopify fulfillment.");

  const variantId = config.variantMap[input.product.id];
  if (!variantId) {
    throw new Error(`No Shopify variant mapping configured for ${input.product.id}.`);
  }

  const draftData = await shopifyGraphql<{
    draftOrderCreate: {
      draftOrder?: { id: string; invoiceUrl?: string };
      userErrors: Array<{ message: string; field?: string[] }>;
    };
  }>({
    query: `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            invoiceUrl
          }
          userErrors {
            message
            field
          }
        }
      }
    `,
    variables: {
      input: {
        email: input.delivery.email,
        note: [
          "SmartMerce AI purchase",
          `SmartMerce order: ${input.order.id}`,
          input.order.transactionHash ? `Avalanche tx: ${input.order.transactionHash}` : undefined,
        ].filter(Boolean).join("\n"),
        tags: ["smartmerce", "xsgd", "ai-purchase"],
        shippingAddress: shippingAddress(input.delivery),
        billingAddress: shippingAddress(input.delivery),
        lineItems: [
          {
            variantId,
            quantity: 1,
          },
        ],
      },
    },
  });

  const draftErrors = draftData.draftOrderCreate.userErrors;
  if (draftErrors.length) throw new Error(draftErrors.map((error) => error.message).join("; "));
  const draftOrder = draftData.draftOrderCreate.draftOrder;
  if (!draftOrder?.id) throw new Error("Shopify did not return a draft order.");

  if (!config.completeDraftOrder) {
    return {
      provider: "shopify",
      status: "created",
      reference: draftOrder.id,
      url: draftOrder.invoiceUrl,
    };
  }

  const completeData = await shopifyGraphql<{
    draftOrderComplete: {
      draftOrder?: { id: string; order?: { id: string; name?: string; statusPageUrl?: string } };
      userErrors: Array<{ message: string; field?: string[] }>;
    };
  }>({
    query: `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id, sourceName: "smartmerce") {
          draftOrder {
            id
            order {
              id
              name
              statusPageUrl
            }
          }
          userErrors {
            message
            field
          }
        }
      }
    `,
    variables: {
      id: draftOrder.id,
    },
  });

  const completeErrors = completeData.draftOrderComplete.userErrors;
  if (completeErrors.length) throw new Error(completeErrors.map((error) => error.message).join("; "));
  const completedOrder = completeData.draftOrderComplete.draftOrder?.order;
  if (!completedOrder?.id) throw new Error("Shopify did not return a completed order.");

  return {
    provider: "shopify",
    status: "created",
    reference: completedOrder.name ?? completedOrder.id,
    url: completedOrder.statusPageUrl,
  };
}
