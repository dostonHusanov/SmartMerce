import type { Order } from "@/types";

export const browserOrdersStorageKey = "smartmerce.orders.v1";

function uniqueOrders(orders: Order[]) {
  const seen = new Set<string>();
  return orders.filter((order) => {
    const key = order.transactionHash ?? order.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readBrowserOrders() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(browserOrdersStorageKey) ?? "[]") as Order[];
    return Array.isArray(parsed) ? uniqueOrders(parsed) : [];
  } catch {
    return [];
  }
}

export function rememberBrowserOrder(order: Order) {
  if (typeof window === "undefined") return;

  const next = uniqueOrders([order, ...readBrowserOrders()]).slice(0, 50);
  window.localStorage.setItem(browserOrdersStorageKey, JSON.stringify(next));
  window.dispatchEvent(new Event("smartmerce:orders-updated"));
}
