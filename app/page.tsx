import { AgentCommand } from "@/components/agent-command";
import { Brain, CheckCircle2, CreditCard, LockKeyhole, PackageCheck, Search, ShieldCheck, Store, Truck, WalletCards, type LucideIcon } from "lucide-react";

const demoFlow = [
  ["Ask", "Tell the agent what you want", Brain],
  ["Find", "Search live store listings", Search],
  ["Compare", "Show the best options", CheckCircle2],
  ["Check", "Verify price and limits", ShieldCheck],
  ["Approve", "You confirm the exact spend", LockKeyhole],
  ["Pay", "Wallet sends XSGD", WalletCards],
  ["Order", "Store receives proof", Store],
] satisfies Array<[string, string, LucideIcon]>;

const pillars = [
  ["ASK NATURALLY", "Users can ask for everyday products in plain language.", Brain],
  ["STAY IN CONTROL", "The agent cannot spend until the user approves an exact amount.", ShieldCheck],
  ["READY FOR STORES", "Verified payments can hand off to a real merchant backend.", CreditCard],
] satisfies Array<[string, string, LucideIcon]>;

const commerceMetrics = [
  ["28", "merchant items"],
  ["4", "trusted merchants"],
  ["43114", "Avalanche C-Chain"],
  ["Shopify", "fulfillment-ready"],
];

const security = [
  "Non-custodial wallet signing",
  "Explicit user authorization",
  "Deterministic transaction limits",
  "Merchant allowlisting",
  "Server-side price verification",
  "Five-minute scoped authorization",
  "Avalanche C-Chain validation",
  "No private key exposure",
  "No arbitrary LLM transactions",
  "Payment and checkout verification",
];

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8">
      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-stretch">
        <div className="glass rounded-lg p-5 md:p-7">
          <div className="mb-5 flex flex-wrap gap-2">
            <div className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
              Shopper demo
            </div>
            <div className="inline-flex rounded-full border border-violet/30 bg-violet/10 px-4 py-2 text-sm font-medium text-violet">
              Mainnet XSGD ready
            </div>
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl md:text-6xl">
            Tell SmartMerce what to buy. It finds options and asks before paying.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            A simple shopping agent for real people: search live products, compare choices, approve the exact spend, then pay with XSGD.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {commerceMetrics.map(([value, label]) => (
              <div key={label} className="rounded-md border border-line bg-white/[0.035] p-4">
                <div className="text-2xl font-semibold text-ink">{value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-lg p-5">
          <div className="flex items-center gap-2 text-accent">
            <Truck size={18} />
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">What is real?</div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">
            SmartMerce can search live products and verify payments. Shipment happens only when a connected store confirms fulfillment.
          </p>
          <div className="mt-5 grid gap-2 text-sm">
            {[
              ["Products", "Live store results"],
              ["Payment", "Verified XSGD transfer"],
              ["Delivery", "Store integration ready"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-line bg-white/[0.04] px-3 py-3">
                <span className="text-muted">{label}</span>
                <span className="text-right font-semibold text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AgentCommand />

      <section className="glass mt-8 rounded-lg p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2 text-accent">
          <PackageCheck size={18} />
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">How a purchase works</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {demoFlow.map(([label, detail, Icon], index) => (
            <div key={label} className="relative rounded-md border border-line bg-white/[0.03] p-4">
              <Icon size={18} className="text-accent" />
              <div className="mt-3 text-sm font-semibold text-ink">{label}</div>
              <div className="mt-1 text-xs leading-5 text-muted">{detail}</div>
              {index < demoFlow.length - 1 ? (
                <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-accent/40 md:block" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass rounded-lg p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Why SmartMerce</div>
          <div className="mt-6 grid gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-ink">Today</h2>
              <p className="mt-2 text-sm leading-6 text-muted">AI usually only recommends products.</p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-ink">SmartMerce</h2>
              <p className="mt-2 text-sm leading-6 text-muted">SmartMerce helps complete the purchase with user approval and payment proof.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map(([title, text, Icon]) => (
            <article key={title} className="glass rounded-lg p-5">
              <Icon size={20} className="text-violet" />
              <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glass mt-6 rounded-lg p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Security boundary</div>
            <h2 className="mt-3 text-3xl font-semibold text-ink">The AI can search, but only the user can approve payment.</h2>
          </div>
          <div className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Deterministic controls
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {security.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-md border border-line bg-white/[0.03] px-3 py-3 text-sm text-muted">
              <CheckCircle2 size={15} className="shrink-0 text-accent" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
