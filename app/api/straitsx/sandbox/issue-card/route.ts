import { NextResponse } from "next/server";
import { z } from "zod";
import { createStraitsXMcpClient } from "@/lib/straitsx/mcp-client";
import {
  extractFirstUrl,
  getCardApiRequestBody,
  straitsxSandboxCardApiUrl,
  trustedStraitsxSandboxRequirement,
  validateCardholderName,
  validateTrustedSandboxRequirement,
} from "@/lib/straitsx/x402-sandbox";

const issueCardSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  cardholderName: z.string().refine(validateCardholderName),
  paymentSignature: z.string().min(20),
});

function hasField(value: unknown, field: string) {
  return typeof value === "object" && value !== null && field in value;
}

function sanitizeFailureBody(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map(sanitizeFailureBody);

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/card_html|signature|payment/i.test(key)) {
      sanitized[key] = "[redacted]";
    } else {
      sanitized[key] = sanitizeFailureBody(item);
    }
  }
  return sanitized;
}

function hasEmptyX402Amount(value: unknown) {
  if (typeof value !== "object" || value === null) return false;
  const body = value as { accepts?: unknown[]; error?: unknown };
  const accepts = Array.isArray(body.accepts) ? body.accepts : [];
  return accepts.some((item) =>
    typeof item === "object" &&
    item !== null &&
    "amount" in item &&
    String((item as Record<string, unknown>).amount ?? "") === "",
  );
}

function decodePaymentEnvelope(paymentSignature: string) {
  const parsed = JSON.parse(Buffer.from(paymentSignature, "base64").toString("utf8")) as {
    x402Version?: number;
    scheme?: string;
    network?: string;
    accepted?: {
      amount?: string;
      payTo?: string;
    };
    payload?: {
      authorization?: {
        from?: string;
        to?: string;
        value?: string;
        validBefore?: string;
      };
    };
  };
  return parsed;
}

function validatePaymentEnvelope(paymentSignature: string, walletAddress: string) {
  const mismatches: string[] = [];
  const envelope = decodePaymentEnvelope(paymentSignature);
  const authorization = envelope.payload?.authorization;
  const accepted = envelope.accepted;

  const validation = validateTrustedSandboxRequirement({
    ...trustedStraitsxSandboxRequirement,
    x402Version: envelope.x402Version ?? 0,
    scheme: envelope.scheme ?? "",
    network: envelope.network ?? "",
    amount: authorization?.value ?? "0",
    payTo: authorization?.to ?? "0x0000000000000000000000000000000000000000",
  });

  mismatches.push(...validation.mismatches);
  if (!accepted?.amount) {
    mismatches.push("accepted.amount is missing");
  } else if (accepted.amount !== authorization?.value) {
    mismatches.push(`accepted.amount expected ${authorization?.value ?? "missing"}, got ${accepted.amount}`);
  }
  if (accepted?.payTo && authorization?.to && accepted.payTo.toLowerCase() !== authorization.to.toLowerCase()) {
    mismatches.push(`accepted.payTo expected ${authorization.to}, got ${accepted.payTo}`);
  }
  if (envelope.x402Version !== trustedStraitsxSandboxRequirement.x402Version) {
    mismatches.push(`x402Version expected ${trustedStraitsxSandboxRequirement.x402Version}, got ${envelope.x402Version ?? "missing"}`);
  }
  if (authorization?.from?.toLowerCase() !== walletAddress.toLowerCase()) {
    mismatches.push(`authorization.from expected ${walletAddress}, got ${authorization?.from ?? "missing"}`);
  }
  if (!authorization?.value || BigInt(authorization.value) <= BigInt(0)) {
    mismatches.push("authorization.value is missing or zero");
  }
  if (!authorization?.validBefore || Number(authorization.validBefore) <= Math.floor(Date.now() / 1000)) {
    mismatches.push("authorization has expired");
  }

  return mismatches;
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof createStraitsXMcpClient>> | undefined;

  try {
    const parsed = issueCardSchema.parse(await request.json());
    const envelopeMismatches = validatePaymentEnvelope(parsed.paymentSignature, parsed.walletAddress);
    if (envelopeMismatches.length > 0) {
      return NextResponse.json({
        error: "x402 payment envelope mismatch.",
        mismatches: envelopeMismatches,
      }, { status: 400 });
    }

    const response = await fetch(straitsxSandboxCardApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "PAYMENT-SIGNATURE": parsed.paymentSignature,
      },
      body: JSON.stringify(getCardApiRequestBody({
        walletAddress: parsed.walletAddress as `0x${string}`,
        cardholderName: parsed.cardholderName,
      })),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const emptyAmount = hasEmptyX402Amount(body);
      return NextResponse.json({
        error: emptyAmount
          ? "StraitsX sandbox returned a malformed paid-retry x402 challenge with an empty amount."
          : "StraitsX sandbox card issuance failed.",
        providerCode: emptyAmount ? "STRAITSX_EMPTY_AMOUNT_ON_PAID_RETRY" : undefined,
        status: response.status,
        details: sanitizeFailureBody(body),
      }, { status: 400 });
    }

    if (!hasField(body, "card_opaque_id") || !hasField(body, "settlement_tx") || !hasField(body, "card_html")) {
      return NextResponse.json({
        error: "StraitsX response missing expected card issuance fields.",
        status: response.status,
        fields: {
          card_opaque_id: hasField(body, "card_opaque_id"),
          settlement_tx: hasField(body, "settlement_tx"),
          card_html: hasField(body, "card_html"),
        },
      }, { status: 400 });
    }

    const cardOpaqueId = String((body as Record<string, unknown>).card_opaque_id);
    const settlementTx = String((body as Record<string, unknown>).settlement_tx);

    session = await createStraitsXMcpClient({ environment: "sandbox" });
    const viewResponse = await session.client.callTool({
      name: "view_card_sandbox",
      arguments: {
        card_opaque_id: cardOpaqueId,
        settlement_tx: settlementTx,
        wallet_address: parsed.walletAddress,
      },
    });
    const iframeUrl = extractFirstUrl(viewResponse);

    return NextResponse.json({
      cardIssuance: "SUCCESS",
      card_opaque_id_present: Boolean(cardOpaqueId),
      settlement_tx: settlementTx,
      view_card_sandbox: iframeUrl ? "SUCCESS" : "FAILED",
      iframeUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "StraitsX sandbox card issuance failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await session?.close();
  }
}
