import { Sparkles, Star } from "lucide-react";
import type { RankedProduct } from "@/types";

export function Recommendation({
  product,
  explanation,
}: {
  product?: RankedProduct;
  explanation?: string;
}) {
  if (!product) return null;

  return (
    <section className="glass rounded-lg p-6 shadow-glow">
      <div className="flex items-center gap-2 text-accent">
        <Sparkles size={18} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">SmartMerce Recommends</h2>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h3 className="text-3xl font-semibold text-ink">{product.name}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{explanation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {product.reasons.map((reason) => (
              <span key={reason} className="rounded-full border border-line bg-white/[0.04] px-3 py-1 text-xs text-muted">
                {reason}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 text-right">
          <div className="text-3xl font-semibold text-accent">{product.priceXsgd.toFixed(2)} XSGD</div>
          <div className="mt-2 flex items-center justify-end gap-2 text-amber">
            <Star size={16} fill="currentColor" />
            {product.rating.toFixed(1)}
          </div>
        </div>
      </div>
    </section>
  );
}
