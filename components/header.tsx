import Link from "next/link";
import { Cable } from "lucide-react";
import { WalletStatus } from "@/components/wallet-status";

export function Header() {
  const navItems = [
    ["Shopper", "/"],
    ["Orders", "/orders"],
    ["How it works", "/architecture"],
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:gap-6 md:py-4">
        <Link href="/" className="min-w-0">
          <div className="text-base font-semibold tracking-[0.08em] text-ink sm:text-lg">SMARTMERCE</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted sm:text-xs">AI Shopping Agent</div>
        </Link>
        <nav className="hidden items-center gap-2 rounded-full border border-line bg-white/[0.03] p-1 md:flex">
          {navItems.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full px-4 py-2 text-sm text-muted transition hover:bg-white/[0.06] hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 items-center justify-end gap-2 md:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3 py-2 text-xs font-medium text-violet md:flex">
            <Cable size={14} />
            Avalanche C-Chain
          </div>
          <WalletStatus compact />
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 md:hidden">
        {navItems.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="shrink-0 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm text-muted"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
