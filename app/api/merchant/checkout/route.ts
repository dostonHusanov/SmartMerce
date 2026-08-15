import { NextResponse } from "next/server";
import { z } from "zod";
import { createVerifiedOrder, getAuthorizationById, saveAuthorization, updateOrderFulfillment } from "@/lib/merchant/orders";
import { getProductById } from "@/lib/commerce/products";
import { getConfiguredMerchantWallet, verifyXsgdTransferReceipt } from "@/lib/blockchain/xsgd";
import { createRealWorldFulfillment } from "@/lib/fulfillment/shopify";

const deliveryInfoSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  address1: z.string().min(3),
  city: z.string().min(2),
  province: z.string().optional(),
  country: z.string().min(2),
  zip: z.string().min(2),
});

const checkoutRequestSchema = z.object({
  productId: z.string().min(1),
  authorizationId: z.string().min(1),
  buyerWallet: z.string().min(1),
  paymentMethod: z.enum(["direct-xsgd", "straitsx-card"]),
  transactionHash: z.custom<`0x${string}`>((value) => typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value)).optional(),
  cardReference: z.string().min(1).optional(),
  delivery: deliveryInfoSchema.optional(),
  authorizationSnapshot: z.object({
    id: z.string().min(1),
    productId: z.string().min(1),
    exactAmount: z.number().positive(),
    merchantId: z.string().min(1),
    network: z.literal("avalanche-mainnet"),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    nonce: z.string().min(1),
    status: z.literal("authorized"),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = checkoutRequestSchema.parse(await request.json());
    if (
      parsed.paymentMethod === "straitsx-card" &&
      parsed.authorizationSnapshot?.id === parsed.authorizationId &&
      !getAuthorizationById(parsed.authorizationId)
    ) {
      saveAuthorization(parsed.authorizationSnapshot);
    }
    const product = getProductById(parsed.productId);
    if (!product) throw new Error("Product not found.");

    if (parsed.paymentMethod === "direct-xsgd") {
      if (!parsed.transactionHash) throw new Error("Transaction hash is required for direct XSGD checkout.");
      const merchantWallet = getConfiguredMerchantWallet();
      if (!merchantWallet) throw new Error("Trusted merchant wallet configuration required.");
      const verified = await verifyXsgdTransferReceipt({
        hash: parsed.transactionHash,
        from: parsed.buyerWallet as `0x${string}`,
        to: merchantWallet,
        amountXsgd: product.priceXsgd.toFixed(2),
      });
      if (!verified.confirmed) throw new Error("Transaction reverted.");
      if (!verified.matchedTransfer) throw new Error("XSGD transfer proof did not match the authorized buyer, merchant, token and amount.");
    }
    const order = createVerifiedOrder(parsed);
    let fulfilledOrder = order;

    try {
      const fulfillment = await createRealWorldFulfillment({
        order,
        product,
        delivery: parsed.delivery,
      });
      fulfilledOrder = updateOrderFulfillment(order.id, {
        fulfillmentProvider: fulfillment.provider,
        fulfillmentStatus: fulfillment.status,
        fulfillmentReference: fulfillment.reference,
        fulfillmentUrl: fulfillment.url,
        fulfillmentError: fulfillment.error,
      });
    } catch (fulfillmentError) {
      fulfilledOrder = updateOrderFulfillment(order.id, {
        fulfillmentProvider: "shopify",
        fulfillmentStatus: "failed",
        fulfillmentError: fulfillmentError instanceof Error ? fulfillmentError.message : "Fulfillment failed.",
      });
    }

    return NextResponse.json({ order: fulfilledOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
