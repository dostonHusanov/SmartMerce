import type { ActivityLogEntry } from "@/types";

export function ActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  return (
    <section className="glass rounded-lg p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Activity Log</h2>
      <div className="mt-5 space-y-3">
        {entries.map((entry, index) => (
          <div key={`${entry.time}-${index}`} className="grid grid-cols-[74px_1fr] gap-3 text-sm">
            <span className="font-mono text-xs text-muted">{entry.time}</span>
            <span className="text-ink">{entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
