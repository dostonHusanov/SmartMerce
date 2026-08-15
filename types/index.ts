export type ProductCategory =
  | "smart watches"
  | "earbuds"
  | "headphones"
  | "mouse"
  | "keyboard"
  | "usb-c cables"
  | "chargers"
  | "phone accessories"
  | "power banks"
  | "desk accessories"
  | "fitness gear"
  | "bags"
  | "stationery"
  | "home accessories";

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  merchant: string;
  merchantId: string;
  priceXsgd: number;
  rating: number;
  reviewCount: number;
  shippingEstimate: string;
  image: string;
  inStock: boolean;
  inventory: number;
};

export type ShoppingIntent = {
  query: string;
  category?: ProductCategory;
  maxBudgetXsgd?: number;
  preferences: string[];
  sortPreference?: string;
};

export type RankedProduct = Product & {
  score: number;
  reasons: string[];
};

export type PolicyCheck = {
  id: string;
  label: string;
  passed: boolean;
  reason: string;
};

export type PolicyResult = {
  allowed: boolean;
  checks: PolicyCheck[];
};

export type PurchaseAuthorization = {
  id: string;
  productId: string;
  exactAmount: number;
  merchantId: string;
  network: "avalanche-mainnet";
  createdAt: string;
  expiresAt: string;
  nonce: string;
  status: "authorized" | "expired" | "revoked";
};

export type WalletSnapshot = {
  connected: boolean;
  address?: `0x${string}`;
  chainId?: number;
  networkName?: string;
  avaxBalance?: string;
  xsgdBalance?: string;
  xsgdDecimals?: number;
  xsgdConfigured: boolean;
  merchantWalletConfigured: boolean;
  error?: string;
};

export type PaymentState =
  | "IDLE"
  | "PREPARING"
  | "VALIDATING"
  | "AWAITING_USER_SIGNATURE"
  | "SUBMITTED"
  | "CONFIRMING"
  | "CONFIRMED"
  | "FAILED";

export type OrderStatus = "pending" | "payment_processing" | "paid" | "confirmed" | "failed";

export type Order = {
  id: string;
  productId: string;
  productName: string;
  merchant: string;
  buyerWallet: string;
  amountXsgd: number;
  paymentMethod: "direct-xsgd" | "straitsx-card";
  transactionHash?: `0x${string}`;
  cardReference?: string;
  status: OrderStatus;
  fulfillmentProvider?: "shopify";
  fulfillmentStatus?: "not_configured" | "created" | "failed";
  fulfillmentReference?: string;
  fulfillmentUrl?: string;
  fulfillmentError?: string;
  createdAt: string;
};

export type DeliveryInfo = {
  email: string;
  fullName: string;
  address1: string;
  city: string;
  province?: string;
  country: string;
  zip: string;
};

export type AgentStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "requires_action";

export type AgentStep = {
  id: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
};

export type ActivityLogEntry = {
  time: string;
  message: string;
};

export type AgentRunResult = {
  intent: ShoppingIntent;
  products: Product[];
  shortlist: RankedProduct[];
  recommendation?: RankedProduct;
  explanation?: string;
  policy?: PolicyResult;
  steps: AgentStep[];
  activity: ActivityLogEntry[];
  provider: string;
};
