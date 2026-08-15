# X402 Signing Implementation

Status: implementation ready, payment not submitted.

No `PAYMENT-SIGNATURE` was sent to StraitsX during this implementation pass.

## Library / SDK Used

- Official `x402` package installed for reference.
- The package currently rejects the returned StraitsX CAIP-2 network string `eip155:43113` as unsupported in its high-level client helper.
- SmartMerce therefore implements the exact EIP-3009 payload using the official x402 package behavior and the captured StraitsX 402 challenge.
- Wallet signing uses `viem` `signTypedData` through the injected browser wallet.

## Trusted Sandbox Challenge

- x402 version: `1`
- scheme: `exact`
- network: `eip155:43113`
- chain ID: `43113`
- asset: `0xd769410dc8772695a7f55a304d2125320a65c2a5`
- payTo: `0x99a2B2962a6AC463FBe04664027Fdb3F68bd4Cc8`
- amount: `5000000`
- max timeout: `300`
- asset transfer method: `eip3009`
- token name: `XSGD`
- token version: `2`

Signing is blocked if any trusted challenge value differs.

## EIP-712 Domain

```json
{
  "name": "XSGD",
  "version": "2",
  "chainId": 43113,
  "verifyingContract": "0xd769410dc8772695a7f55a304d2125320a65c2a5"
}
```

## Typed Data Types

```json
{
  "TransferWithAuthorization": [
    { "name": "from", "type": "address" },
    { "name": "to", "type": "address" },
    { "name": "value", "type": "uint256" },
    { "name": "validAfter", "type": "uint256" },
    { "name": "validBefore", "type": "uint256" },
    { "name": "nonce", "type": "bytes32" }
  ]
}
```

## Message Fields

```json
{
  "from": "connected wallet",
  "to": "0x99a2B2962a6AC463FBe04664027Fdb3F68bd4Cc8",
  "value": "5000000",
  "validAfter": "now - 600 seconds",
  "validBefore": "now + 300 seconds",
  "nonce": "32 cryptographically random bytes as 0x-prefixed hex"
}
```

## Nonce Strategy

Nonce is generated locally with `crypto.getRandomValues(new Uint8Array(32))`.

`Math.random()` is not used.

## Validity Strategy

Matches the official `x402` package behavior:

- `validAfter = currentUnixSeconds - 600`
- `validBefore = currentUnixSeconds + maxTimeoutSeconds`

For this StraitsX challenge, `maxTimeoutSeconds = 300`.

## PAYMENT-SIGNATURE Envelope

The in-memory payload is:

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "eip155:43113",
  "accepted": {
    "scheme": "exact",
    "network": "eip155:43113",
    "amount": "5000000",
    "asset": "0xd769410dc8772695a7f55a304d2125320a65c2a5",
    "payTo": "0x99a2B2962a6AC463FBe04664027Fdb3F68bd4Cc8",
    "maxTimeoutSeconds": 300,
    "chainId": 43113,
    "extra": {
      "assetTransferMethod": "eip3009",
      "name": "XSGD",
      "version": "2"
    }
  },
  "payload": {
    "signature": "wallet EIP-712 signature",
    "authorization": {
      "from": "connected wallet",
      "to": "0x99a2B2962a6AC463FBe04664027Fdb3F68bd4Cc8",
      "value": "5000000",
      "validAfter": "string unix timestamp",
      "validBefore": "string unix timestamp",
      "nonce": "0x...32 bytes"
    }
  }
}
```

## Encoding

`PAYMENT-SIGNATURE` is prepared as base64-encoded JSON.

The actual header value is kept in memory only, not displayed and not persisted.

## Retry Request Format

Prepared but not sent:

```json
{
  "url": "https://card.straitsx.ai/sandbox/cardapi/issue_card",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "PAYMENT-SIGNATURE": "prepared in memory"
  },
  "body": {
    "amount_sgd": 5,
    "cardholder_name": "Doston Husanov",
    "wallet_address": "connected wallet"
  }
}
```

## Explicit Stops

SmartMerce does not:

- send `PAYMENT-SIGNATURE`
- settle 5 XSGD
- issue the card
- call `view_card_sandbox`
- call production MCP
- touch Mainnet XSGD or Mainnet AVAX
