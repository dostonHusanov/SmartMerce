"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Search, ShieldCheck } from "lucide-react";
import { ActivityLog } from "@/components/activity-log";
import { AgentTimeline } from "@/components/agent-timeline";
import { PolicyPanel } from "@/components/policy-panel";
import { ProductCard } from "@/components/product-card";
import { PurchaseAuthorization } from "@/components/purchase-authorization";
import { Recommendation } from "@/components/recommendation";
import { PaymentFlow } from "@/components/payment-flow";
import { WalletStatus } from "@/components/wallet-status";
import type { ActivityLogEntry, AgentRunResult, AgentStep, PurchaseAuthorization as Authorization } from "@/types";

const suggestions = [
  "Buy me a phone case under 10 XSGD",
  "Buy me a phone holder under 10 XSGD",
  "Find an Apple Watch alternative under 10 XSGD",
  "Compare running shoes under 10 XSGD",
  "Find a desk lamp under 9 XSGD",
  "Get me a backpack under 18 XSGD",
  "Find a notebook under 4 XSGD",
];

const initialSteps: AgentStep[] = [
  { id: "understand", label: "Read request", status: "pending" },
  { id: "budget", label: "Check budget", status: "pending" },
  { id: "search", label: "Search stores", status: "pending" },
  { id: "compare", label: "Compare choices", status: "pending" },
  { id: "select", label: "Pick best match", status: "pending" },
  { id: "policy", label: "Safety check", status: "pending" },
  { id: "authorization", label: "Ask approval", status: "pending" },
];

const initialActivity: ActivityLogEntry[] = [
  {
    time: "--:--:--",
    message: "Ready for shopping instruction",
  },
];

function createActivity(message: string): ActivityLogEntry {
  return {
    time: new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    message,
  };
}

export function AgentCommand() {
  const [command, setCommand] = useState("Buy me a phone case under 10 XSGD.\nPrioritize rating, value and fast shipping.");
  const [result, setResult] = useState<AgentRunResult>();
  const [visibleSteps, setVisibleSteps] = useState<AgentStep[]>(initialSteps);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [authorization, setAuthorization] = useState<Authorization>();

  useEffect(() => {
    if (!result) return;
    setVisibleSteps(initialSteps.map((step, index) => (index === 0 ? { ...step, status: "running" } : step)));
    const timers = result.steps.map((step, index) =>
      window.setTimeout(() => {
        setVisibleSteps((current) =>
          current.map((item, itemIndex) => {
            if (item.id === step.id) return step;
            if (itemIndex === index + 1 && step.status === "completed") return { ...item, status: "running" };
            return item;
          }),
        );
      }, index * 170),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [result]);

  const hasNoBudget = result && result.intent.maxBudgetXsgd === undefined;
  const noProducts = result && result.products.length === 0;
  const budgetTooLow = result && result.intent.maxBudgetXsgd !== undefined && result.products.length === 0;

  const helperMessage = useMemo(() => {
    if (error) return error;
    if (noProducts && result?.discoverySource === "internet" && budgetTooLow) return "Live internet search found no products inside that budget. Try a higher XSGD limit or a more specific product.";
    if (noProducts && result?.discoverySource === "internet") return "Live internet search found no matching products. Try a clearer item name or brand.";
    if (noProducts && budgetTooLow) return "No supported merchant products fit that budget. Try a slightly higher XSGD limit.";
    if (noProducts) return "No supported merchant product matched yet. Try a clearer item type, for example desk lamp, watch, shoes, backpack, charger or phone holder.";
    if (hasNoBudget) return "No budget detected. SmartMerce can compare products, but policy will be clearer with a maximum XSGD amount.";
    return undefined;
  }, [budgetTooLow, error, hasNoBudget, noProducts, result?.discoverySource]);

  async function runAgent() {
    setLoading(true);
    setError(undefined);
    setAuthorization(undefined);
    setResult(undefined);
    setVisibleSteps(initialSteps);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "SmartMerce agent failed.");
      setResult(payload);
    } catch (caught) {
      setResult(undefined);
      setVisibleSteps(initialSteps);
      setError(caught instanceof Error ? caught.message : "SmartMerce could not run.");
    } finally {
      setLoading(false);
    }
  }

  async function authorize() {
    if (!result?.recommendation) return;
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "authorize",
        productId: result.recommendation.id,
        exactAmount: result.recommendation.priceXsgd,
        merchantId: result.recommendation.merchantId,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Authorization failed.");
      return;
    }
    setAuthorization(payload.authorization);
    setResult((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((step) =>
              step.id === "authorization" ? { ...step, status: "completed", detail: "Purchase authorized" } : step,
            ),
            activity: [...current.activity, createActivity(`User authorized ${current.recommendation?.priceXsgd.toFixed(2)} XSGD`)],
          }
        : current,
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="glass rounded-lg p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-accent">
                <Search size={18} />
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">What do you want to buy?</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                Type a normal shopping request. SmartMerce searches live stores, compares the best options, and asks before any payment step.
              </p>
            </div>
            <div className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-accent">
              Live web search
            </div>
          </div>
          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Buy me a desk lamp under 9 XSGD."
            className="focus-ring mt-5 min-h-28 w-full resize-y rounded-lg border border-line bg-black/30 p-4 text-base leading-7 text-ink placeholder:text-muted sm:min-h-32 sm:p-5 sm:text-lg sm:leading-8"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setCommand(suggestion)}
                className="focus-ring rounded-full border border-line bg-white/[0.04] px-3 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-ink sm:px-4 sm:text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              void runAgent();
            }}
            disabled={loading}
            className="focus-ring mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:tracking-[0.18em]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            Find Products
          </button>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck size={14} className="text-accent" />
            You stay in control. Money moves only after you approve in your wallet.
          </div>
        </section>

        {helperMessage ? (
          <div className="rounded-lg border border-amber/30 bg-amber/10 px-5 py-4 text-sm text-amber">{helperMessage}</div>
        ) : null}

        {result?.shortlist.length ? (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Top Products</h2>
                <p className="mt-1 text-sm text-muted">
                  {result.products.length} options found from {result.discoverySource === "internet" ? "live stores" : "supported merchants"}
                </p>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Best matches</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.shortlist.map((product, index) => (
                <ProductCard key={product.id} product={product} selected={index === 0} />
              ))}
            </div>
          </section>
        ) : null}

        <Recommendation product={result?.recommendation} explanation={result?.explanation} />

        <PolicyPanel policy={result?.policy} />
        <PurchaseAuthorization product={result?.recommendation} policy={result?.policy} onAuthorize={authorize} authorization={authorization} />
        <PaymentFlow authorization={authorization} product={result?.recommendation} />
      </div>

      <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
        <WalletStatus />
        <AgentTimeline steps={result ? visibleSteps : initialSteps} />
        <ActivityLog entries={result?.activity ?? initialActivity} />
        <section className="glass rounded-lg p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">AI Provider</div>
          <div className="mt-2 text-sm font-semibold text-ink">{result?.provider ?? "deterministic-fallback"}</div>
          <div className="mt-3 text-xs uppercase tracking-[0.18em] text-muted">Discovery</div>
          <div className="mt-2 text-sm font-semibold text-ink">{result?.discoverySource === "internet" ? "live store results" : "demo catalogue"}</div>
          <p className="mt-3 text-xs leading-5 text-muted">SmartMerce separates AI search from payment approval, so product discovery can stay flexible while spending stays controlled.</p>
        </section>
      </aside>
    </div>
  );
}
