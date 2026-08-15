import { Activity, Boxes, Clock3, ReceiptText, WalletCards, type LucideIcon } from "lucide-react";
import { listProducts } from "@/lib/commerce/products";
import { listAuthorizations, listOrders } from "@/lib/merchant/orders";
import { explorerTransactionUrl, shortAddress } from "@/lib/blockchain/avalanche";

export const dynamic = "force-dynamic";

export default function MerchantPage() {
  const products = listProducts();
  const inStock = products.filter((product) => product.inStock).length;
  const orders = listOrders();
  const authorizations = listAuthorizations();
  const revenueXsgd = orders.filter((order) => order.status === "confirmed" || order.status === "paid").reduce((sum, order) => sum + order.amountXsgd, 0);
  const aiPurchases = orders.length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            SMARTMERCE MERCHANT CONSOLE
          </div>
          <h1 className="text-4xl font-semibold text-ink">Orders, catalogue and AI purchase activity</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Merchant-side verification for agent-originated purchases. Orders only appear after SmartMerce verifies authorization and payment proof.
          </p>
        </div>
        <div className="glass rounded-lg p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Recent transactions</div>
          <div className="mt-3 text-3xl font-semibold text-accent">{orders.length}</div>
          <p className="mt-2 text-sm text-muted">No fabricated transactions are displayed. Blockchain hashes appear only after real payment proof exists.</p>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {([
          ["Products", products.length, Boxes],
          ["Revenue XSGD", Number(revenueXsgd.toFixed(2)), WalletCards],
          ["AI purchases", aiPurchases, ReceiptText],
          ["Pending authorizations", authorizations.length, Clock3],
        ] satisfies Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
          <section key={String(label)} className="glass rounded-lg p-5">
            <Icon className="text-accent" size={20} />
            <div className="mt-4 text-3xl font-semibold text-ink">{String(value)}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{String(label)}</div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="glass overflow-hidden rounded-lg">
          <div className="border-b border-line p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Products</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Price</th>
                  <th className="px-5 py-4">Inventory</th>
                  <th className="px-5 py-4">Merchant</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((product) => (
                  <tr key={product.id} className="text-ink">
                    <td className="px-5 py-4">
                      <div className="font-medium">{product.name}</div>
                      <div className="mt-1 text-xs text-muted">{product.sku}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-accent">{product.priceXsgd.toFixed(2)} XSGD</td>
                    <td className="px-5 py-4">{product.inventory}</td>
                    <td className="px-5 py-4 text-muted">{product.merchant}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${product.inStock ? "bg-accent/10 text-accent" : "bg-red-300/10 text-red-300"}`}>
                        {product.inStock ? "Active" : "Out of stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="glass rounded-lg p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Pending Authorizations</h2>
            <div className="mt-5 space-y-3">
              {authorizations.length ? (
                authorizations.slice(0, 4).map((authorization) => (
                  <div key={authorization.id} className="rounded-md border border-line bg-white/[0.03] p-4 text-sm">
                    <div className="font-mono text-xs text-muted">{authorization.id}</div>
                    <div className="mt-2 font-semibold text-accent">{authorization.exactAmount.toFixed(2)} XSGD</div>
                    <div className="mt-1 text-xs text-muted">Expires {new Date(authorization.expiresAt).toLocaleTimeString()}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-line bg-white/[0.03] p-4 text-sm text-muted">
                  Authorizations appear here after user approval. Payment execution requires a separate explicit action.
                </div>
              )}
            </div>
          </section>
          <section className="glass rounded-lg p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Agent Activity</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                `${inStock} products currently available`,
                "Merchant allowlist verified",
                "Server-side prices are source of truth",
                "Orders require authorization and payment proof",
              ].map((item) => (
                <div key={item} className="rounded-md bg-white/[0.04] px-4 py-3 text-muted">
                  <Activity size={14} className="mr-2 inline text-accent" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="glass mt-6 overflow-hidden rounded-lg">
        <div className="border-b border-line p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Orders</h2>
        </div>
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-5 py-4">Order ID</th>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Buyer</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Fulfillment</th>
                  <th className="px-5 py-4">Transaction</th>
                  <th className="px-5 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-ink">{order.id}</div>
                      <div className="mt-2 inline-flex rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">AI AGENT PURCHASE</div>
                    </td>
                    <td className="px-5 py-4 text-ink">{order.productName}</td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">{shortAddress(order.buyerWallet)}</td>
                    <td className="px-5 py-4 font-semibold text-accent">{order.amountXsgd.toFixed(2)} XSGD</td>
                    <td className="px-5 py-4 text-muted">{order.paymentMethod}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{order.status}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-semibold uppercase text-ink">{order.fulfillmentStatus ?? "not_configured"}</div>
                      {order.fulfillmentReference ? (
                        <div className="mt-1 font-mono text-xs text-muted">{order.fulfillmentReference}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      {order.transactionHash ? (
                        <a className="font-mono text-xs text-violet underline" href={explorerTransactionUrl(order.transactionHash)}>
                          {shortAddress(order.transactionHash)}
                        </a>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted">{new Date(order.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-lg border border-line bg-white/[0.03] p-5 text-sm leading-6 text-muted">
              No verified orders yet. Run the main SmartMerce flow, authorize a purchase, then complete a configured payment to create the first merchant order.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
