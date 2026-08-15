import Image from "next/image";
import { CheckCircle2, ExternalLink, Star, Truck } from "lucide-react";
import type { RankedProduct } from "@/types";

export function ProductCard({ product, selected }: { product: RankedProduct; selected?: boolean }) {
  return (
    <article className={`glass flex h-full flex-col overflow-hidden rounded-lg transition hover:border-accent/30 ${selected ? "ring-1 ring-accent/60" : ""}`}>
      <div className="relative aspect-[16/11] bg-black/30">
        <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        {selected ? (
          <div className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-background">
            AI RECOMMENDED
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col space-y-4 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{product.merchant}</p>
            {product.source === "internet" ? (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Live web
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{product.name}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{product.description}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xl font-semibold text-accent">{product.priceXsgd.toFixed(2)} XSGD</span>
          <span className="flex items-center gap-1 text-amber">
            <Star size={15} fill="currentColor" />
            {product.rating.toFixed(1)}
          </span>
          <span className="text-muted">{product.reviewCount} reviews</span>
        </div>
        <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
          <span className="flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-2">
            <Truck size={14} />
            {product.shippingEstimate}
          </span>
          <span className="flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-2">
            <CheckCircle2 size={14} className={product.inStock ? "text-accent" : "text-red-300"} />
            {product.inStock ? `${product.inventory} in stock` : "Out of stock"}
          </span>
        </div>
        {product.sourceUrl ? (
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-white/[0.04] px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent/40"
          >
            View source listing
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
    </article>
  );
}
