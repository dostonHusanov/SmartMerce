import { createPublicClient, custom, defineChain, formatEther, http, parseAbi, type Hash } from "viem";

const defaultAvalancheRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
const defaultAvalancheFujiRpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";

function envUrlOrDefault(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export const avalancheRpcUrl = envUrlOrDefault(process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL, defaultAvalancheRpcUrl);
export const avalancheFujiRpcUrl = envUrlOrDefault(process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL, defaultAvalancheFujiRpcUrl);

export const avalancheMainnet = defineChain({
  id: 43114,
  name: "Avalanche C-Chain",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: { http: [avalancheRpcUrl] },
  },
  blockExplorers: {
    default: { name: "SnowTrace", url: "https://snowtrace.io" },
  },
});

export const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: { http: [avalancheFujiRpcUrl] },
  },
  blockExplorers: {
    default: { name: "SnowTrace Testnet", url: "https://testnet.snowtrace.io" },
  },
});

export const avalancheNetworkConfig = {
  chainId: 43114,
  hexChainId: "0xA86A",
  name: "Avalanche C-Chain",
  nativeCurrency: {
    name: "AVAX",
    symbol: "AVAX",
    decimals: 18,
  },
  rpcUrl: avalancheRpcUrl,
  explorerBaseUrl: "https://snowtrace.io",
};

export const avalancheFujiNetworkConfig = {
  chainId: 43113,
  hexChainId: "0xA869",
  name: "Avalanche Fuji",
  nativeCurrency: {
    name: "AVAX",
    symbol: "AVAX",
    decimals: 18,
  },
  rpcUrl: avalancheFujiRpcUrl,
  explorerBaseUrl: "https://testnet.snowtrace.io",
};

export const erc20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>;
  enable?: () => Promise<`0x${string}`[]>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isAvalanche?: boolean;
  isBitKeep?: boolean;
  isBitget?: boolean;
  isCore?: boolean;
  isMetaMask?: boolean;
};

type Eip6963ProviderDetail = {
  info?: {
    name?: string;
    rdns?: string;
  };
  provider?: EthereumProvider;
};

function isPreferredProvider(provider: EthereumProvider, label = "") {
  const normalized = label.toLowerCase();
  return Boolean(
    provider.isAvalanche
      || provider.isCore
      || provider.isBitKeep
      || provider.isBitget
      || normalized.includes("bitget")
      || normalized.includes("bitkeep")
      || normalized.includes("core")
      || normalized.includes("metamask"),
  );
}

function getInjectedProviderCandidates() {
  if (typeof window === "undefined") return [];
  const globalWindow = window as typeof window & {
    avalanche?: EthereumProvider;
    bitget?: {
      ethereum?: EthereumProvider;
    };
    bitgetWallet?: EthereumProvider | { ethereum?: EthereumProvider };
    bitkeep?: {
      ethereum?: EthereumProvider;
      ethreum?: EthereumProvider;
    };
    ethereum?: EthereumProvider & { providers?: EthereumProvider[] };
    evmproviders?: Record<string, EthereumProvider>;
  };
  const candidates: Array<{ label: string; provider: EthereumProvider | undefined }> = [
    { label: "window.ethereum.providers", provider: globalWindow.ethereum?.providers?.find((provider) => isPreferredProvider(provider)) },
    { label: "window.avalanche", provider: globalWindow.avalanche },
    { label: "window.bitkeep.ethereum", provider: globalWindow.bitkeep?.ethereum },
    { label: "window.bitkeep.ethreum", provider: globalWindow.bitkeep?.ethreum },
    { label: "window.bitget.ethereum", provider: globalWindow.bitget?.ethereum },
    {
      label: "window.bitgetWallet",
      provider: globalWindow.bitgetWallet && "request" in globalWindow.bitgetWallet
        ? globalWindow.bitgetWallet
        : globalWindow.bitgetWallet?.ethereum,
    },
    { label: "window.ethereum", provider: globalWindow.ethereum },
  ];

  for (const [label, provider] of Object.entries(globalWindow.evmproviders ?? {})) {
    candidates.push({ label: `window.evmproviders.${label}`, provider });
  }

  return candidates;
}

export function getInjectedEthereum(): EthereumProvider | undefined {
  return getInjectedProviderCandidates().find((candidate) => candidate.provider)?.provider;
}

