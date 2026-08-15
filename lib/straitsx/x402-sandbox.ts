import { createPublicClient, createWalletClient, custom, formatUnits, getAddress, isAddress, type Hex } from "viem";
import { avalancheFuji, avalancheFujiNetworkConfig, erc20Abi, type EthereumProvider } from "@/lib/blockchain/avalanche";

export const straitsxSandboxCardApiUrl = "https://card.straitsx.ai/sandbox/cardapi/issue_card";

export const trustedStraitsxSandboxRequirement = {
  x402Version: 1,
  scheme: "exact",
  network: "eip155:43113",
  chainId: 43113,
  asset: "0xd769410dc8772695a7f55a304d2125320a65c2a5",
  payTo: "0x99a2B2962a6AC463FBe04664027Fdb3F68bd4Cc8",
  amount: "5000000",
  maxAmountRequired: "5000000",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "eip3009",
    name: "XSGD",
    version: "2",
  },
} as const;

export type StraitsxSandboxRequirement = {
  x402Version: number;
  scheme: string;
  network: string;
  chainId: number;
  asset: string;
  payTo: string;
  amount: string;
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
  extra: {
    assetTransferMethod?: string;
    name?: string;
    version?: string;
  };
};

export type X402Authorization = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
};

export type X402PaymentPayload = {
  x402Version: number;
  scheme: "exact";
  network: string;
  accepted: StraitsxSandboxRequirement;
  payload: {
    signature: Hex;
    authorization: X402Authorization;
  };
};

export const eip3009Types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function validateCardholderName(name: string) {
  return /^[A-Za-z ]{2,26}$/.test(name.trim());
}

export function normalizeSandboxRequirement(value: unknown): StraitsxSandboxRequirement {
  if (typeof value !== "object" || value === null) throw new Error("Invalid x402 requirement.");
  const source = value as Record<string, unknown>;
  const extra = typeof source.extra === "object" && source.extra !== null ? (source.extra as Record<string, unknown>) : {};
  const asset = String(source.asset ?? "");
  const payTo = String(source.payTo ?? "");

  if (!isAddress(asset)) throw new Error("Invalid x402 asset address.");
  if (!isAddress(payTo)) throw new Error("Invalid x402 payTo address.");

  return {
    x402Version: Number(source.x402Version ?? trustedStraitsxSandboxRequirement.x402Version),
    scheme: String(source.scheme ?? ""),
    network: String(source.network ?? ""),
    chainId: Number(source.chainId),
    asset: getAddress(asset),
    payTo: getAddress(payTo),
    amount: String(source.amount ?? source.maxAmountRequired ?? ""),
    maxAmountRequired: String(source.maxAmountRequired ?? source.amount ?? ""),
    maxTimeoutSeconds: Number(source.maxTimeoutSeconds),
    extra: {
      assetTransferMethod: typeof extra.assetTransferMethod === "string" ? extra.assetTransferMethod : undefined,
      name: typeof extra.name === "string" ? extra.name : undefined,
      version: typeof extra.version === "string" ? extra.version : undefined,
    },
  };
}

export function validateTrustedSandboxRequirement(requirementInput: StraitsxSandboxRequirement | typeof trustedStraitsxSandboxRequirement = trustedStraitsxSandboxRequirement) {
  const requirement = normalizeSandboxRequirement(requirementInput);
  const mismatches: string[] = [];
  if (requirement.network !== "eip155:43113") mismatches.push(`network expected eip155:43113, got ${requirement.network}`);
  if (requirement.chainId !== 43113) mismatches.push(`chainId expected 43113, got ${requirement.chainId}`);
  if (requirement.asset.toLowerCase() !== trustedStraitsxSandboxRequirement.asset) mismatches.push(`asset expected ${trustedStraitsxSandboxRequirement.asset}, got ${requirement.asset}`);
  if (requirement.payTo !== getAddress(trustedStraitsxSandboxRequirement.payTo)) mismatches.push(`payTo expected ${trustedStraitsxSandboxRequirement.payTo}, got ${requirement.payTo}`);
  if (!/^[1-9][0-9]*$/.test(requirement.amount)) {
    mismatches.push(`amount expected positive integer, got ${requirement.amount || "empty"}`);
  } else if (BigInt(requirement.amount) > BigInt(trustedStraitsxSandboxRequirement.amount)) {
    mismatches.push(`amount expected <= ${trustedStraitsxSandboxRequirement.amount}, got ${requirement.amount}`);
  }
  if (requirement.maxAmountRequired !== requirement.amount) mismatches.push(`maxAmountRequired expected ${requirement.amount}, got ${requirement.maxAmountRequired}`);
  if (requirement.scheme !== "exact") mismatches.push(`scheme expected exact, got ${requirement.scheme}`);
  if (requirement.extra.assetTransferMethod !== "eip3009") mismatches.push(`assetTransferMethod expected eip3009, got ${requirement.extra.assetTransferMethod}`);

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}

