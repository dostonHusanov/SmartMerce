export const config = {
  aiProvider: process.env.AI_PROVIDER?.trim() || "deterministic-fallback",
  hasAiApiKey: Boolean(process.env.AI_API_KEY?.trim()),
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
};
