# StraitsX Sandbox MCP Tools

Discovery URL: `https://card.straitsx.ai/sandbox/sse`
Discovered at: `2026-08-15T05:40:21.247Z`

Only `tools/list` was called. No card issuance, transaction, or production endpoint was used.

## get_card_sandbox

SANDBOX/TESTING — issues a test virtual Visa card on Avalanche Fuji testnet (chain_id: 43113). Cards issued here CANNOT spend real money. Use this to develop and test your x402 payment flow before switching to production. No whitelist required. The returned payload contains the cardapi URL and x402 payment requirements. You must call the endpoint directly, handle the HTTP 402 challenge by signing an EIP-3009 TransferWithAuthorization for testnet XSGD, then retry with the PAYMENT-SIGNATURE header. On success cardapi returns: card_opaque_id, card_html, settlement_tx.

Required parameters:

- `wallet_address`
- `cardholder_name`
- `amount_sgd`

Input schema:

```json
{
  "type": "object",
  "properties": {
    "amount_sgd": {
      "type": "number",
      "description": "Card value in SGD (e.g. 15 for a $15 SGD prepaid card). Must be between 5 and 30."
    },
    "cardholder_name": {
      "type": "string",
      "description": "Name to print on the card (2-26 characters, letters and spaces only)."
    },
    "wallet_address": {
      "type": "string",
      "description": "Your Avalanche wallet address (0x...)"
    }
  },
  "required": [
    "wallet_address",
    "cardholder_name",
    "amount_sgd"
  ]
}
```

## view_card_sandbox

Returns a fresh one-time iframe URL for a previously issued SANDBOX card. Requires the card_opaque_id returned by the cardapi after successful issuance, and the wallet_address used to pay. Ownership is verified cryptographically.

Required parameters:

- `card_opaque_id`
- `settlement_tx`
- `wallet_address`

Input schema:

```json
{
  "type": "object",
  "properties": {
    "card_opaque_id": {
      "type": "string",
      "description": "Card opaque ID returned by cardapi after successful issuance."
    },
    "settlement_tx": {
      "type": "string",
      "description": "Settlement transaction hash returned by cardapi after successful issuance."
    },
    "wallet_address": {
      "type": "string",
      "description": "The Avalanche wallet address that paid for this card."
    }
  },
  "required": [
    "card_opaque_id",
    "settlement_tx",
    "wallet_address"
  ]
}
```