export function decodePaymentRequiredHeader(header: string) {
  const json = typeof window !== "undefined" ? atob(header) : Buffer.from(header, "base64").toString("utf8");
  const parsed = JSON.parse(json) as { x402Version?: number; accepts?: unknown[]; error?: string };
  const selected = parsed.accepts?.[0];
  return {
    x402Version: parsed.x402Version,
    error: parsed.error,
    accepts: parsed.accepts ?? [],
    selected: selected ? normalizeSandboxRequirement({ ...(selected as Record<string, unknown>), x402Version: parsed.x402Version }) : undefined,
  };
}

export function createAuthorizationNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex;
}

export function prepareSandboxAuthorization(input: {
  from: `0x${string}`;
  requirement?: StraitsxSandboxRequirement;
  nowSeconds?: number;
  nonce?: Hex;
}): X402Authorization {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const requirement = input.requirement ?? normalizeSandboxRequirement(trustedStraitsxSandboxRequirement);
  return {
    from: getAddress(input.from),
    to: getAddress(requirement.payTo),
    value: requirement.amount,
    validAfter: String(now - 600),
    validBefore: String(now + trustedStraitsxSandboxRequirement.maxTimeoutSeconds),
    nonce: input.nonce ?? createAuthorizationNonce(),
  };
}

export function getSandboxTypedData(authorization: X402Authorization) {
  return {
    domain: {
      name: trustedStraitsxSandboxRequirement.extra.name,
      version: trustedStraitsxSandboxRequirement.extra.version,
      chainId: trustedStraitsxSandboxRequirement.chainId,
      verifyingContract: getAddress(trustedStraitsxSandboxRequirement.asset),
    },
    types: eip3009Types,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  };
}

export function encodePaymentSignature(payload: X402PaymentPayload) {
  const json = JSON.stringify(payload);
  if (typeof window !== "undefined") {
    return btoa(json);
  }
  return Buffer.from(json, "utf8").toString("base64");
}

export function createSignedPaymentPayload(input: {
  authorization: X402Authorization;
  requirement?: StraitsxSandboxRequirement;
  signature: Hex;
}): X402PaymentPayload {
  const requirement = input.requirement ?? normalizeSandboxRequirement(trustedStraitsxSandboxRequirement);
  return {
    x402Version: requirement.x402Version,
    scheme: "exact",
    network: requirement.network,
    accepted: requirement,
    payload: {
      signature: input.signature,
      authorization: input.authorization,
    },
  };
}

export function getCardApiRetryRequest(input: {
  paymentSignature: string;
  walletAddress: `0x${string}`;
  cardholderName: string;
}) {
  return {
    url: straitsxSandboxCardApiUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "PAYMENT-SIGNATURE": input.paymentSignature,
    },
    body: {
      amount_sgd: 5,
      cardholder_name: input.cardholderName,
      wallet_address: input.walletAddress,
    },
  };
}

export function getCardApiRequestBody(input: {
  walletAddress: `0x${string}`;
  cardholderName: string;
}) {
  return {
    amount_sgd: 5,
    cardholder_name: input.cardholderName,
    wallet_address: input.walletAddress,
  };
}

export function extractFirstUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    const direct = value.match(/https?:\/\/[^\s"'<>]+/);
    if (direct) return direct[0];
    try {
      return extractFirstUrl(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractFirstUrl(item);
      if (found) return found;
    }
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      const found = extractFirstUrl(item);
      if (found) return found;
    }
  }
  return undefined;
}

export async function getFujiXsgdBalance(address: `0x${string}`) {
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: custom({
      request: ({ method, params }) =>
        fetch(avalancheFujiNetworkConfig.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }).then((response) => response.json()).then((payload) => {
          if (payload.error) throw new Error(payload.error.message);
          return payload.result;
        }),
    } as EthereumProvider),
  });
  const token = getAddress(trustedStraitsxSandboxRequirement.asset);
  const [balance, decimals] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return {
    balance: formatUnits(balance, decimals),
    decimals,
  };
}

export async function signSandboxX402Payment(input: {
  provider: EthereumProvider;
  walletAddress: `0x${string}`;
  authorization: X402Authorization;
}) {
  const walletClient = createWalletClient({
    account: input.walletAddress,
    chain: avalancheFuji,
    transport: custom(input.provider),
  });
  const typedData = getSandboxTypedData(input.authorization);
  return walletClient.signTypedData(typedData);
}
