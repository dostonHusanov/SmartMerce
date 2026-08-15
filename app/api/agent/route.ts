import { NextResponse } from "next/server";
import { agentRequestSchema, authorizationRequestSchema } from "@/lib/ai/schemas";
import { runSmartMerceAgent } from "@/lib/ai/agent";
import { preparePurchase } from "@/lib/ai/tools";
import { saveAuthorization } from "@/lib/merchant/orders";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.action === "authorize") {
      const parsed = authorizationRequestSchema.parse(body);
      return NextResponse.json({
        authorization: saveAuthorization(preparePurchase(parsed)),
      });
    }

    const parsed = agentRequestSchema.parse(body);
    const result = await runSmartMerceAgent(parsed.command);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SmartMerce could not complete the request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
