import { Activity, CheckCircle2, Clock3, PackageSearch, ReceiptText, WalletCards, type LucideIcon } from "lucide-react";
import { listProducts } from "@/lib/commerce/products";
import { listAuthorizations, listOrders } from "@/lib/merchant/orders";
import { explorerTransactionUrl, shortAddress } from "@/lib/blockchain/avalanche";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  const products = listProducts();
  const orders = listOrders();
  const authorizations = listAuthorizations();
  const liveProducts = products
    .filter((product) => product.source === "internet")
    .sort((a, b) => a.name.localeCompare(b.name));
  const pendingPayments = authorizations
    .map((authorization) => ({
      authorization,
      product: products.find((product) => product.id === authorization.productId),
    }))
    .filter((item) => item.product);
  const paidOrders = orders.filter((order) => order.status === "confirmed" || order.status === "paid");
  const revenueXsgd = paidOrders.reduce((sum, order) => sum + order.amountXsgd, 0);

  const metrics = [
    ["Purchases", orders.length, ReceiptText],
    ["Pending payment", pendingPayments.length, Clock3],
    ["Paid orders", paidOrders.length, CheckCircle2],
    ["Revenue XSGD", Number(revenueXsgd.toFixed(2)), WalletCards],
  ] satisfies Array<[string, number, LucideIcon]>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
        <div className="glass rounded-lg p-5 md:p-7">
          <div className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            Orders and purchases
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Track what the AI found, what the shopper approved, and what was paid.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted">
            This page is the purchase history for SmartMerce. It separates product discovery from payment proof so non-technical users can see exactly where each order stands.
          </p>
        </div>

        <aside className="glass rounded-lg p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Current status</div>
          <div className="mt-5 space-y-3">
            <StatusLine label="AI-found products" value={liveProducts.length} />
            <StatusLine label="Waiting for wallet payment" value={pendingPayments.length} />
            <StatusLine label="Verified orders" value={paidOrders.length} />
          </div>
          <p className="mt-5 text-sm leading-6 text-muted">
            Orders show payment proof only after a real wallet transaction is verified.
          </p>
        </aside>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <div key={label} className="glass rounded-lg p-5">
            <Icon className="text-accent" size={20} />
            <div className="mt-4 text-3xl font-semibold text-ink">{String(value)}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{label}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass overflow-hidden rounded-lg">
          <div className="border-b border-line p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Purchase Timeline</h2>
          </div>
          <div className="divide-y divide-line">
            <TimelineBlock
              icon={PackageSearch}
              title="1. Products discovered"
              description="Live products the AI imported from internet shopping results."
              empty="Run a shopper search first. AI-found products will appear here."
            >
              {liveProducts.slice(0, 6).map((product) => (
                <Row key={product.id} title={product.name} meta={`${product.merchant} · ${product.priceXsgd.toFixed(2)} XSGD`} badge="Found" />
              ))}
            </TimelineBlock>

            <TimelineBlock
              icon={Clock3}
              title="2. Approved, waiting for payment"
              description="The shopper approved the product and amount, but has not completed wallet payment yet."
              empty="No purchases are waiting for wallet payment."
            >
              {pendingPayments.slice(0, 6).map(({ authorization, product }) => (
                <Row
                  key={authorization.id}
                  title={product?.name ?? "Unknown product"}
                  meta={`${authorization.exactAmount.toFixed(2)} XSGD · expires ${new Date(authorization.expiresAt).toLocaleTimeString()}`}
                  badge="Waiting"
                  tone="amber"
                />
              ))}
            </TimelineBlock>

            <TimelineBlock
              icon={CheckCircle2}
              title="3. Verified orders"
              description="Orders created after SmartMerce verifies payment proof."
              empty="No verified orders yet."
            >
              {orders.slice(0, 8).map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </TimelineBlock>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="glass rounded-lg p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">What each status means</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Found", "The AI discovered a live product and imported it for checkout."],
                ["Waiting", "The shopper approved the item, but wallet payment is not complete."],
                ["Verified", "Payment proof exists and an order record was created."],
              ].map(([label, text]) => (
                <div key={label} className="rounded-md border border-line bg-white/[0.03] p-4">
                  <div className="font-semibold text-ink">{label}</div>
                  <p className="mt-1 leading-6 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-lg p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">Activity</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                `${products.filter((product) => product.inStock).length} items currently available`,
                "Prices checked before payment",
                "Orders require user approval",
                "Payment proof required for verified orders",
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">All Orders</h2>
        </div>
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-5 py-4">Order</th>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Buyer</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Fulfillment</th>
                  <th className="px-5 py-4">Transaction</th>
                  <th className="px-5 py-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4 font-mono text-xs text-ink">{order.id}</td>
                    <td className="px-5 py-4 text-ink">{order.productName}</td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">{shortAddress(order.buyerWallet)}</td>
                    <td className="px-5 py-4 font-semibold text-accent">{order.amountXsgd.toFixed(2)} XSGD</td>
                    <td className="px-5 py-4 text-muted">{order.paymentMethod}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{order.status}</span>
                    </td>
                    <td className="px-5 py-4 text-muted">{order.fulfillmentStatus ?? "not configured"}</td>
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
              No verified orders yet. Use the Shopper page to find a product, approve it, then complete wallet payment.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-lg font-semibold text-ink">{value}</span>
    </div>
  );
}

function TimelineBlock({
  icon: Icon,
  title,
  description,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="p-5">
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-1 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {hasChildren ? children : <div className="rounded-md border border-line bg-white/[0.03] p-4 text-sm text-muted">{empty}</div>}
      </div>
    </section>
  );
}

function Row({
  title,
  meta,
  badge,
  tone = "accent",
}: {
  title: string;
  meta: string;
  badge: string;
  tone?: "accent" | "amber";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-white/[0.03] p-4">
      <div>
        <div className="font-medium text-ink">{title}</div>
        <div className="mt-1 text-xs text-muted">{meta}</div>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone === "amber" ? "bg-amber/10 text-amber" : "bg-accent/10 text-accent"}`}>
        {badge}
      </span>
    </div>
  );
}

function OrderRow({ order }: { order: ReturnType<typeof listOrders>[number] }) {
  return (
    <div className="rounded-md border border-line bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{order.productName}</div>
          <div className="mt-1 text-xs text-muted">{order.id} · {order.amountXsgd.toFixed(2)} XSGD</div>
        </div>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">Verified</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
        <div>Payment: {order.paymentMethod}</div>
        <div>Fulfillment: {order.fulfillmentStatus ?? "not configured"}</div>
        <div>Buyer: {shortAddress(order.buyerWallet)}</div>
        <div>Time: {new Date(order.createdAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
