import { createPublicClient, createWalletClient, custom, decodeEventLog, formatUnits, getAddress, isAddress, parseUnits, type Hash } from "viem";
import { erc20Abi, getInjectedEthereum, avalancheNetworkConfig, avalancheMainnet, createAvalanchePublicClient, type EthereumProvider } from "@/lib/blockchain/avalanche";

export const officialAvalancheXsgdContract = "0xb2F85b7AB3c2b6f62DF06dE6aE7D09c010a5096E";

export function getConfiguredXsgdContract() {
  const address = process.env.NEXT_PUBLIC_XSGD_CONTRACT?.trim()
    || process.env.NEXT_PUBLIC_XSGD_MAINNET_CONTRACT?.trim()
    || officialAvalancheXsgdContract;
  if (!address) return undefined;
  if (!isAddress(address)) return undefined;
  return getAddress(address);
}

export function getConfiguredMerchantWallet() {
  const address = process.env.NEXT_PUBLIC_MERCHANT_WALLET;
  if (!address) return undefined;
  if (!isAddress(address)) return undefined;
  return getAddress(address);
}

export async function getXsgdDecimals(provider = getInjectedEthereum()) {
  const contract = getConfiguredXsgdContract();
  if (!contract) throw new Error("Official XSGD Mainnet contract configuration required.");
  if (!provider) throw new Error("Wallet is not connected.");
  const client = createPublicClient({ chain: avalancheMainnet, transport: custom(provider) });
  return client.readContract({
    address: contract,
    abi: erc20Abi,
    functionName: "decimals",
  });
}

export async function getXsgdBalance(address: `0x${string}`, provider = getInjectedEthereum()) {
  const contract = getConfiguredXsgdContract();
  if (!contract) throw new Error("Official XSGD Mainnet contract configuration required.");
  if (!provider) throw new Error("Wallet is not connected.");
  const client = createPublicClient({ chain: avalancheMainnet, transport: custom(provider) });
  const [balance, decimals] = await Promise.all([
    client.readContract({ address: contract, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: contract, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return formatUnits(balance, decimals);
}

export async function prepareXsgdTransfer(input: {
  to: `0x${string}`;
  amountXsgd: string;
  provider?: EthereumProvider;
}) {
  const contract = getConfiguredXsgdContract();
  if (!contract) throw new Error("Official XSGD Mainnet contract configuration required.");
  const provider = input.provider ?? getInjectedEthereum();
  if (!provider) throw new Error("Wallet is not connected.");
  const chainId = await provider.request<string>({ method: "eth_chainId" });
  if (Number.parseInt(chainId, 16) !== avalancheNetworkConfig.chainId) {
    throw new Error("Switch to Avalanche C-Chain to continue.");
  }
  const decimals = await getXsgdDecimals(provider);
  return {
    contract,
    to: input.to,
    amount: parseUnits(input.amountXsgd, decimals),
    decimals,
  };
}

export async function sendXsgdTransfer(input: {
  from: `0x${string}`;
  to: `0x${string}`;
  amountXsgd: string;
  provider?: EthereumProvider;
}): Promise<Hash> {
  const provider = input.provider ?? getInjectedEthereum();
  if (!provider) throw new Error("Wallet is not connected.");
  const prepared = await prepareXsgdTransfer({ to: input.to, amountXsgd: input.amountXsgd, provider });
  const walletClient = createWalletClient({
    account: input.from,
    chain: avalancheMainnet,
    transport: custom(provider),
  });

  return walletClient.writeContract({
    address: prepared.contract,
    abi: erc20Abi,
    functionName: "transfer",
    args: [prepared.to, prepared.amount],
  });
}

export async function verifyXsgdTransferReceipt(input: {
  hash: Hash;
  from: `0x${string}`;
  to: `0x${string}`;
  amountXsgd: string;
}) {
  const contract = getConfiguredXsgdContract();
  if (!contract) throw new Error("Official XSGD Mainnet contract configuration required.");
  const client = createAvalanchePublicClient();
  const [receipt, decimals] = await Promise.all([
    client.getTransactionReceipt({ hash: input.hash }),
    client.readContract({
      address: contract,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);
  const expectedAmount = parseUnits(input.amountXsgd, decimals);
  const expectedFrom = getAddress(input.from);
  const expectedTo = getAddress(input.to);

  const matchedTransfer = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== contract.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") return false;
      return (
        decoded.args.from === expectedFrom &&
        decoded.args.to === expectedTo &&
        decoded.args.value === expectedAmount
      );
    } catch {
      return false;
    }
  });

  return {
    hash: input.hash,
    confirmed: receipt.status === "success",
    matchedTransfer,
    blockNumber: receipt.blockNumber,
    expectedAmount,
    expectedFrom,
    expectedTo,
    token: contract,
  };
}
