"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, X } from "lucide-react";
import type { PolicyResult, PurchaseAuthorization, RankedProduct } from "@/types";

const maxTransactionXsgd = process.env.NEXT_PUBLIC_MAX_TRANSACTION_XSGD?.trim() || "60";

export function PurchaseAuthorization({
  product,
  policy,
  onAuthorize,
  authorization,
}: {
  product?: RankedProduct;
  policy?: PolicyResult;
  onAuthorize: () => Promise<void>;
  authorization?: PurchaseAuthorization;
}) {
  if (!product || !policy?.allowed) return null;

  if (authorization) {
    return (
      <section className="glass rounded-lg border-accent/40 p-6">
        <div className="flex items-center gap-3 text-accent">
          <ShieldCheck size={22} />
          <h2 className="text-lg font-semibold">PURCHASE AUTHORIZED</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          You approved this exact product and amount. The next step is the wallet payment confirmation.
        </p>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-white/[0.04] p-3">
            <span className="text-muted">Authorization</span>
            <div className="mt-1 font-mono text-xs text-ink">{authorization.id}</div>
          </div>
          <div className="rounded-md bg-white/[0.04] p-3">
            <span className="text-muted">Expires</span>
            <div className="mt-1 text-ink">{new Date(authorization.expiresAt).toLocaleTimeString()}</div>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-medium text-amber">
          READY FOR WALLET PAYMENT
        </div>
      </section>
    );
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="focus-ring w-full rounded-lg bg-accent px-5 py-4 text-sm font-bold uppercase tracking-[0.16em] text-background transition hover:brightness-110">
          Approve This Product
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-ink">Approve This Purchase</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted">
                This approval is only for the product, store and amount shown below. It expires in 5 minutes.
              </Dialog.Description>
            </div>
            <Dialog.Close className="focus-ring rounded-full p-2 text-muted transition hover:bg-white/[0.06] hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <dl className="mt-6 grid gap-3 text-sm">
            {[
              ["Product", product.name],
              ["Merchant", product.merchant],
              ["Amount", `${product.priceXsgd.toFixed(2)} XSGD`],
              ["Network", "Avalanche C-Chain"],
              ["Max allowed", `${maxTransactionXsgd} XSGD`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md bg-white/[0.04] px-4 py-3">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 max-h-40 space-y-2 overflow-auto">
            {policy.checks.map((check) => (
              <div key={check.id} className="flex items-center gap-2 text-xs text-muted">
                <ShieldCheck size={14} className="text-accent" />
                {check.label}
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Dialog.Close className="focus-ring rounded-lg border border-line px-4 py-3 text-sm font-semibold text-ink">
              Not Now
            </Dialog.Close>
            <Dialog.Close
              onClick={() => {
                void onAuthorize();
              }}
              className="focus-ring rounded-lg bg-accent px-4 py-3 text-sm font-bold text-background"
            >
              Approve {product.priceXsgd.toFixed(2)} XSGD
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
