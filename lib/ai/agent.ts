import { getAiProvider } from "@/lib/ai/provider";
import { isInternetDiscoveryConfigured } from "@/lib/commerce/web-discovery";
import {
  checkSpendingPolicy,
  compareProducts,
  recommendationExplanation,
  searchProducts,
} from "@/lib/ai/tools";
import type { ActivityLogEntry, AgentRunResult, AgentStep } from "@/types";

function stamp(message: string): ActivityLogEntry {
  return {
    time: new Date().toLocaleTimeString("en-SG", { hour12: false }),
    message,
  };
}

const baseSteps: AgentStep[] = [
  { id: "understand", label: "Understanding request", status: "pending" },
  { id: "budget", label: "Budget detected", status: "pending" },
  { id: "search", label: "Searching merchants", status: "pending" },
  { id: "compare", label: "Comparing products", status: "pending" },
  { id: "select", label: "Selecting best option", status: "pending" },
  { id: "policy", label: "Spending policy", status: "pending" },
  { id: "authorization", label: "Authorization", status: "pending" },
];

export async function runSmartMerceAgent(command: string): Promise<AgentRunResult> {
  const provider = getAiProvider();
  const activity = [stamp("Shopping instruction received")];
  const steps = baseSteps.map((step) => ({ ...step }));

  const intent = await provider.parseIntent(command);
  steps[0] = { ...steps[0], status: "completed", detail: intent.query };
  steps[1] = {
    ...steps[1],
    status: intent.maxBudgetXsgd ? "completed" : "requires_action",
    detail: intent.maxBudgetXsgd ? `Maximum ${intent.maxBudgetXsgd} XSGD` : "No explicit budget",
  };
  if (intent.maxBudgetXsgd) activity.push(stamp(`Budget identified: ${intent.maxBudgetXsgd} XSGD`));

  const discovered = await searchProducts(intent);
  const discoverySource = isInternetDiscoveryConfigured() ? "internet" : "catalogue";
  steps[2] = {
    ...steps[2],
    status: discovered.length ? "completed" : "failed",
    detail: `${discovered.length} ${discoverySource} products discovered`,
  };
  activity.push(stamp(`${discovered.length} products matched from ${discoverySource}`));

  const shortlist = compareProducts(intent, discovered.map((product) => product.id));
  steps[3] = {
    ...steps[3],
    status: shortlist.length ? "completed" : "failed",
    detail: `${shortlist.length} products shortlisted`,
  };
  activity.push(stamp(`${shortlist.length} products shortlisted`));

  const recommendation = shortlist[0];
  if (!recommendation) {
    return {
      intent,
      products: discovered,
      shortlist,
      steps,
      activity,
      provider: provider.name,
      discoverySource,
    };
  }

  const explanation = recommendationExplanation(recommendation, intent);
  steps[4] = {
    ...steps[4],
    status: "completed",
    detail: recommendation.name,
  };
  activity.push(stamp(`SmartMerce recommended ${recommendation.name}`));

  const policy = checkSpendingPolicy({
    productId: recommendation.id,
    merchantId: recommendation.merchantId,
    amount: recommendation.priceXsgd,
    intent,
  });

  steps[5] = {
    ...steps[5],
    status: policy.allowed ? "completed" : "failed",
    detail: policy.allowed ? "Policy passed" : "Purchase blocked",
  };
  steps[6] = {
    ...steps[6],
    status: policy.allowed ? "requires_action" : "pending",
    detail: policy.allowed ? "User approval required" : undefined,
  };
  activity.push(stamp(policy.allowed ? "Spending policy passed" : "Spending policy rejected"));

  return {
    intent,
    products: discovered,
    shortlist,
    recommendation,
    explanation,
    policy,
    steps,
    activity,
    provider: provider.name,
    discoverySource,
  };
}
