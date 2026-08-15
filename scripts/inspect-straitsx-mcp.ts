import { mkdir, writeFile } from "node:fs/promises";
import { createStraitsXMcpClient, getStraitsXMcpUrl } from "../lib/straitsx/mcp-client";

function schemaRequired(inputSchema: { required?: unknown }) {
  return Array.isArray(inputSchema.required) ? inputSchema.required.map(String) : [];
}

function renderToolsMarkdown(input: {
  url: string;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
}) {
  const lines = [
    "# StraitsX Sandbox MCP Tools",
    "",
    `Discovery URL: \`${input.url}\``,
    `Discovered at: \`${new Date().toISOString()}\``,
    "",
    "Only `tools/list` was called. No card issuance, transaction, or production endpoint was used.",
    "",
  ];

  if (input.tools.length === 0) {
    lines.push("No tools were returned by the sandbox MCP server.", "");
  }

  for (const tool of input.tools) {
    lines.push(`## ${tool.name}`, "");
    lines.push(tool.description ?? "No description provided.", "");
    lines.push("Required parameters:", "");
    const required = schemaRequired(tool.inputSchema);
    if (required.length) {
      for (const item of required) lines.push(`- \`${item}\``);
    } else {
      lines.push("- None declared");
    }
    lines.push("", "Input schema:", "", "```json", JSON.stringify(tool.inputSchema, null, 2), "```", "");
  }

  return lines.join("\n");
}

async function main() {
  const url = getStraitsXMcpUrl("sandbox");
  let session: Awaited<ReturnType<typeof createStraitsXMcpClient>> | undefined;

  try {
    session = await createStraitsXMcpClient({ environment: "sandbox" });
    const result = await session.client.listTools();
    const tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    for (const tool of tools) {
      console.log(`\n${tool.name}`);
      console.log(tool.description ?? "No description provided.");
      console.log(`Required: ${schemaRequired(tool.inputSchema).join(", ") || "None declared"}`);
      console.log(JSON.stringify(tool.inputSchema, null, 2));
    }

    await mkdir("docs", { recursive: true });
    await writeFile("docs/STRAITSX_MCP_TOOLS.md", renderToolsMarkdown({ url, tools }), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await mkdir("docs", { recursive: true });
    await writeFile(
      "docs/STRAITSX_MCP_TOOLS.md",
      [
        "# StraitsX Sandbox MCP Tools",
        "",
        `Discovery URL: \`${url}\``,
        `Attempted at: \`${new Date().toISOString()}\``,
        "",
        "Discovery failed before tools could be listed.",
        "",
        "Error:",
        "",
        "```text",
        message,
        "```",
        "",
        "No card issuance, transaction, or production endpoint was used.",
        "",
      ].join("\n"),
      "utf8",
    );
    console.error(message);
    process.exitCode = 1;
  } finally {
    await session?.close();
  }
}

void main();
