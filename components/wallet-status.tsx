"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, WalletCards } from "lucide-react";
import { avalancheNetworkConfig, connectWallet, discoverInjectedEthereumProvider, getAvaxBalance, getChainId, getInjectedEthereum, getInjectedWalletDiagnostics, shortAddress, switchToAvalanche } from "@/lib/blockchain/avalanche";
import { getConfiguredMerchantWallet, getConfiguredXsgdContract, getXsgdBalance, getXsgdDecimals } from "@/lib/blockchain/xsgd";
import type { WalletSnapshot } from "@/types";

export function WalletStatus({ compact = false }: { compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>({
    connected: false,
    xsgdConfigured: Boolean(process.env.NEXT_PUBLIC_XSGD_CONTRACT),
    merchantWalletConfigured: Boolean(process.env.NEXT_PUBLIC_MERCHANT_WALLET),
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (address?: `0x${string}`) => {
    const provider = await discoverInjectedEthereumProvider(300);
    if (!provider) {
      setSnapshot((current) => ({ ...current, connected: false }));
      return;
    }

    const accounts = address ? [address] : await provider.request<`0x${string}`[]>({ method: "eth_accounts" });
    if (!accounts[0]) {
      setSnapshot({
        connected: false,
        xsgdConfigured: Boolean(getConfiguredXsgdContract()),
        merchantWalletConfigured: Boolean(getConfiguredMerchantWallet()),
      });
      return;
    }

    const chainId = await getChainId(provider);
    const [avaxBalance, xsgdDecimals, xsgdBalance] = await Promise.all([
      getAvaxBalance(accounts[0], provider).catch(() => undefined),
      getConfiguredXsgdContract() ? getXsgdDecimals(provider).catch(() => undefined) : Promise.resolve(undefined),
      getConfiguredXsgdContract() ? getXsgdBalance(accounts[0], provider).catch(() => undefined) : Promise.resolve(undefined),
    ]);

    setSnapshot({
      connected: true,
      address: accounts[0],
      chainId,
      networkName: chainId === avalancheNetworkConfig.chainId ? "Avalanche C-Chain" : `Chain ${chainId}`,
      avaxBalance,
      xsgdBalance,
      xsgdDecimals,
      xsgdConfigured: Boolean(getConfiguredXsgdContract()),
      merchantWalletConfigured: Boolean(getConfiguredMerchantWallet()),
    });
  }, []);

  useEffect(() => {
    void refresh();
    const provider = getInjectedEthereum();
    if (!provider?.on) return;
    const handleAccounts = (...args: unknown[]) => void refresh((args[0] as `0x${string}`[] | undefined)?.[0]);
    const handleChain = () => void refresh();
    provider.on("accountsChanged", handleAccounts);
    provider.on("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [refresh]);

  async function handleConnect() {
    setLoading(true);
    setSnapshot((current) => ({ ...current, error: undefined }));
    try {
      const provider = await discoverInjectedEthereumProvider();
      const currentHost = typeof window === "undefined" ? "this SmartMerce site" : window.location.host;
      if (!provider) throw new Error(`No injected wallet detected. Detected providers: ${getInjectedWalletDiagnostics()}. Open SmartMerce in the browser profile where Bitget is installed, unlock Bitget, allow it on ${currentHost}, then refresh.`);
      const address = await connectWallet(provider);
      await refresh(address);
    } catch (error) {
      setSnapshot((current) => ({ ...current, error: error instanceof Error ? error.message : "Wallet connection failed." }));
    } finally {
      setLoading(false);
    }
  }

  if (!snapshot.connected) {
    const button = (
      <button
        onClick={() => {
          void handleConnect();
        }}
        disabled={loading}
        className="focus-ring flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <WalletCards size={16} />}
        {loading ? "CONNECTING..." : "CONNECT WALLET"}
      </button>
    );

    if (compact) {
      return (
        <div className="relative">
          {button}
          {snapshot.error ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-md border border-red-300/30 bg-background px-3 py-2 text-xs leading-5 text-red-200 shadow-xl">
              {snapshot.error}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <section className="glass rounded-lg p-5">
        {button}
        {snapshot.error ? <div className="mt-3 rounded-md border border-red-300/30 bg-red-300/10 px-3 py-2 text-xs leading-5 text-red-200">{snapshot.error}</div> : null}
      </section>
    );
  }

  if (compact) {
    return (
      <div className="hidden items-center gap-3 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-xs text-muted md:flex">
        <span className="text-accent">{snapshot.xsgdBalance ?? "XSGD config required"} XSGD</span>
        <span>{snapshot.avaxBalance ? `${Number(snapshot.avaxBalance).toFixed(4)} AVAX` : "AVAX unavailable"}</span>
        <span>{shortAddress(snapshot.address)}</span>
      </div>
    );
  }

  return (
    <section className="glass rounded-lg p-5">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Info label="XSGD Balance" value={snapshot.xsgdConfigured ? snapshot.xsgdBalance ?? "Unable to read" : "Official XSGD Mainnet contract configuration required."} />
        <Info label="AVAX Balance" value={snapshot.avaxBalance ? `${Number(snapshot.avaxBalance).toFixed(5)} AVAX` : "Unable to read"} />
        <Info label="Network" value={snapshot.networkName ?? "Unknown"} />
        <Info label="Address" value={shortAddress(snapshot.address)} />
      </div>
      {snapshot.chainId !== avalancheNetworkConfig.chainId ? (
        <button
          onClick={() => {
            void switchToAvalanche().then(() => refresh());
          }}
          className="focus-ring mt-4 w-full rounded-lg bg-amber px-4 py-3 text-sm font-bold text-background"
        >
          SWITCH NETWORK
        </button>
      ) : null}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white/[0.03] p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
