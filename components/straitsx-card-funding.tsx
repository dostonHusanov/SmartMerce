"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, ShieldAlert, WalletCards, XCircle } from "lucide-react";
import { connectWallet, getChainId, getFujiAvaxBalance, getInjectedEthereum, shortAddress, switchToAvalancheFuji } from "@/lib/blockchain/avalanche";
import {
  createSignedPaymentPayload,
  encodePaymentSignature,
  getSandboxTypedData,
  getFujiXsgdBalance,
  prepareSandboxAuthorization,
  signSandboxX402Payment,
  type StraitsxSandboxRequirement,
  trustedStraitsxSandboxRequirement,
  validateTrustedSandboxRequirement,
} from "@/lib/straitsx/x402-sandbox";
import type { PurchaseAuthorization, RankedProduct } from "@/types";

const cardholderName = "Doston Husanov";
const approvedWalletAddress = "0x4E3c233F071343344E2d862C1660538B9824bF63";

type SigningStatus = "idle" | "validating" | "wrong_chain" | "awaiting_signature" | "submitting" | "issued" | "failed" | "rejected";

type ChallengeResponse = {
  requirement: StraitsxSandboxRequirement;
  x402Version: number;
};

type IssueCardResponse = {
  cardIssuance: "SUCCESS";
  card_opaque_id_present: boolean;
  settlement_tx: string;
  view_card_sandbox: "SUCCESS" | "FAILED";
  iframeUrl?: string;
};

type IssueCardFailure = {
  error?: string;
  providerCode?: string;
  status?: number;
  mismatches?: string[];
  details?: unknown;
};

type ExecutionReport = {
  walletSignature: "APPROVED" | "REJECTED";
  x402Submission: "SUCCESS" | "FAILED";
  settlement: "SUCCESS" | "FAILED";
  amount: string;
  network: string;
  remainingTestXsgd: string;
  settlementTx?: string;
  cardIssuance: "SUCCESS" | "FAILED";
  cardOpaqueId: "present" | "missing";
  viewCardSandbox: "SUCCESS" | "FAILED";
  secureIframe: "WORKING" | "NOT WORKING";
  failureReason?: string;
};

