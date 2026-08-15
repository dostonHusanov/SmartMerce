"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, WalletCards } from "lucide-react";
import { avalancheNetworkConfig, connectWallet, explorerTransactionUrl, getAvaxBalance, getChainId, getInjectedEthereum, shortAddress, switchToAvalanche, waitForTransaction } from "@/lib/blockchain/avalanche";
import { getConfiguredMerchantWallet, getConfiguredXsgdContract, getXsgdBalance, sendXsgdTransfer, verifyXsgdTransferReceipt } from "@/lib/blockchain/xsgd";
import { StraitsXCardFunding } from "@/components/straitsx-card-funding";
import type { DeliveryInfo, Order, PaymentState, PurchaseAuthorization, RankedProduct } from "@/types";

const progressSteps = [
  "Prepare order",
  "Check safety",
  "Set payment",
  "Wallet approval",
  "Send payment",
  "Verify payment",
  "Confirm order",
];

export function PaymentFlow({
  authorization,
  product,
}: {
  authorization?: PurchaseAuthorization;
  product?: RankedProduct;
}) {
  const [state, setState] = useState<PaymentState>("IDLE");
  const [message, setMessage] = useState("Ready when you are. SmartMerce will ask your wallet before sending any XSGD.");
  const [hash, setHash] = useState<`0x${string}`>();
  const [order, setOrder] = useState<Order>();
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryInfo>({
    email: "",
    fullName: "",
    address1: "",
    city: "",
    province: "",
    country: "Singapore",
    zip: "",
  });

  if (!authorization || !product) return null;

  const xsgdContract = getConfiguredXsgdContract();
  const merchantWallet = getConfiguredMerchantWallet();
  const canPay = Boolean(xsgdContract && merchantWallet);
  const sandboxCardEnabled = process.env.NEXT_PUBLIC_ENABLE_STRAITSX_SANDBOX === "true";
  const fulfillmentProvider = process.env.NEXT_PUBLIC_FULFILLMENT_PROVIDER;
  const fulfillmentEnabled = fulfillmentProvider === "shopify";

  function deliveryReady() {
    if (!fulfillmentEnabled) return true;
    return Boolean(
      delivery.email.trim() &&
      delivery.fullName.trim() &&
      delivery.address1.trim() &&
      delivery.city.trim() &&
      delivery.country.trim() &&
      delivery.zip.trim(),
    );
  }

  async function executeDirectXsgd() {
    setBusy(true);
    setState("PREPARING");
    setMessage("Preparing your checkout.");

    try {
      if (!product || !authorization) throw new Error("Purchase authorization is required.");
      if (!xsgdContract) throw new Error("Official XSGD Mainnet contract configuration required.");
      if (!merchantWallet) throw new Error("Trusted merchant wallet configuration required.");
      if (!deliveryReady()) throw new Error("Delivery details are required before requesting a real-world order signature.");
      if (new Date(authorization.expiresAt).getTime() <= Date.now()) throw new Error("Expired authorization.");
      if (authorization.productId !== product.id) throw new Error("Authorization product mismatch.");
      if (Math.abs(authorization.exactAmount - product.priceXsgd) > 0.001) throw new Error("Authorization amount mismatch.");
      if (authorization.merchantId !== product.merchantId) throw new Error("Authorization merchant mismatch.");

      const provider = getInjectedEthereum();
      if (!provider) throw new Error("Core Wallet or MetaMask is required.");
      const buyerWallet = await connectWallet();

      setState("VALIDATING");
      setMessage("Checking network, XSGD balance and gas.");
      const chainId = await getChainId(provider);
      if (chainId !== avalancheNetworkConfig.chainId) {
        throw new Error("Switch to Avalanche C-Chain to continue.");
      }

      const [avax, xsgd] = await Promise.all([getAvaxBalance(buyerWallet, provider), getXsgdBalance(buyerWallet, provider)]);
      if (Number(xsgd) < product.priceXsgd) throw new Error("Insufficient XSGD balance.");
      if (Number(avax) <= 0) throw new Error("Insufficient AVAX available for gas.");

      const amountXsgd = product.priceXsgd.toFixed(2);
      const merchantIsBuyer = buyerWallet.toLowerCase() === merchantWallet.toLowerCase();
      setState("AWAITING_USER_SIGNATURE");
      setMessage(merchantIsBuyer
        ? "Your wallet will ask you to confirm. Because the merchant wallet is your own address, only gas is spent."
        : "Your wallet will ask you to confirm the XSGD payment.");
      const transactionHash = await sendXsgdTransfer({
        from: buyerWallet,
        to: merchantWallet,
        amountXsgd,
        provider,
      });
      setHash(transactionHash);

      setState("SUBMITTED");
      setMessage("Payment sent to Avalanche C-Chain Mainnet.");
      await waitForTransaction(transactionHash);

      setState("CONFIRMING");
      setMessage("Verifying the payment before creating the merchant order.");
      const verified = await verifyXsgdTransferReceipt({
        hash: transactionHash,
        from: buyerWallet,
        to: merchantWallet,
        amountXsgd,
      });
      if (!verified.confirmed) throw new Error("Transaction reverted.");
      if (!verified.matchedTransfer) throw new Error("XSGD transfer proof did not match the authorized buyer, merchant, token and amount.");

      const checkout = await fetch("/api/merchant/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          authorizationId: authorization.id,
          buyerWallet,
          paymentMethod: "direct-xsgd",
          transactionHash,
          delivery: fulfillmentEnabled ? delivery : undefined,
        }),
      });
      const payload = await checkout.json();
      if (!checkout.ok) throw new Error(payload.error ?? "Checkout verification failed.");

      setOrder(payload.order);
      setState("CONFIRMED");
      setMessage("Order confirmed after verified payment.");
    } catch (error) {
      setState("FAILED");
      setMessage(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmStraitsXCardOrder(input: {
    buyerWallet: `0x${string}`;
    settlementTx: string;
    cardReference: string;
  }) {
    if (!product || !authorization) throw new Error("Purchase authorization is required.");

    setState("CONFIRMING");
    setMessage("StraitsX sandbox card issued. Creating merchant order proof.");

    const transactionHash = /^0x[a-fA-F0-9]{64}$/.test(input.settlementTx)
      ? input.settlementTx as `0x${string}`
      : undefined;

    const checkout = await fetch("/api/merchant/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        authorizationId: authorization.id,
        buyerWallet: input.buyerWallet,
        paymentMethod: "straitsx-card",
        transactionHash,
        cardReference: input.cardReference,
        delivery: fulfillmentEnabled ? delivery : undefined,
        authorizationSnapshot: authorization,
      }),
    });
    const payload = await checkout.json();
    if (!checkout.ok) throw new Error(payload.error ?? "StraitsX card checkout verification failed.");

    setHash(transactionHash);
    setOrder(payload.order);
    setState("CONFIRMED");
    setMessage("Order confirmed after StraitsX sandbox card issuance.");
  }

  return (
    <section className="glass rounded-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Checkout</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${state === "CONFIRMED" ? "bg-accent text-background" : state === "FAILED" ? "bg-red-300 text-background" : "bg-violet/10 text-violet"}`}>
          {state}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-7">
        {progressSteps.map((label, index) => {
          const states: PaymentState[] = ["PREPARING", "VALIDATING", "PREPARING", "AWAITING_USER_SIGNATURE", "SUBMITTED", "CONFIRMING", "CONFIRMED"];
          const step = states[index];
          const active = state === step || (state === "IDLE" && index === 0);
          const done = state === "CONFIRMED" || states.indexOf(state) > index;
          return (
          <div key={`${label}-${index}`} className="rounded-md border border-line bg-white/[0.03] p-3 text-xs">
            <div className="flex items-center gap-2">
              {active && busy ? <Loader2 size={14} className="animate-spin text-violet" /> : done || active ? <CheckCircle2 size={14} className="text-accent" /> : <div className="h-3.5 w-3.5 rounded-full border border-muted" />}
              <span className="text-muted">{label}</span>
            </div>
          </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-[0.14em] text-muted">Real XSGD payment</div>
        <div className="mt-2 flex items-start gap-2 text-sm text-muted">
          <ShieldAlert size={16} className="mt-0.5 text-amber" />
          Uses Avalanche C-Chain Mainnet. SmartMerce will not request a wallet signature until the product, amount and merchant wallet are configured.
        </div>
      </div>

      {!fulfillmentEnabled ? (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4 text-sm leading-6 text-muted">
          Store fulfillment is not connected yet. Payments can be verified, and a Shopify order can be created once the fulfillment settings are added.
        </div>
      ) : null}

      {!canPay ? (
        <div className="mt-5 rounded-lg border border-amber/30 bg-amber/10 p-4 text-sm text-amber">
          {!xsgdContract ? "Official XSGD Mainnet contract configuration required. " : ""}
          {!merchantWallet ? "Trusted merchant wallet configuration required." : ""}
        </div>
      ) : null}

      {fulfillmentEnabled ? (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">Delivery details</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DeliveryInput
              label="Email"
              type="email"
              value={delivery.email}
              onChange={(email) => setDelivery((current) => ({ ...current, email }))}
            />
            <DeliveryInput
              label="Full name"
              value={delivery.fullName}
              onChange={(fullName) => setDelivery((current) => ({ ...current, fullName }))}
            />
            <DeliveryInput
              label="Address"
              value={delivery.address1}
              onChange={(address1) => setDelivery((current) => ({ ...current, address1 }))}
            />
            <DeliveryInput
              label="City"
              value={delivery.city}
              onChange={(city) => setDelivery((current) => ({ ...current, city }))}
            />
            <DeliveryInput
              label="State / province"
              value={delivery.province ?? ""}
              onChange={(province) => setDelivery((current) => ({ ...current, province }))}
            />
            <DeliveryInput
              label="Country"
              value={delivery.country}
              onChange={(country) => setDelivery((current) => ({ ...current, country }))}
            />
            <DeliveryInput
              label="Postal code"
              value={delivery.zip}
              onChange={(zip) => setDelivery((current) => ({ ...current, zip }))}
            />
          </div>
        </div>
      ) : null}

      {message === "Switch to Avalanche C-Chain to continue." ? (
        <button
          onClick={() => {
            void switchToAvalanche();
          }}
          className="focus-ring mt-5 w-full rounded-lg bg-amber px-4 py-3 text-sm font-bold text-background"
        >
          SWITCH NETWORK
        </button>
      ) : null}

      {state !== "CONFIRMED" ? (
        <button
          onClick={() => {
            void executeDirectXsgd();
          }}
          disabled={busy || !canPay}
          className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-4 text-sm font-bold uppercase tracking-[0.16em] text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <WalletCards size={18} />}
          Pay with XSGD
        </button>
      ) : null}

      {sandboxCardEnabled ? (
        <StraitsXCardFunding authorization={authorization} product={product} onIssued={confirmStraitsXCardOrder} />
      ) : (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4 text-sm leading-6 text-muted">
          Test-card mode is hidden for this mainnet demo.
        </div>
      )}

      {order ? (
        <div className="mt-5 rounded-lg border border-accent/40 bg-accent/10 p-5">
          <h3 className="text-lg font-semibold text-accent">PURCHASE COMPLETE</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <ReceiptItem label="Product" value={order.productName} />
            <ReceiptItem label="Amount" value={`${order.amountXsgd.toFixed(2)} XSGD`} />
            <ReceiptItem label="Payment" value={order.paymentMethod} />
            <ReceiptItem label="Network" value={order.paymentMethod === "straitsx-card" ? "Avalanche Fuji / StraitsX Sandbox" : "Avalanche C-Chain Mainnet"} />
            <ReceiptItem label="Order" value={order.id} />
            <ReceiptItem label="Status" value="CONFIRMED" />
            <ReceiptItem label="Fulfillment" value={order.fulfillmentStatus ?? "not_configured"} />
            {order.fulfillmentReference ? <ReceiptItem label="External order" value={order.fulfillmentReference} /> : null}
            {hash ? <ReceiptItem label="Transaction" value={shortAddress(hash)} /> : null}
          </dl>
          {order.fulfillmentError ? (
            <div className="mt-4 rounded-md border border-amber/30 bg-amber/10 p-3 text-sm text-amber">
              Fulfillment needs attention: {order.fulfillmentError}
            </div>
          ) : null}
          {hash ? (
            <a href={explorerTransactionUrl(hash)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet underline">
              VIEW ON EXPLORER
              <ExternalLink size={14} />
            </a>
          ) : null}
          {order.fulfillmentUrl ? (
            <a href={order.fulfillmentUrl} target="_blank" rel="noreferrer" className="ml-4 mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet underline">
              VIEW FULFILLMENT
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DeliveryInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-line bg-black/20 px-3 py-3 text-sm text-ink outline-none transition focus:border-accent"
      />
    </label>
  );
}

function ReceiptItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-black/20 p-3">
      <dt className="text-xs uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-2 break-words font-semibold text-ink">{value}</dd>
    </div>
  );
}
