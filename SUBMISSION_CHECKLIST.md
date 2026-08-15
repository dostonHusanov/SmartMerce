# SmartMerce Submission Checklist

## Repository

- [ ] GitHub repository ready
- [ ] No secrets committed
- [ ] README finished
- [ ] Demo script finished
- [ ] Pitch document finished
- [ ] Architecture page ready
- [ ] Submission checklist reviewed

## Deployment

- [ ] Frontend URL live
- [ ] Architecture URL live
- [ ] Merchant page live
- [ ] API routes work in production
- [ ] No localhost dependencies
- [ ] Vercel environment variables configured

## Wallet and Network

- [ ] Wallet unlocked before presentation
- [ ] Wallet connects
- [ ] Chain `43114` detected
- [ ] Avalanche C-Chain visible in wallet
- [ ] Actual AVAX balance reads
- [ ] Actual XSGD balance reads
- [ ] Enough AVAX remains for gas
- [ ] Enough XSGD remains for demo purchase

## SmartMerce Flow

- [ ] Product discovery works
- [ ] Product comparison works
- [ ] Recommendation works
- [ ] Policy works
- [ ] Authorization works
- [ ] Payment tested if official configuration is present
- [ ] Checkout creates verified order
- [ ] Merchant dashboard shows order
- [ ] Transaction proof available where applicable

## StraitsX

- [ ] Sandbox MCP discovery saved
- [ ] StraitsX integration tested
- [ ] Production MCP only enabled if approved
- [ ] Card issuance only enabled if production tools and credentials are verified

## Demo Assets

- [ ] Demo video recorded
- [ ] Backup demo video available
- [ ] Architecture diagram URL available
- [ ] Wallet funded and unlocked before presentation
- [ ] Official XSGD contract configured
- [ ] Trusted merchant wallet configured

## Environment Variables

- [ ] `NEXT_PUBLIC_AVALANCHE_CHAIN_ID=43114`
- [ ] `NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc`
- [ ] `NEXT_PUBLIC_XSGD_CONTRACT=` verified official mainnet contract
- [ ] `NEXT_PUBLIC_MERCHANT_WALLET=` trusted merchant wallet
- [ ] `STRAITSX_CARD_ENV=sandbox`
- [ ] `STRAITSX_MCP_TOKEN` configured only if required

## Final QA

- [ ] Happy path
- [ ] Wallet disconnected
- [ ] Wrong network
- [ ] Budget exceeded
- [ ] Policy rejection
- [ ] Authorization expiration
- [ ] User cancels wallet transaction
- [ ] MCP unavailable
- [ ] Payment failure
- [ ] Product price changed
- [ ] Merchant mismatch
- [ ] API failure
- [ ] Mobile layout
- [ ] Desktop layout
