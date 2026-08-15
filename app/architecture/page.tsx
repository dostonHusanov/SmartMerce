import { Brain, CheckCircle2, CreditCard, LockKeyhole, Search, ShieldCheck, Store, WalletCards, type LucideIcon } from "lucide-react";

const shopperSteps = [
  ["1", "Ask for a product", "Type a normal request like: buy me a phone case under 10 XSGD.", Brain],
  ["2", "SmartMerce searches stores", "The agent looks through live product listings and keeps results inside your budget.", Search],
  ["3", "Compare the best options", "Products are ranked by price, rating, availability and your preferences.", CheckCircle2],
  ["4", "Approve the exact spend", "You review one product, one store and one amount before anything can happen.", LockKeyhole],
  ["5", "Pay with XSGD", "Your wallet asks for confirmation. SmartMerce never gets your private key.", WalletCards],
  ["6", "Store gets proof", "After payment is verified, the store can create an order or fulfillment record.", Store],
] satisfies Array<[string, string, string, LucideIcon]>;

const judgeSignals = [
  ["AI discovery", "Open-ended product requests become live store results."],
  ["User control", "The shopper approves the exact product and amount."],
  ["Mainnet payment", "The payment path is built around XSGD on Avalanche C-Chain."],
  ["Store proof", "Orders appear only after payment proof is verified."],
];

const safety = [
  "The AI can search and recommend, but it cannot spend by itself.",
  "Every payment needs a wallet confirmation from the user.",
  "SmartMerce checks price, stock, merchant and spending limits first.",
  "No fake transaction hashes are shown in the store dashboard.",
];

export default function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rounded-lg p-5 md:p-7">
          <div className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            How it works
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            SmartMerce turns a shopping request into a safe XSGD checkout.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            The shopper speaks naturally. The agent searches and compares products. The user approves. The wallet pays. The store receives verified proof.
          </p>
        </div>

        <aside className="glass rounded-lg p-5">
          <div className="flex items-center gap-2 text-accent">
            <ShieldCheck size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Simple rule</h2>
          </div>
          <p className="mt-4 text-2xl font-semibold leading-snug text-ink">
            The AI can choose. Only the user can pay.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            That is the product boundary judges should remember.
          </p>
        </aside>
      </section>

      <section className="glass rounded-lg p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Shopper journey</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Six steps from request to verified order.</p>
          </div>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">No developer knowledge needed</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shopperSteps.map(([number, title, text, Icon]) => (
            <StepCard key={number} number={number} title={title} text={text} icon={Icon} />
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="glass rounded-lg p-5 md:p-6">
          <div className="flex items-center gap-2 text-accent">
            <CreditCard size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Payment boundary</h2>
          </div>
          <div className="mt-5 space-y-3">
            {safety.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-md border border-line bg-white/[0.03] p-4 text-sm leading-6 text-muted">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-lg p-5 md:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">What judges should notice</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {judgeSignals.map(([title, text]) => (
              <div key={title} className="rounded-md border border-line bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-ink">{title}</div>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function StepCard({
  number,
  title,
  text,
  icon: Icon,
}: {
  number: string;
  title: string;
  text: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-lg border border-line bg-white/[0.035] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-background">
          {number}
        </div>
        <Icon size={20} className="text-accent" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
    </article>
  );
}
