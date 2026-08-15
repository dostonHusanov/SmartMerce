import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export type StraitsXMcpEnvironment = "sandbox" | "production";

export function getStraitsXMcpUrl(environment: StraitsXMcpEnvironment = "sandbox") {
  if (environment === "production") {
    return process.env.STRAITSX_CARD_MCP_PRODUCTION_URL ?? "https://card.straitsx.ai/production/sse";
  }

  return process.env.STRAITSX_CARD_MCP_SANDBOX_URL ?? "https://card.straitsx.ai/sandbox/sse";
}

export function getConfiguredStraitsXEnvironment(): StraitsXMcpEnvironment {
  return process.env.STRAITSX_CARD_ENV === "production" ? "production" : "sandbox";
}

export async function createStraitsXMcpClient(input?: {
  environment?: StraitsXMcpEnvironment;
  token?: string;
}) {
  const environment = input?.environment ?? getConfiguredStraitsXEnvironment();

  if (environment === "production") {
    throw new Error("Production StraitsX MCP is disabled until sandbox tools and credentials are verified.");
  }

  const token = input?.token ?? process.env.STRAITSX_MCP_TOKEN;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const transport = new SSEClientTransport(new URL(getStraitsXMcpUrl(environment)), {
    eventSourceInit: headers ? { fetch: (url, init) => fetch(url, { ...init, headers }) } : undefined,
    requestInit: headers ? { headers } : undefined,
  });
  const client = new Client(
    {
      name: "smartmerce-straitsx-discovery",
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);

  return {
    client,
    transport,
    close: async () => {
      await transport.close();
    },
  };
}
