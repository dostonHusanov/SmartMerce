import { mkdir, writeFile } from "node:fs/promises";
import { createStraitsXMcpClient } from "../lib/straitsx/mcp-client";

const walletAddress = "0x4E3c233F071343344E2d862C1660538B9824bF63";
const cardholderName = "Doston Husanov";
const amountSgd = 15;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactSensitive(key: string, value: unknown): unknown {
  if (/card_html|pan|cvv|cvc|full.?card|private|secret|token|signature/i.test(key)) {
    return "[REDACTED]";
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactSensitive(childKey, childValue)]));
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitive(key, item));
  return value;
}

function sanitize(value: unknown): unknown {
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSensitive(key, item)]));
}

function findUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item);
      if (found) return found;
    }
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (/url|endpoint|api/i.test(key)) {
        const found = findUrl(item);
        if (found) return found;
      }
    }
    for (const item of Object.values(value)) {
      const found = findUrl(item);
      if (found) return found;
    }
  }
  return undefined;
}

async function inspectCardApi(endpoint: string) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: sanitize(body),
  };
}

function renderMarkdown(input: {
  mcpResponse: unknown;
  cardApiEndpoint?: string;
  cardApiResponse?: unknown;
  cardApiError?: string;
}) {
  return [
    "# StraitsX Sandbox x402 Requirements",
    "",
    `Inspected at: \`${new Date().toISOString()}\``,
    "",
    "Scope:",
    "",
    "- Called `get_card_sandbox` exactly once.",
    "- Did not sign anything.",
    "- Did not send XSGD.",
    "- Did not fund or issue a card.",
    "- Did not invoke production.",
    "",
    "Request:",
    "",
    "```json",
    JSON.stringify(
      {
        wallet_address: walletAddress,
        cardholder_name: cardholderName,
        amount_sgd: amountSgd,
      },
      null,
      2,
    ),
    "```",
    "",
    "MCP response:",
    "",
    "```json",
    JSON.stringify(sanitize(input.mcpResponse), null, 2),
    "```",
    "",
    `Card API endpoint: ${input.cardApiEndpoint ? `\`${input.cardApiEndpoint}\`` : "Not found"}`,
    "",
    "Card API non-paying response:",
    "",
    "```json",
    JSON.stringify(input.cardApiResponse ?? { error: input.cardApiError ?? "Not requested" }, null, 2),
    "```",
    "",
  ].join("\n");
}

async function main() {
  let session: Awaited<ReturnType<typeof createStraitsXMcpClient>> | undefined;
  let mcpResponse: unknown;
  let cardApiEndpoint: string | undefined;
  let cardApiResponse: unknown;
  let cardApiError: string | undefined;

  try {
    session = await createStraitsXMcpClient({ environment: "sandbox" });
    mcpResponse = await session.client.callTool({
      name: "get_card_sandbox",
      arguments: {
        wallet_address: walletAddress,
        cardholder_name: cardholderName,
        amount_sgd: amountSgd,
      },
    });
    cardApiEndpoint = findUrl(mcpResponse);

    if (cardApiEndpoint) {
      try {
        cardApiResponse = await inspectCardApi(cardApiEndpoint);
      } catch (error) {
        cardApiError = error instanceof Error ? error.message : String(error);
      }
    }
  } finally {
    await session?.close();
  }

  await mkdir("docs", { recursive: true });
  await writeFile(
    "docs/STRAITSX_X402_REQUIREMENTS.md",
    renderMarkdown({ mcpResponse, cardApiEndpoint, cardApiResponse, cardApiError }),
    "utf8",
  );

  console.log(renderMarkdown({ mcpResponse, cardApiEndpoint, cardApiResponse, cardApiError }));
}

void main();
