import { z } from "zod";

export const productCategorySchema = z.enum([
  "earbuds",
  "headphones",
  "mouse",
  "keyboard",
  "usb-c cables",
  "chargers",
  "phone accessories",
  "power banks",
]);

export const shoppingIntentSchema = z.object({
  query: z.string().trim().min(2, "Describe the item SmartMerce should find."),
  category: productCategorySchema.optional(),
  maxBudgetXsgd: z.number().positive().optional(),
  preferences: z.array(z.string()).default([]),
  sortPreference: z.string().optional(),
});

export const agentRequestSchema = z.object({
  command: z.string().trim().min(3),
});

export const authorizationRequestSchema = z.object({
  productId: z.string().min(1),
  exactAmount: z.number().positive(),
  merchantId: z.string().min(1),
});

export type ShoppingIntentInput = z.infer<typeof shoppingIntentSchema>;
