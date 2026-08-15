import { OrdersDashboard } from "@/components/orders-dashboard";
import { listProducts } from "@/lib/commerce/products";
import { listAuthorizations, listOrders } from "@/lib/merchant/orders";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <OrdersDashboard
      initialProducts={listProducts()}
      initialAuthorizations={listAuthorizations()}
      initialOrders={listOrders()}
    />
  );
}
