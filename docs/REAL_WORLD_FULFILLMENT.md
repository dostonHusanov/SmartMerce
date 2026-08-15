# SmartMerce Real-World Fulfillment

SmartMerce creates an internal order only after payment proof is verified. To turn that confirmed order into a real merchant order, configure Shopify fulfillment.

## Shopify Setup

Required environment variables:

```env
NEXT_PUBLIC_FULFILLMENT_PROVIDER=shopify
FULFILLMENT_PROVIDER=shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_API_VERSION=2026-07
SHOPIFY_PRODUCT_VARIANT_MAP={"prod-ear-001":"gid://shopify/ProductVariant/1234567890"}
SHOPIFY_COMPLETE_DRAFT_ORDER=false
```

`SHOPIFY_PRODUCT_VARIANT_MAP` maps SmartMerce product IDs to Shopify ProductVariant GIDs. Keep `SHOPIFY_COMPLETE_DRAFT_ORDER=false` until the mapping, shipping address, inventory, and merchant process are verified.

When enabled, SmartMerce:

1. Requires delivery details before asking for a wallet signature.
2. Verifies the XSGD payment proof server-side.
3. Creates the SmartMerce order and reserves local catalogue inventory.
4. Creates a Shopify draft order for the mapped variant.
5. Optionally completes the draft order when `SHOPIFY_COMPLETE_DRAFT_ORDER=true`.

Never expose `SHOPIFY_ADMIN_ACCESS_TOKEN` in client code. It must stay server-side.
