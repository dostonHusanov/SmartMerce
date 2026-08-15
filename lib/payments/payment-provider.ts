import type { Order, PaymentState, PurchaseAuthorization } from "@/types";

export type PaymentPreparation = {
  state: PaymentState;
  paymentMethod: "direct-xsgd" | "straitsx-card";
  requiredAction?: string;
  safeMetadata?: Record<string, string | number | boolean | undefined>;
};

export type PaymentExecution = {
  state: PaymentState;
  transactionHash?: `0x${string}`;
  cardReference?: string;
};

export type PaymentVerification = {
  state: PaymentState;
  verified: boolean;
  order?: Order;
  reason?: string;
};

export interface PaymentProvider {
  prepare(authorization: PurchaseAuthorization): Promise<PaymentPreparation>;
  execute(authorization: PurchaseAuthorization): Promise<PaymentExecution>;
  verify(reference: string): Promise<PaymentVerification>;
}

export class StraitsXCardPaymentProvider implements PaymentProvider {
  async prepare(): Promise<PaymentPreparation> {
    return {
      state: "FAILED",
      paymentMethod: "straitsx-card",
      requiredAction: "StraitsX sandbox MCP tools must be discovered before card issuance can be enabled.",
    };
  }

  async execute(authorization: PurchaseAuthorization): Promise<PaymentExecution> {
    void authorization;
    throw new Error("StraitsX card execution is disabled until sandbox MCP tools and credentials are verified.");
  }

  async verify(reference: string): Promise<PaymentVerification> {
    void reference;
    return {
      state: "FAILED",
      verified: false,
      reason: "StraitsX card verification is unavailable until MCP discovery is complete.",
    };
  }
}

export class DirectXsgdPaymentProvider implements PaymentProvider {
  async prepare(authorization: PurchaseAuthorization): Promise<PaymentPreparation> {
    return {
      state: "PREPARING",
      paymentMethod: "direct-xsgd",
      safeMetadata: {
        productId: authorization.productId,
        exactAmount: authorization.exactAmount,
        merchantId: authorization.merchantId,
        network: authorization.network,
      },
    };
  }

  async execute(authorization: PurchaseAuthorization): Promise<PaymentExecution> {
    void authorization;
    return {
      state: "AWAITING_USER_SIGNATURE",
    };
  }

  async verify(reference: string): Promise<PaymentVerification> {
    return {
      state: "CONFIRMING",
      verified: Boolean(reference),
    };
  }
}
