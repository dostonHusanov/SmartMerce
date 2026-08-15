import { describe, expect, it, vi } from "vitest";
import { shoppingIntentSchema } from "@/lib/ai/schemas";
import { parseIntentDeterministically } from "@/lib/ai/provider";
import { getProductById, searchCatalogue } from "@/lib/commerce/products";
import { rankProducts } from "@/lib/commerce/ranking";
import { createAuthorization, validateAuthorization } from "@/lib/policy/authorization";
import { evaluateSpendingPolicy } from "@/lib/policy/spending-policy";
import { getConfiguredMerchantWallet, getConfiguredXsgdContract, officialAvalancheXsgdContract } from "@/lib/blockchain/xsgd";
import { avalancheFujiRpcUrl, avalancheNetworkConfig, avalancheRpcUrl, erc20Abi } from "@/lib/blockchain/avalanche";
import { StraitsXCardProvider } from "@/lib/payments/card-provider";
import { DirectXsgdPaymentProvider } from "@/lib/payments/payment-provider";
import { createVerifiedOrder, getAuthorizationById, saveAuthorization, updateOrderFulfillment } from "@/lib/merchant/orders";
import { isFulfillmentConfigured } from "@/lib/fulfillment/shopify";
import {
  createSignedPaymentPayload,
  decodePaymentRequiredHeader,
  encodePaymentSignature,
  extractFirstUrl,
  getCardApiRetryRequest,
  getCardApiRequestBody,
  getSandboxTypedData,
  normalizeSandboxRequirement,
  prepareSandboxAuthorization,
  trustedStraitsxSandboxRequirement,
  validateCardholderName,
  validateTrustedSandboxRequirement,
} from "@/lib/straitsx/x402-sandbox";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function clearFulfillmentEnv() {
  delete process.env.FULFILLMENT_PROVIDER;
  delete process.env.NEXT_PUBLIC_FULFILLMENT_PROVIDER;
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  delete process.env.SHOPIFY_PRODUCT_VARIANT_MAP;
}

