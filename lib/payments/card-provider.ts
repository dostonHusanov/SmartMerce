import type { PurchaseAuthorization } from "@/types";

export type ScopedCardRequest = {
  authorization: PurchaseAuthorization;
  purpose: string;
};

export type ScopedCardResult = {
  status: string;
  lastFour?: string;
  spendingLimit?: number;
  expiration?: string;
  cardReference?: string;
  purpose?: string;
};

export interface CardIssuanceProvider {
  createScopedCard(request: ScopedCardRequest): Promise<ScopedCardResult>;
  getCardStatus(cardReference: string): Promise<ScopedCardResult>;
  revokeCard(cardReference: string): Promise<{ status: string }>;
}

export class StraitsXCardProvider implements CardIssuanceProvider {
  async createScopedCard(request: ScopedCardRequest): Promise<ScopedCardResult> {
    void request;
    throw new Error("StraitsX card issuance is disabled until actual sandbox MCP tools and schemas are discovered.");
  }

  async getCardStatus(cardReference: string): Promise<ScopedCardResult> {
    void cardReference;
    throw new Error("StraitsX card status is disabled until actual sandbox MCP tools and schemas are discovered.");
  }

  async revokeCard(cardReference: string): Promise<{ status: string }> {
    void cardReference;
    throw new Error("StraitsX card revocation is disabled until actual sandbox MCP tools and schemas are discovered.");
  }
}
