import { ArrowDown, Brain, CheckCircle2, CreditCard, LockKeyhole, Network, Search, ShieldCheck, Store, User, WalletCards, type LucideIcon } from "lucide-react";

const intelligence = [
  ["DISCOVERY", "Trusted catalogue search", Search],
  ["COMPARISON", "Price, rating and value", Brain],
  ["RECOMMENDATION", "Explainable selection", CheckCircle2],
] satisfies Array<[string, string, LucideIcon]>;

const paymentRails = [
  ["STRAITSX CARD", "Sandbox MCP discovered Fuji testnet tools. Mainnet card issuance stays disabled until production tools and approval are verified.", CreditCard],
  ["DIRECT XSGD", "Mainnet ERC-20 transfer path using an injected wallet, official contract configuration and explicit signature.", WalletCards],
  ["X402", "Planned sponsor-aligned rail. Not implemented because no real protocol flow is wired yet.", Network],
] satisfies Array<[string, string, LucideIcon]>;

const securityBoundary = [
  "Deterministic policy engine",
  "Short-lived authorization",
  "Server-side payment validation",
  "Non-custodial wallet signing",
];

export default function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_430px] lg:items-end">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            SmartMerce architecture
          </div>
          <h1 className="text-5xl font-semibold leading-tight text-ink">The LLM recommends actions. Deterministic systems authorize money movement.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
            SmartMerce separates shopping intelligence from financial authority, then routes approved payments through controlled infrastructure.
          </p>
        </div>
        <div className="glass rounded-lg p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Security boundary</div>
          <div className="mt-4 grid gap-2">
            {securityBoundary.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-3 py-3 text-sm text-ink">
                <ShieldCheck size={16} className="text-accent" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass rounded-lg p-5 md:p-8">
        <div className="mx-auto max-w-5xl">
          <FlowNode icon={User} title="USER" text="States purchase intent and approves exact scoped spend." />
          <CenterArrow />
          <FlowNode icon={Brain} title="SMARTMERCE AI ORCHESTRATOR" text="Parses intent, plans tool calls and explains product choices without inventing catalogue facts." accent />

          <div className="my-4 grid gap-3 md:grid-cols-3">
            {intelligence.map(([title, text, Icon]) => (
              <FlowNode key={title} icon={Icon} title={title} text={text} compact />
            ))}
          </div>

          <CenterArrow />
          <div className="rounded-lg border border-accent/50 bg-accent/10 p-4 md:p-6">
            <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-accent">Security boundary</div>
            <div className="grid gap-4 md:grid-cols-3">
              <FlowNode icon={LockKeyhole} title="POLICY ENGINE" text="Budget, transaction limit, daily limit, merchant allowlist, stock and price checks." compact insideBoundary />
              <FlowNode icon={ShieldCheck} title="USER AUTHORIZATION" text="Five-minute authorization scoped to product, merchant and exact amount." compact insideBoundary />
              <FlowNode icon={CheckCircle2} title="PAYMENT VALIDATION" text="Server verifies product, authorization, merchant and proof before order creation." compact insideBoundary />
            </div>
          </div>

          <CenterArrow />
          <FlowNode icon={CreditCard} title="PAYMENT ORCHESTRATOR" text="Chooses a supported rail only after policy passes and the user explicitly authorizes." accent />
          <div className="my-4 grid gap-3 md:grid-cols-3">
            {paymentRails.map(([title, text, Icon]) => (
              <FlowNode key={title} icon={Icon} title={title} text={text} compact muted={title !== "DIRECT XSGD"} />
            ))}
          </div>

          <CenterArrow />
          <FlowNode icon={WalletCards} title="NON-CUSTODIAL WALLET" text="Core Wallet or MetaMask signs. SmartMerce never asks for or stores private keys." />
          <CenterArrow />
          <FlowNode icon={Network} title="XSGD ON AVALANCHE C-CHAIN" text="Mainnet target: chain ID 43114, native gas asset AVAX. Fuji is not used for final payment." />
          <CenterArrow />
          <FlowNode icon={Store} title="MERCHANT ORDER CONFIRMATION" text="Merchant console receives verified orders with payment proof when available." />
        </div>
      </section>
    </main>
  );
}

function CenterArrow() {
  return (
    <div className="flex justify-center py-3 text-muted">
      <ArrowDown />
    </div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  text,
  compact,
  accent,
  muted,
  insideBoundary,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  compact?: boolean;
  accent?: boolean;
  muted?: boolean;
  insideBoundary?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        accent
          ? "border-violet/40 bg-violet/10"
          : insideBoundary
            ? "border-accent/30 bg-black/20"
            : muted
              ? "border-amber/30 bg-amber/10"
              : "border-line bg-white/[0.04]"
      }`}
    >
      <div className={`flex ${compact ? "items-start" : "items-center"} gap-3`}>
        <Icon size={20} className={accent ? "text-violet" : muted ? "text-amber" : "text-accent"} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}
