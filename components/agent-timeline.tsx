import { CheckCircle2, Circle, Clock3, Loader2, ShieldAlert } from "lucide-react";
import type { AgentStep } from "@/types";

const iconMap = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: ShieldAlert,
  requires_action: Clock3,
};

export function AgentTimeline({ steps }: { steps: AgentStep[] }) {
  return (
    <section className="glass rounded-lg p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">SmartMerce Agent</h2>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">tool-controlled</span>
      </div>
      <div className="space-y-4">
        {steps.map((step) => {
          const Icon = iconMap[step.status];
          return (
            <div key={step.id} className="flex gap-3">
              <div className="pt-0.5">
                <Icon
                  size={18}
                  className={
                    step.status === "completed"
                      ? "text-accent"
                      : step.status === "failed"
                        ? "text-red-300"
                        : step.status === "running"
                          ? "animate-spin text-violet"
                          : step.status === "requires_action"
                            ? "text-amber"
                            : "text-muted"
                  }
                />
              </div>
              <div>
                <div className="text-sm font-medium text-ink">{step.label}</div>
                <div className="mt-1 text-xs text-muted">{step.detail ?? step.status.replace("_", " ")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