describe("SmartMerce deterministic core", () => {
  it("validates the intent schema", () => {
    const intent = shoppingIntentSchema.parse({
      query: "wireless earbuds",
      category: "earbuds",
      maxBudgetXsgd: 6,
      preferences: ["high rating", "good value"],
      sortPreference: "value",
    });

    expect(intent.maxBudgetXsgd).toBe(6);
  });

  it("parses the sample shopping request", () => {
    const intent = parseIntentDeterministically("Find me the best wireless earbuds under 6 XSGD. Prioritize rating and value.");

    expect(intent.query).toBe("earbuds");
    expect(intent.category).toBe("earbuds");
    expect(intent.maxBudgetXsgd).toBe(6);
    expect(intent.preferences).toContain("high rating");
    expect(intent.preferences).toContain("good value");
    expect(intent.sortPreference).toBe("value");
  });

  it("classifies USB-C charger requests as chargers, not cables", () => {
    const intent = parseIntentDeterministically("Find the best USB-C charger under 5 XSGD");
    const results = searchCatalogue({
      q: intent.query,
      category: intent.category,
      maxPrice: intent.maxBudgetXsgd,
    });

    expect(intent.category).toBe("chargers");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((product) => product.category === "chargers")).toBe(true);
  });

  it("returns mouse products for mouse requests", () => {
    const intent = parseIntentDeterministically("Find a wireless mouse under 8 XSGD");
    const results = searchCatalogue({
      q: intent.query,
      category: intent.category,
      maxPrice: intent.maxBudgetXsgd,
    });

    expect(intent.category).toBe("mouse");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((product) => product.category === "mouse")).toBe(true);
  });

  it("filters products by category, stock and budget", () => {
    const results = searchCatalogue({ q: "wireless earbuds", category: "earbuds", maxPrice: 6 });

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((product) => product.category === "earbuds")).toBe(true);
    expect(results.every((product) => product.inStock)).toBe(true);
    expect(results.every((product) => product.priceXsgd <= 6)).toBe(true);
  });

  it("ranks products by value and rating", () => {
    const intent = parseIntentDeterministically("Best earbuds under 6 XSGD prioritize rating and value");
    const ranked = rankProducts(searchCatalogue({ category: "earbuds", maxPrice: 6 }), intent);

    expect(ranked[0].name).toBe("Soundcore Mini Buds");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("blocks transactions over the limit", () => {
    const result = evaluateSpendingPolicy({
      productId: "prod-key-002",
      amount: 10.8,
      merchantId: "circuit-sg",
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.find((check) => check.id === "transaction_limit")?.passed).toBe(false);
  });

  it("blocks when the daily limit would be exceeded", () => {
    const result = evaluateSpendingPolicy({
      productId: "prod-ear-001",
      amount: 4.9,
      merchantId: "merce-demo",
      dailySpendXsgd: 16,
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.find((check) => check.id === "daily_limit")?.passed).toBe(false);
  });

  it("blocks merchants outside the allowlist", () => {
    const result = evaluateSpendingPolicy({
      productId: "prod-ear-001",
      amount: 4.9,
      merchantId: "unknown-shop",
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.find((check) => check.id === "merchant_allowlist")?.passed).toBe(false);
  });

  it("blocks price mismatches", () => {
    const result = evaluateSpendingPolicy({
      productId: "prod-ear-001",
      amount: 4.5,
      merchantId: "merce-demo",
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.find((check) => check.id === "price_verified")?.passed).toBe(false);
  });

  it("blocks out of stock products", () => {
    const result = evaluateSpendingPolicy({
      productId: "prod-phone-002",
      amount: 3.2,
      merchantId: "merce-demo",
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.find((check) => check.id === "in_stock")?.passed).toBe(false);
  });

  it("blocks purchases above the user's requested budget", () => {
    const result = evaluateSpendingPolicy({
      productId: "prod-ear-001",
      amount: 4.9,
      merchantId: "merce-demo",
      intent: { query: "earbuds", category: "earbuds", maxBudgetXsgd: 4, preferences: [] },
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.find((check) => check.id === "requested_budget")?.passed).toBe(false);
  });

  it("creates scoped authorizations and rejects expired or mismatched use", () => {
    const now = new Date("2026-08-15T04:00:00.000Z");
    const authorization = createAuthorization({
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
      now,
    });

    expect(validateAuthorization(authorization, {
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
      now: new Date("2026-08-15T04:04:00.000Z"),
    }).valid).toBe(true);

    expect(validateAuthorization(authorization, {
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
      now: new Date("2026-08-15T04:06:00.000Z"),
    }).checks.find((check) => check.id === "not_expired")?.passed).toBe(false);

    expect(validateAuthorization(authorization, {
      productId: "prod-ear-002",
      exactAmount: 4.9,
      merchantId: "merce-demo",
      now,
    }).checks.find((check) => check.id === "product_match")?.passed).toBe(false);

    expect(validateAuthorization(authorization, {
      productId: "prod-ear-001",
      exactAmount: 5.1,
      merchantId: "merce-demo",
      now,
    }).checks.find((check) => check.id === "amount_match")?.passed).toBe(false);
  });

  it("keeps saved authorizations in the shared server store", async () => {
    const authorization = saveAuthorization(createAuthorization({
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
    }));
    vi.resetModules();
    const freshModule = await import("@/lib/merchant/orders");

    expect(getAuthorizationById(authorization.id)?.id).toBe(authorization.id);
    expect(freshModule.getAuthorizationById(authorization.id)?.id).toBe(authorization.id);
  });

  it("uses Avalanche C-Chain Mainnet configuration", () => {
    expect(avalancheNetworkConfig.chainId).toBe(43114);
    expect(avalancheNetworkConfig.hexChainId).toBe("0xA86A");
    expect(avalancheNetworkConfig.rpcUrl).toContain("api.avax.network");
  });

  it("falls back to public Avalanche RPC URLs when env values are blank", async () => {
    const previousRpc = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL;
    const previousFujiRpc = process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL;
    process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL = "";
    process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL = " ";

    vi.resetModules();
    const module = await import("@/lib/blockchain/avalanche");

    expect(module.avalancheRpcUrl).toBe("https://api.avax.network/ext/bc/C/rpc");
    expect(module.avalancheFujiRpcUrl).toBe("https://api.avax-test.network/ext/bc/C/rpc");

    restoreEnv("NEXT_PUBLIC_AVALANCHE_RPC_URL", previousRpc);
    restoreEnv("NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL", previousFujiRpc);
    vi.resetModules();
  });

  it("keeps non-empty Avalanche RPC configuration available to viem", () => {
    expect(avalancheRpcUrl).toBeTruthy();
    expect(avalancheFujiRpcUrl).toBeTruthy();
  });

  it("uses the official Avalanche C-Chain XSGD contract by default", () => {
    const previous = process.env.NEXT_PUBLIC_XSGD_CONTRACT;
    const previousMainnet = process.env.NEXT_PUBLIC_XSGD_MAINNET_CONTRACT;
    delete process.env.NEXT_PUBLIC_XSGD_CONTRACT;
    delete process.env.NEXT_PUBLIC_XSGD_MAINNET_CONTRACT;

    expect(getConfiguredXsgdContract()).toBe(officialAvalancheXsgdContract);
    process.env.NEXT_PUBLIC_XSGD_CONTRACT = "";
    process.env.NEXT_PUBLIC_XSGD_MAINNET_CONTRACT = "";
    expect(getConfiguredXsgdContract()).toBe(officialAvalancheXsgdContract);

    restoreEnv("NEXT_PUBLIC_XSGD_CONTRACT", previous);
    restoreEnv("NEXT_PUBLIC_XSGD_MAINNET_CONTRACT", previousMainnet);
  });

  it("uses the ERC-20 Transfer event ABI for exact XSGD proof", () => {
    expect(erc20Abi.some((item) => item.type === "event" && item.name === "Transfer")).toBe(true);
  });

  it("blocks real checkout when merchant address is missing", () => {
    const previous = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    delete process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    const authorization = saveAuthorization(createAuthorization({
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
    }));

    expect(() => createVerifiedOrder({
      productId: "prod-ear-001",
      authorizationId: authorization.id,
      buyerWallet: "0x1111111111111111111111111111111111111111",
      paymentMethod: "direct-xsgd",
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toThrow("Trusted merchant wallet configuration required.");

    restoreEnv("NEXT_PUBLIC_MERCHANT_WALLET", previous);
  });

  it("creates a StraitsX sandbox card order without mainnet merchant wallet config", () => {
    const previous = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    delete process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    const settlementTx = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const authorization = saveAuthorization(createAuthorization({
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
    }));

    const order = createVerifiedOrder({
      productId: "prod-ear-001",
      authorizationId: authorization.id,
      buyerWallet: "0x1111111111111111111111111111111111111111",
      paymentMethod: "straitsx-card",
      transactionHash: settlementTx,
      cardReference: `straitsx-sandbox:${settlementTx}`,
    });

    expect(order.paymentMethod).toBe("straitsx-card");
    expect(order.status).toBe("confirmed");
    expect(order.transactionHash).toBe(settlementTx);
    expect(order.cardReference).toBe(`straitsx-sandbox:${settlementTx}`);

    restoreEnv("NEXT_PUBLIC_MERCHANT_WALLET", previous);
  });

  it("reserves product inventory and consumes authorization after confirmed card checkout", () => {
    const previous = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    delete process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    const productBefore = getProductById("prod-mouse-001");
    const settlementTx = "0xcececececececececececececececececececececececececececececececece";
    const authorization = saveAuthorization(createAuthorization({
      productId: "prod-mouse-001",
      exactAmount: 6.9,
      merchantId: "circuit-sg",
    }));

    const order = createVerifiedOrder({
      productId: "prod-mouse-001",
      authorizationId: authorization.id,
      buyerWallet: "0x1111111111111111111111111111111111111111",
      paymentMethod: "straitsx-card",
      transactionHash: settlementTx,
      cardReference: `straitsx-sandbox:${settlementTx}`,
    });
    const productAfter = getProductById("prod-mouse-001");

    expect(order.status).toBe("confirmed");
    expect(productAfter?.inventory).toBe((productBefore?.inventory ?? 0) - 1);
    expect(getAuthorizationById(authorization.id)).toBeUndefined();

    restoreEnv("NEXT_PUBLIC_MERCHANT_WALLET", previous);
  });

  it("stores fulfillment metadata separately from payment proof", () => {
    const previous = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    delete process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    const settlementTx = "0xcacacacacacacacacacacacacacacacacacacacacacacacacacacacacacacaca";
    const authorization = saveAuthorization(createAuthorization({
      productId: "prod-cable-001",
      exactAmount: 2.4,
      merchantId: "northstar-mobile",
    }));

    const order = createVerifiedOrder({
      productId: "prod-cable-001",
      authorizationId: authorization.id,
      buyerWallet: "0x1111111111111111111111111111111111111111",
      paymentMethod: "straitsx-card",
      transactionHash: settlementTx,
      cardReference: `straitsx-sandbox:${settlementTx}`,
    });
    const updated = updateOrderFulfillment(order.id, {
      fulfillmentProvider: "shopify",
      fulfillmentStatus: "created",
      fulfillmentReference: "#1001",
      fulfillmentUrl: "https://example.myshopify.com/orders/1001",
    });

    expect(updated.status).toBe("confirmed");
    expect(updated.fulfillmentProvider).toBe("shopify");
    expect(updated.fulfillmentStatus).toBe("created");
    expect(updated.fulfillmentReference).toBe("#1001");

    restoreEnv("NEXT_PUBLIC_MERCHANT_WALLET", previous);
  });

  it("leaves real-world fulfillment unconfigured without Shopify secrets", () => {
    const previousProvider = process.env.FULFILLMENT_PROVIDER;
    const previousPublicProvider = process.env.NEXT_PUBLIC_FULFILLMENT_PROVIDER;
    const previousDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const previousToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const previousMap = process.env.SHOPIFY_PRODUCT_VARIANT_MAP;
    clearFulfillmentEnv();

    expect(isFulfillmentConfigured()).toBe(false);

    restoreEnv("FULFILLMENT_PROVIDER", previousProvider);
    restoreEnv("NEXT_PUBLIC_FULFILLMENT_PROVIDER", previousPublicProvider);
    restoreEnv("SHOPIFY_STORE_DOMAIN", previousDomain);
    restoreEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", previousToken);
    restoreEnv("SHOPIFY_PRODUCT_VARIANT_MAP", previousMap);
  });

  it("restores a valid StraitsX authorization snapshot before card order creation", async () => {
    const previous = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    delete process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    const settlementTx = "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    const authorization = createAuthorization({
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
    });

    vi.resetModules();
    const route = await import("@/app/api/merchant/checkout/route");
    const response = await route.POST(new Request("http://localhost/api/merchant/checkout", {
      method: "POST",
      body: JSON.stringify({
        productId: "prod-ear-001",
        authorizationId: authorization.id,
        buyerWallet: "0x1111111111111111111111111111111111111111",
        paymentMethod: "straitsx-card",
        transactionHash: settlementTx,
        cardReference: `straitsx-sandbox:${settlementTx}`,
        authorizationSnapshot: authorization,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.order.paymentMethod).toBe("straitsx-card");
    expect(body.order.cardReference).toBe(`straitsx-sandbox:${settlementTx}`);

    restoreEnv("NEXT_PUBLIC_MERCHANT_WALLET", previous);
  });

  it("creates an order only after authorization and trusted merchant wallet are present", () => {
    const previous = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
    process.env.NEXT_PUBLIC_MERCHANT_WALLET = "0x2222222222222222222222222222222222222222";
    expect(getConfiguredMerchantWallet()).toBe("0x2222222222222222222222222222222222222222");

    const authorization = saveAuthorization(createAuthorization({
      productId: "prod-ear-001",
      exactAmount: 4.9,
      merchantId: "merce-demo",
    }));
    const order = createVerifiedOrder({
      productId: "prod-ear-001",
      authorizationId: authorization.id,
      buyerWallet: "0x1111111111111111111111111111111111111111",
      paymentMethod: "direct-xsgd",
      transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(order.productName).toBe("Soundcore Mini Buds");
    expect(order.status).toBe("confirmed");
    expect(order.transactionHash).toMatch(/^0x/);

    restoreEnv("NEXT_PUBLIC_MERCHANT_WALLET", previous);
  });

  it("keeps StraitsX card issuance disabled until real tools are wired", async () => {
    const provider = new StraitsXCardProvider();
    await expect(provider.createScopedCard({
      authorization: createAuthorization({ productId: "prod-ear-001", exactAmount: 4.9, merchantId: "merce-demo" }),
      purpose: "SmartMerce test",
    })).rejects.toThrow("disabled");
  });

  it("prepares direct XSGD as an explicit user-signature flow", async () => {
    const provider = new DirectXsgdPaymentProvider();
    const authorization = createAuthorization({ productId: "prod-ear-001", exactAmount: 4.9, merchantId: "merce-demo" });
    await expect(provider.prepare(authorization)).resolves.toMatchObject({
      state: "PREPARING",
      paymentMethod: "direct-xsgd",
    });
    await expect(provider.execute(authorization)).resolves.toMatchObject({
      state: "AWAITING_USER_SIGNATURE",
    });
  });

  it("validates the trusted StraitsX sandbox challenge", () => {
    expect(validateTrustedSandboxRequirement()).toEqual({ valid: true, mismatches: [] });
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      chainId: 43114,
    } as unknown as typeof trustedStraitsxSandboxRequirement).valid).toBe(false);
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      asset: "0x2222222222222222222222222222222222222222",
    } as unknown as typeof trustedStraitsxSandboxRequirement).mismatches[0]).toContain("asset expected");
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      amount: "15000001",
    } as unknown as typeof trustedStraitsxSandboxRequirement).mismatches[0]).toContain("amount expected <=");
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      amount: "",
    } as unknown as typeof trustedStraitsxSandboxRequirement).mismatches[0]).toContain("amount expected positive integer");
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      amount: "5000000",
      maxAmountRequired: "4000000",
    } as unknown as typeof trustedStraitsxSandboxRequirement).mismatches[0]).toContain("maxAmountRequired expected");
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      amount: "1000000",
      maxAmountRequired: "1000000",
    } as unknown as typeof trustedStraitsxSandboxRequirement).valid).toBe(true);
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      payTo: "0x3333333333333333333333333333333333333333",
    } as unknown as typeof trustedStraitsxSandboxRequirement).mismatches[0]).toContain("payTo expected");
    expect(validateTrustedSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      network: "eip155:43114",
    } as unknown as typeof trustedStraitsxSandboxRequirement).mismatches[0]).toContain("network expected");
  });

  it("normalizes and decodes the Payment-Required x402 challenge header", () => {
    const header = Buffer.from(JSON.stringify({
      x402Version: 1,
      error: "PAYMENT-SIGNATURE header is required",
      accepts: [trustedStraitsxSandboxRequirement],
    }), "utf8").toString("base64");
    const decoded = decodePaymentRequiredHeader(header);

    expect(decoded.x402Version).toBe(1);
    expect(decoded.selected?.asset.toLowerCase()).toBe(trustedStraitsxSandboxRequirement.asset);
    expect(decoded.selected?.payTo).toBe(trustedStraitsxSandboxRequirement.payTo);
    expect(decoded.error).toContain("PAYMENT-SIGNATURE");
  });

  it("normalizes x402 requirements with checksum addresses", () => {
    const normalized = normalizeSandboxRequirement(trustedStraitsxSandboxRequirement);

    expect(normalized.asset.toLowerCase()).toBe(trustedStraitsxSandboxRequirement.asset);
    expect(normalized.payTo).toBe(trustedStraitsxSandboxRequirement.payTo);
    expect(normalized.amount).toBe(trustedStraitsxSandboxRequirement.amount);
    expect(normalized.maxAmountRequired).toBe(trustedStraitsxSandboxRequirement.amount);
    expect(normalized.extra.assetTransferMethod).toBe("eip3009");
  });

  it("normalizes x402 maxAmountRequired into the StraitsX amount alias", () => {
    const normalized = normalizeSandboxRequirement({
      ...trustedStraitsxSandboxRequirement,
      amount: undefined,
      maxAmountRequired: trustedStraitsxSandboxRequirement.amount,
    });

    expect(normalized.amount).toBe(trustedStraitsxSandboxRequirement.amount);
    expect(normalized.maxAmountRequired).toBe(trustedStraitsxSandboxRequirement.amount);
  });

  it("validates sandbox cardholder names", () => {
    expect(validateCardholderName("Doston Husanov")).toBe(true);
    expect(validateCardholderName("D")).toBe(false);
    expect(validateCardholderName("Doston Husanov 1")).toBe(false);
    expect(validateCardholderName("This Name Is Far Too Long For Card")).toBe(false);
  });

  it("prepares EIP-3009 authorization with SDK-compatible nonce and validity window", () => {
    const authorization = prepareSandboxAuthorization({
      from: "0x4E3c233F071343344E2d862C1660538B9824bF63",
      nowSeconds: 1_800_000_000,
      nonce: "0x1111111111111111111111111111111111111111111111111111111111111111",
    });

    expect(authorization.to).toBe(trustedStraitsxSandboxRequirement.payTo);
    expect(authorization.value).toBe("5000000");
    expect(authorization.validAfter).toBe("1799999400");
    expect(authorization.validBefore).toBe("1800000300");
    expect(authorization.nonce).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("builds EIP-712 typed data from the verified StraitsX challenge", () => {
    const authorization = prepareSandboxAuthorization({
      from: "0x4E3c233F071343344E2d862C1660538B9824bF63",
      nowSeconds: 1_800_000_000,
      nonce: "0x1111111111111111111111111111111111111111111111111111111111111111",
    });
    const typedData = getSandboxTypedData(authorization);

    expect(typedData.domain.name).toBe("XSGD");
    expect(typedData.domain.version).toBe("2");
    expect(typedData.domain.chainId).toBe(43113);
    expect(typedData.domain.verifyingContract.toLowerCase()).toBe(trustedStraitsxSandboxRequirement.asset);
    expect(typedData.primaryType).toBe("TransferWithAuthorization");
    expect(typedData.message.value).toBe(BigInt("5000000"));
  });

  it("encodes the x402 PAYMENT-SIGNATURE envelope as base64 JSON", () => {
    const authorization = prepareSandboxAuthorization({
      from: "0x4E3c233F071343344E2d862C1660538B9824bF63",
      nowSeconds: 1_800_000_000,
      nonce: "0x1111111111111111111111111111111111111111111111111111111111111111",
    });
    const payload = createSignedPaymentPayload({
      authorization,
      signature: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const encoded = encodePaymentSignature(payload);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));

    expect(decoded.x402Version).toBe(1);
    expect(decoded.scheme).toBe("exact");
    expect(decoded.network).toBe("eip155:43113");
    expect(decoded.amount).toBeUndefined();
    expect(decoded.maxAmountRequired).toBeUndefined();
    expect(decoded.accepted.amount).toBe("5000000");
    expect(decoded.accepted.payTo).toBe(trustedStraitsxSandboxRequirement.payTo);
    expect(decoded.payload.authorization.value).toBe("5000000");
    expect(decoded.payload.paymentRequirements).toBeUndefined();
  });

  it("prepares but does not send the StraitsX Card API retry request", () => {
    const request = getCardApiRetryRequest({
      paymentSignature: "base64-payment-payload",
      walletAddress: "0x4E3c233F071343344E2d862C1660538B9824bF63",
      cardholderName: "Doston Husanov",
    });

    expect(request.url).toBe("https://card.straitsx.ai/sandbox/cardapi/issue_card");
    expect(request.method).toBe("POST");
    expect(request.headers["PAYMENT-SIGNATURE"]).toBe("base64-payment-payload");
    expect("X-PAYMENT" in request.headers).toBe(false);
    expect(request.body).toEqual({
      amount_sgd: 5,
      cardholder_name: "Doston Husanov",
      wallet_address: "0x4E3c233F071343344E2d862C1660538B9824bF63",
    });
  });

  it("builds the non-paying StraitsX Card API request body", () => {
    expect(getCardApiRequestBody({
      walletAddress: "0x4E3c233F071343344E2d862C1660538B9824bF63",
      cardholderName: "Doston Husanov",
    })).toEqual({
      amount_sgd: 5,
      cardholder_name: "Doston Husanov",
      wallet_address: "0x4E3c233F071343344E2d862C1660538B9824bF63",
    });
  });

  it("extracts the fresh card iframe URL without exposing card HTML", () => {
    expect(extractFirstUrl({
      content: [
        {
          text: JSON.stringify({
            iframe_url: "https://card.straitsx.ai/sandbox/view/one-time-token",
          }),
        },
      ],
    })).toBe("https://card.straitsx.ai/sandbox/view/one-time-token");
  });
});