export function StraitsXCardFunding({
  authorization,
  product,
  onIssued,
}: {
  authorization?: PurchaseAuthorization;
  product?: RankedProduct;
  onIssued?: (input: {
    buyerWallet: `0x${string}`;
    settlementTx: string;
    cardReference: string;
  }) => Promise<void>;
}) {
  const [status, setStatus] = useState<SigningStatus>("idle");
  const [message, setMessage] = useState("Sandbox disposable card flow is ready for explicit wallet authorization.");
  const [wallet, setWallet] = useState<`0x${string}`>();
  const [fujiXsgd, setFujiXsgd] = useState<string>();
  const [fujiAvax, setFujiAvax] = useState<string>();
  const [challengeRequirement, setChallengeRequirement] = useState<StraitsxSandboxRequirement>();
  const [typedDataPreview, setTypedDataPreview] = useState<ReturnType<typeof getSandboxTypedData>>();
  const [iframeUrl, setIframeUrl] = useState<string>();
  const [report, setReport] = useState<ExecutionReport>();
  const [busy, setBusy] = useState(false);
  const [executionLocked, setExecutionLocked] = useState(false);
  const [orderConfirming, setOrderConfirming] = useState(false);

  if (!authorization || !product) return null;

  const activeAuthorization = authorization;
  const activeProduct = product;

  async function refreshBalances(address: `0x${string}`) {
    const [xsgd, avax] = await Promise.all([getFujiXsgdBalance(address), getFujiAvaxBalance(address)]);
    setFujiXsgd(xsgd.balance);
    setFujiAvax(avax);
    return { xsgd: xsgd.balance, avax };
  }

  async function fetchCurrentChallenge(address: `0x${string}`) {
    const response = await fetch("/api/straitsx/sandbox/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, cardholderName }),
    });
    const body = await response.json().catch(() => null) as (ChallengeResponse & { error?: string; mismatches?: string[] }) | null;
    if (!response.ok || !body?.requirement) {
      const mismatch = body?.mismatches?.length ? ` ${body.mismatches.join("; ")}` : "";
      throw new Error(`${body?.error ?? "Unable to validate StraitsX sandbox challenge."}${mismatch}`);
    }
    const validation = validateTrustedSandboxRequirement(body.requirement);
    if (!validation.valid) throw new Error(`Blocked StraitsX signing: ${validation.mismatches.join("; ")}`);
    setChallengeRequirement(body.requirement);
    return body.requirement;
  }

  function assertActivePurchaseAuthorization() {
    if (new Date(activeAuthorization.expiresAt).getTime() <= Date.now()) throw new Error("Purchase authorization expired.");
    if (activeAuthorization.productId !== activeProduct.id) throw new Error("Purchase authorization product mismatch.");
    if (activeAuthorization.merchantId !== activeProduct.merchantId) throw new Error("Purchase authorization merchant mismatch.");
  }

  function buildFailureReport(input: Partial<ExecutionReport> = {}): ExecutionReport {
    return {
      walletSignature: input.walletSignature ?? "REJECTED",
      x402Submission: input.x402Submission ?? "FAILED",
      settlement: input.settlement ?? "FAILED",
      amount: input.amount ?? `${trustedStraitsxSandboxRequirement.amount} base units`,
      network: input.network ?? trustedStraitsxSandboxRequirement.network,
      remainingTestXsgd: input.remainingTestXsgd ?? (fujiXsgd ? `${fujiXsgd} test XSGD` : "unknown"),
      settlementTx: input.settlementTx,
      cardIssuance: input.cardIssuance ?? "FAILED",
      cardOpaqueId: input.cardOpaqueId ?? "missing",
      viewCardSandbox: input.viewCardSandbox ?? "FAILED",
      secureIframe: input.secureIframe ?? "NOT WORKING",
      failureReason: input.failureReason,
    };
  }

  function formatIssueFailure(body: IssueCardFailure | null) {
    if (body?.providerCode === "STRAITSX_EMPTY_AMOUNT_ON_PAID_RETRY") {
      return "StraitsX sandbox returned HTTP 402 after the signed retry, but its returned x402 requirement had an empty amount. Wallet signature was approved; settlement/card issuance did not complete.";
    }
    const parts = [
      body?.error,
      body?.status ? `HTTP ${body.status}` : undefined,
      body?.mismatches?.length ? body.mismatches.join("; ") : undefined,
    ].filter(Boolean);
    return parts.join(" - ") || "StraitsX sandbox x402 submission failed.";
  }

  async function confirmIssuedCardOrder(input: {
    buyerWallet: `0x${string}`;
    settlementTx: string;
    issuedReport: ExecutionReport;
  }) {
    if (!onIssued) return;
    setOrderConfirming(true);
    setMessage("StraitsX sandbox card issued. Creating merchant order proof.");
    try {
      await onIssued({
        buyerWallet: input.buyerWallet,
        settlementTx: input.settlementTx,
        cardReference: `straitsx-sandbox:${input.settlementTx}`,
      });
      setReport({
        ...input.issuedReport,
        failureReason: undefined,
      });
    } catch (error) {
      const orderError = error instanceof Error ? error.message : "Merchant order confirmation failed.";
      setMessage(`StraitsX sandbox card issued, but merchant order confirmation failed: ${orderError}`);
      setReport({
        ...input.issuedReport,
        failureReason: orderError,
      });
    } finally {
      setOrderConfirming(false);
    }
  }

  async function authorizeXsgd() {
    setBusy(true);
    setStatus("validating");
    setMessage("Validating StraitsX sandbox x402 challenge before wallet signature.");
    setReport(undefined);
    setIframeUrl(undefined);
    let reportPrepared = false;

    try {
      assertActivePurchaseAuthorization();

      const provider = getInjectedEthereum();
      if (!provider) throw new Error("Core Wallet or MetaMask is required.");
      const connectedWallet = await connectWallet();
      if (connectedWallet.toLowerCase() !== approvedWalletAddress.toLowerCase()) {
        throw new Error(`Connected wallet mismatch. Expected ${approvedWalletAddress}, got ${connectedWallet}.`);
      }
      setWallet(connectedWallet);

      const requirement = await fetchCurrentChallenge(connectedWallet);
      if (requirement.amount !== trustedStraitsxSandboxRequirement.amount) {
        throw new Error(`amount expected ${trustedStraitsxSandboxRequirement.amount}, got ${requirement.amount}`);
      }

      const chainId = await getChainId(provider);
      if (chainId !== trustedStraitsxSandboxRequirement.chainId) {
        setStatus("wrong_chain");
        setMessage("Switch to Avalanche Fuji, then click AUTHORIZE 5 XSGD again.");
        return;
      }

      const balances = await refreshBalances(connectedWallet);
      if (Number(balances.xsgd) < 5) throw new Error("TESTNET XSGD REQUIRED: wallet balance is below 5 test XSGD.");
      if (Number(balances.avax) <= 0) throw new Error("Fuji AVAX is required for wallet/network operations.");

      const paymentAuthorization = prepareSandboxAuthorization({ from: connectedWallet, requirement });
      if (Number(paymentAuthorization.validBefore) <= Math.floor(Date.now() / 1000)) throw new Error("EIP-3009 authorization expired before signing.");
      const typedData = getSandboxTypedData(paymentAuthorization);
      setTypedDataPreview(typedData);
      setExecutionLocked(true);

      setStatus("awaiting_signature");
      setMessage("Wallet signature requested. This authorizes 5 sandbox XSGD for StraitsX card funding.");
      let signature: `0x${string}`;
      try {
        signature = await signSandboxX402Payment({
          provider,
          walletAddress: connectedWallet,
          authorization: paymentAuthorization,
        });
      } catch (error) {
        setStatus("rejected");
        const remaining = await refreshBalances(connectedWallet).catch(() => balances);
        setReport(buildFailureReport({
          walletSignature: "REJECTED",
          remainingTestXsgd: `${remaining.xsgd} test XSGD`,
        }));
        throw error;
      }

      const paymentPayload = createSignedPaymentPayload({
        authorization: paymentAuthorization,
        requirement,
        signature,
      });
      const paymentSignature = encodePaymentSignature(paymentPayload);
      setStatus("submitting");
      setMessage("Submitting signed x402 payment to the exact StraitsX sandbox Card API once.");

      const issueResponse = await fetch("/api/straitsx/sandbox/issue-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: connectedWallet,
          cardholderName,
          paymentSignature,
        }),
      });
      const issueBody = await issueResponse.json().catch(() => null) as (IssueCardResponse & IssueCardFailure) | null;
      const remaining = await refreshBalances(connectedWallet).catch(() => balances);

      if (!issueResponse.ok || !issueBody || issueBody.cardIssuance !== "SUCCESS") {
        const failureReason = formatIssueFailure(issueBody);
        setReport(buildFailureReport({
          walletSignature: "APPROVED",
          x402Submission: "FAILED",
          remainingTestXsgd: `${remaining.xsgd} test XSGD`,
          failureReason,
        }));
        reportPrepared = true;
        throw new Error(failureReason);
      }

      setIframeUrl(issueBody.iframeUrl);
      const issuedReport: ExecutionReport = {
        walletSignature: "APPROVED",
        x402Submission: "SUCCESS",
        settlement: issueBody.settlement_tx ? "SUCCESS" : "FAILED",
        amount: `${requirement.amount} base units / 5 XSGD`,
        network: requirement.network,
        remainingTestXsgd: `${remaining.xsgd} test XSGD`,
        settlementTx: issueBody.settlement_tx,
        cardIssuance: "SUCCESS",
        cardOpaqueId: issueBody.card_opaque_id_present ? "present" : "missing",
        viewCardSandbox: issueBody.view_card_sandbox,
        secureIframe: issueBody.iframeUrl ? "WORKING" : "NOT WORKING",
      };
      setReport(issuedReport);
      reportPrepared = true;
      setStatus("issued");
      setMessage(issueBody.iframeUrl
        ? "StraitsX sandbox card issued. Secure iframe URL loaded without exposing raw card HTML."
        : "StraitsX sandbox card issued, but the secure iframe URL was not returned.");

      if (onIssued) {
        await confirmIssuedCardOrder({
          buyerWallet: connectedWallet,
          settlementTx: issueBody.settlement_tx,
          issuedReport,
        });
      }
    } catch (error) {
      setStatus((current) => current === "rejected" ? "rejected" : "failed");
      setMessage(error instanceof Error ? error.message : "StraitsX x402 signing failed.");
      if (!reportPrepared) setReport(buildFailureReport({
        failureReason: error instanceof Error ? error.message : "StraitsX x402 signing failed.",
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <CreditCard size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">StraitsX Card Funding</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "issued" ? "bg-accent text-background" : status === "failed" || status === "rejected" ? "bg-red-300 text-background" : "bg-background text-accent"}`}>
          {status.replace("_", " ").toUpperCase()}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Sandbox / TEST" value="No Mainnet funds" />
        <Fact label="Card value" value="SGD 5" />
        <Fact label="Payment" value="5 XSGD" />
        <Fact label="Network" value="Avalanche Fuji" />
        <Fact label="Authorization" value="EIP-3009" />
        <Fact label="Protocol" value="x402 v1" />
        <Fact label="Chain" value="43113" />
        <Fact label="Wallet" value={wallet ? shortAddress(wallet) : "Connect on authorize"} />
        <Fact label="Available" value={fujiXsgd ? `${fujiXsgd} test XSGD` : "30 test XSGD expected"} />
      </div>

      <div className="mt-5 rounded-lg border border-line bg-black/20 p-4 text-xs leading-6 text-muted">
        <div className="font-semibold uppercase tracking-[0.14em] text-ink">Final confirmation</div>
        <div>Environment: StraitsX Sandbox / TEST</div>
        <div>Amount: 5 XSGD ({challengeRequirement?.amount ?? trustedStraitsxSandboxRequirement.amount} base units)</div>
        <div>Network: Avalanche Fuji, chain {trustedStraitsxSandboxRequirement.chainId}</div>
        <div>Recipient: {challengeRequirement?.payTo ?? trustedStraitsxSandboxRequirement.payTo}</div>
        <div>XSGD token: {challengeRequirement?.asset ?? trustedStraitsxSandboxRequirement.asset}</div>
        <div>Card value: SGD 5</div>
        <div>Authorization: EIP-3009 TransferWithAuthorization</div>
        <div>Mainnet: no Mainnet XSGD, AVAX, or chain 43114 funds are involved</div>
        <div>Expiry: now + {challengeRequirement?.maxTimeoutSeconds ?? trustedStraitsxSandboxRequirement.maxTimeoutSeconds} seconds</div>
        {fujiAvax ? <div>Fuji AVAX: {Number(fujiAvax).toFixed(6)}</div> : null}
      </div>

      {status === "wrong_chain" ? (
        <button
          onClick={() => {
            void switchToAvalancheFuji();
          }}
          className="focus-ring mt-5 w-full rounded-lg bg-amber px-4 py-3 text-sm font-bold text-background"
        >
          SWITCH TO AVALANCHE FUJI
        </button>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => {
            setStatus("idle");
            setMessage(executionLocked ? "StraitsX sandbox card funding stopped. The approved one-attempt execution has already reached the signature step." : "StraitsX sandbox card funding cancelled. No signature was requested.");
            setTypedDataPreview(undefined);
            setChallengeRequirement(undefined);
            setIframeUrl(undefined);
            setReport(undefined);
          }}
          className="focus-ring rounded-lg border border-line px-5 py-4 text-sm font-bold uppercase tracking-[0.16em] text-ink"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            void authorizeXsgd();
          }}
          disabled={busy || executionLocked}
          className="focus-ring flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-4 text-sm font-bold uppercase tracking-[0.16em] text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <WalletCards size={18} />}
          {executionLocked ? "ONE ATTEMPT USED" : "AUTHORIZE 5 XSGD"}
        </button>
      </div>

      {typedDataPreview ? (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CheckCircle2 size={16} className="text-accent" />
            Typed data prepared
          </div>
          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-black/30 p-3 text-xs text-muted">
            {JSON.stringify(typedDataPreview, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)}
          </pre>
        </div>
      ) : null}

      {iframeUrl ? (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ExternalLink size={16} className="text-accent" />
            Secure sandbox card iframe
          </div>
          <iframe
            title="StraitsX sandbox card"
            src={iframeUrl}
            className="mt-3 h-[520px] w-full rounded-md border border-line bg-black/30"
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}

      {report ? (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            {report.cardIssuance === "SUCCESS" ? <CheckCircle2 size={16} className="text-accent" /> : <XCircle size={16} className="text-red-300" />}
            STRAITSX SANDBOX EXECUTION
          </div>
          <div className="mt-3 grid gap-2 text-xs leading-6 text-muted sm:grid-cols-2">
            <Fact label="Wallet signature" value={report.walletSignature} />
            <Fact label="x402 submission" value={report.x402Submission} />
            <Fact label="Settlement" value={report.settlement} />
            <Fact label="Amount" value={report.amount} />
            <Fact label="Network" value={report.network} />
            <Fact label="Remaining test XSGD" value={report.remainingTestXsgd} />
            <Fact label="settlement_tx" value={report.settlementTx ?? "missing"} />
            <Fact label="Card issuance" value={report.cardIssuance} />
            <Fact label="card_opaque_id" value={report.cardOpaqueId} />
            <Fact label="view_card_sandbox" value={report.viewCardSandbox} />
            <Fact label="Secure iframe" value={report.secureIframe} />
          </div>
          {report.failureReason ? (
            <div className="mt-3 rounded-md border border-red-300/30 bg-red-300/10 p-3 text-xs leading-5 text-red-100">
              {report.failureReason}
            </div>
          ) : null}
          {report.cardIssuance === "SUCCESS" && report.failureReason && report.settlementTx && wallet && onIssued ? (
            <button
              onClick={() => {
                void confirmIssuedCardOrder({
                  buyerWallet: wallet,
                  settlementTx: report.settlementTx ?? "",
                  issuedReport: report,
                });
              }}
              disabled={orderConfirming}
              className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-background disabled:cursor-not-allowed disabled:opacity-70"
            >
              {orderConfirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Confirm Merchant Order
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-line bg-black/20 p-4 text-xs leading-6 text-muted">
        <ShieldAlert size={16} className="mt-0.5 text-amber" />
        One sandbox attempt only. SmartMerce does not display raw card HTML, full card number, CVV, or wallet signatures.
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-black/20 p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