export function getInjectedWalletDiagnostics() {
  if (typeof window === "undefined") return "server-render";
  const found = getInjectedProviderCandidates()
    .filter((candidate) => candidate.provider)
    .map((candidate) => candidate.label);
  return found.length ? found.join(", ") : "none";
}

export async function discoverInjectedEthereumProvider(timeoutMs = 800) {
  const immediate = getInjectedEthereum();
  if (immediate) return immediate;
  if (typeof window === "undefined") return undefined;

  const announced: Eip6963ProviderDetail[] = [];
  const handleAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (detail?.provider) announced.push(detail);
  };

  window.addEventListener("eip6963:announceProvider", handleAnnouncement);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
  window.removeEventListener("eip6963:announceProvider", handleAnnouncement);

  return announced.find((detail) => isPreferredProvider(detail.provider!, `${detail.info?.name ?? ""} ${detail.info?.rdns ?? ""}`))?.provider
    ?? announced[0]?.provider
    ?? getInjectedEthereum();
}

export function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function createAvalanchePublicClient() {
  return createPublicClient({
    chain: avalancheMainnet,
    transport: http(avalancheNetworkConfig.rpcUrl),
  });
}

export function createAvalancheFujiPublicClient() {
  return createPublicClient({
    chain: avalancheFuji,
    transport: http(avalancheFujiNetworkConfig.rpcUrl),
  });
}

export function createWalletPublicClient(provider: EthereumProvider) {
  return createPublicClient({
    chain: avalancheMainnet,
    transport: custom(provider),
  });
}

export async function connectWallet(provider = getInjectedEthereum()) {
  if (!provider) throw new Error("Core Wallet or MetaMask is required.");
  const accounts = provider.request
    ? await provider.request<`0x${string}`[]>({ method: "eth_requestAccounts" })
    : await provider.enable?.();
  if (!accounts?.[0]) throw new Error("No wallet account was returned.");
  return accounts[0];
}

export async function disconnectWallet() {
  return undefined;
}

export async function getChainId(provider = getInjectedEthereum()) {
  if (!provider) throw new Error("Wallet is not connected.");
  const chainId = await provider.request<string>({ method: "eth_chainId" });
  return Number.parseInt(chainId, 16);
}

export async function switchToAvalanche(provider = getInjectedEthereum()) {
  if (!provider) throw new Error("Wallet is not connected.");
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: avalancheNetworkConfig.hexChainId }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: avalancheNetworkConfig.hexChainId,
          chainName: avalancheNetworkConfig.name,
          nativeCurrency: avalancheNetworkConfig.nativeCurrency,
          rpcUrls: [avalancheNetworkConfig.rpcUrl],
          blockExplorerUrls: [avalancheNetworkConfig.explorerBaseUrl],
        },
      ],
    });
  }
}

export async function switchToAvalancheFuji(provider = getInjectedEthereum()) {
  if (!provider) throw new Error("Wallet is not connected.");
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: avalancheFujiNetworkConfig.hexChainId }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: avalancheFujiNetworkConfig.hexChainId,
          chainName: avalancheFujiNetworkConfig.name,
          nativeCurrency: avalancheFujiNetworkConfig.nativeCurrency,
          rpcUrls: [avalancheFujiNetworkConfig.rpcUrl],
          blockExplorerUrls: [avalancheFujiNetworkConfig.explorerBaseUrl],
        },
      ],
    });
  }
}

export async function getAvaxBalance(address: `0x${string}`, provider = getInjectedEthereum()) {
  const client = provider ? createWalletPublicClient(provider) : createAvalanchePublicClient();
  const balance = await client.getBalance({ address });
  return formatEther(balance);
}

export async function getFujiAvaxBalance(address: `0x${string}`) {
  const balance = await createAvalancheFujiPublicClient().getBalance({ address });
  return formatEther(balance);
}

export async function waitForTransaction(hash: Hash) {
  const client = createAvalanchePublicClient();
  return client.waitForTransactionReceipt({ hash });
}

export async function verifyTransaction(hash: Hash) {
  const client = createAvalanchePublicClient();
  const receipt = await client.getTransactionReceipt({ hash });
  return {
    hash,
    confirmed: receipt.status === "success",
    reverted: receipt.status === "reverted",
    blockNumber: receipt.blockNumber,
  };
}

export function explorerTransactionUrl(hash: string) {
  return `${avalancheNetworkConfig.explorerBaseUrl}/tx/${hash}`;
}
