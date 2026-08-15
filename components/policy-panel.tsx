import { CheckCircle2, XCircle } from "lucide-react";
import type { PolicyResult } from "@/types";

export function PolicyPanel({ policy }: { policy?: PolicyResult }) {
  if (!policy) return null;

  return (
    <section className={`glass rounded-lg p-6 ${policy.allowed ? "ring-1 ring-accent/40" : "ring-1 ring-red-300/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Safety Check</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${policy.allowed ? "bg-accent text-background" : "bg-red-300 text-background"}`}>
          {policy.allowed ? "READY TO APPROVE" : "BLOCKED"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Before payment, SmartMerce checks the price, merchant, stock and spending limit. This keeps the AI from buying anything outside your approval.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {policy.checks.map((check) => {
          const Icon = check.passed ? CheckCircle2 : XCircle;
          return (
            <div key={check.id} className="rounded-md border border-line bg-white/[0.03] p-3">
              <div className="flex items-start gap-3">
                <Icon size={18} className={check.passed ? "mt-0.5 text-accent" : "mt-0.5 text-red-300"} />
                <div>
                  <div className="text-sm font-medium text-ink">{check.label}</div>
                  <div className="mt-1 text-xs leading-5 text-muted">{check.reason}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
