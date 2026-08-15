import { shoppingIntentSchema } from "@/lib/ai/schemas";
import type { ShoppingIntent } from "@/types";

const categoryHints = [
  "earbuds",
  "headphones",
  "mouse",
  "keyboard",
  "usb-c cables",
  "chargers",
  "phone accessories",
  "power banks",
] as const;

export type AiProvider = {
  name: string;
  parseIntent(command: string): Promise<ShoppingIntent>;
};

function detectCategory(command: string) {
  const lower = command.toLowerCase();
  if (/\bearbuds?\b|buds|earphones?/.test(lower)) return "earbuds";
  if (/headphones?|headset/.test(lower)) return "headphones";
  if (/mouse|mice/.test(lower)) return "mouse";
  if (/keyboard|keys/.test(lower)) return "keyboard";
  if (/charger|charging brick|wall adapter|power adapter/.test(lower)) return "chargers";
  if (/usb.?c|cable/.test(lower)) return "usb-c cables";
  if (/case|stand|holder|phone accessory/.test(lower)) return "phone accessories";
  if (/power bank|battery pack/.test(lower)) return "power banks";
  return undefined;
}

function cleanQuery(command: string, category?: string) {
  const lower = command.toLowerCase();
  const budgetless = lower
    .replace(/under\s+\d+(\.\d+)?\s*xsgd/g, "")
    .replace(/below\s+\d+(\.\d+)?\s*xsgd/g, "")
    .replace(/less than\s+\d+(\.\d+)?\s*xsgd/g, "")
    .replace(/find me|find|best|the|prioritize|rating|value|good|high|under|xsgd/g, " ");
  const candidate = budgetless.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  return category ?? (candidate.split(" ").slice(0, 4).join(" ") || command.trim());
}

export function parseIntentDeterministically(command: string): ShoppingIntent {
  const category = detectCategory(command);
  const budgetMatch = command.match(/(?:under|below|less than|max(?:imum)?|budget)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*xsgd/i);
  const maxBudgetXsgd = budgetMatch ? Number(budgetMatch[1]) : undefined;
  const lower = command.toLowerCase();
  const preferences: string[] = [];

  if (/rating|quality|best/.test(lower)) preferences.push("high rating");
  if (/value|cheap|affordable|price/.test(lower)) preferences.push("good value");
  if (/fast|same day|quick/.test(lower)) preferences.push("fast shipping");

  const sortPreference = /value/.test(lower)
    ? "value"
    : /rating|best/.test(lower)
      ? "rating"
      : /cheap|price/.test(lower)
        ? "price"
        : undefined;

  return shoppingIntentSchema.parse({
    query: cleanQuery(command, category),
    category: categoryHints.includes(category as never) ? category : undefined,
    maxBudgetXsgd,
    preferences,
    sortPreference,
  });
}

class DeterministicProvider implements AiProvider {
  name = "deterministic-fallback";

  async parseIntent(command: string) {
    return parseIntentDeterministically(command);
  }
}

export function getAiProvider(): AiProvider {
  return new DeterministicProvider();
}
