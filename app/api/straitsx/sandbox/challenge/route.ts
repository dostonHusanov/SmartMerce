import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decodePaymentRequiredHeader,
  getCardApiRequestBody,
  straitsxSandboxCardApiUrl,
  validateCardholderName,
  validateTrustedSandboxRequirement,
} from "@/lib/straitsx/x402-sandbox";

const challengeSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  cardholderName: z.string().refine(validateCardholderName),
});

export async function POST(request: Request) {
  try {
    const parsed = challengeSchema.parse(await request.json());
    const response = await fetch(straitsxSandboxCardApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(getCardApiRequestBody({
        walletAddress: parsed.walletAddress as `0x${string}`,
        cardholderName: parsed.cardholderName,
      })),
    });

    const body = await response.json().catch(() => null);
    const paymentRequired = response.headers.get("Payment-Required");
    if (response.status !== 402 || !paymentRequired) {
      return NextResponse.json({ error: "Expected HTTP 402 Payment Required challenge.", status: response.status, body }, { status: 400 });
    }

    const decoded = decodePaymentRequiredHeader(paymentRequired);
    if (!decoded.selected) {
      return NextResponse.json({ error: "No x402 payment requirement returned." }, { status: 400 });
    }

    const validation = validateTrustedSandboxRequirement(decoded.selected);
    if (!validation.valid) {
      return NextResponse.json({ error: "x402 challenge mismatch.", mismatches: validation.mismatches, requirement: decoded.selected }, { status: 400 });
    }

    return NextResponse.json({
      status: response.status,
      requirement: decoded.selected,
      x402Version: decoded.x402Version,
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect StraitsX sandbox challenge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
