import { shoppingIntentSchema } from "@/lib/ai/schemas";
import type { ShoppingIntent } from "@/types";

const categoryHints = [
  "smart watches",
  "earbuds",
  "headphones",
  "mouse",
  "keyboard",
  "usb-c cables",
  "chargers",
  "phone accessories",
  "power banks",
  "desk accessories",
  "fitness gear",
  "bags",
  "stationery",
  "home accessories",
] as const;

const commandStopWords = new Set([
  "a",
  "an",
  "and",
  "any",
  "best",
  "buy",
  "can",
  "cheap",
  "compare",
  "fast",
  "find",
  "for",
  "get",
  "good",
  "high",
  "me",
  "of",
  "option",
  "options",
  "please",
  "prioritize",
  "quick",
  "rating",
  "reviews",
  "shipping",
  "the",
  "under",
  "value",
  "with",
  "xsgd",
  "sgd",
]);

export type AiProvider = {
  name: string;
  parseIntent(command: string): Promise<ShoppingIntent>;
};

function detectCategory(command: string) {
  const lower = command.toLowerCase();
  if (/apple watch|smart\s*watch|watch|fitness tracker|wearable/.test(lower)) return "smart watches";
  if (/\bearbuds?\b|buds|earphones?/.test(lower)) return "earbuds";
  if (/headphones?|headset/.test(lower)) return "headphones";
  if (/mouse|mice/.test(lower)) return "mouse";
  if (/keyboard|keys/.test(lower)) return "keyboard";
  if (/charger|charging brick|wall adapter|power adapter/.test(lower)) return "chargers";
  if (/usb.?c|cable/.test(lower)) return "usb-c cables";
  if (/case|stand|holder|phone accessory/.test(lower)) return "phone accessories";
  if (/power bank|battery pack/.test(lower)) return "power banks";
  if (/desk|lamp|organizer|monitor stand|workspace/.test(lower)) return "desk accessories";
  if (/nike|running shoes|sneakers|shoe|gym|fitness|workout/.test(lower)) return "fitness gear";
  if (/backpack|bag|tote|sling|laptop bag/.test(lower)) return "bags";
  if (/notebook|pen|journal|stationery|planner/.test(lower)) return "stationery";
  if (/bottle|mug|home|kitchen|humidifier/.test(lower)) return "home accessories";
  return undefined;
}

function cleanQuery(command: string, category?: string) {
  const lower = command.toLowerCase();
  if (category === "smart watches" && /apple watch|smart\s*watch|watch/.test(lower)) return "watch";
  if (category === "fitness gear" && /running shoes|sneakers|shoe/.test(lower)) return "shoes";
  if (category === "fitness gear" && /resistance|band/.test(lower)) return "band";
  if (category === "desk accessories" && /lamp/.test(lower)) return "lamp";
  if (category === "desk accessories" && /organizer|dock/.test(lower)) return "organizer";
  if (category === "bags" && /backpack/.test(lower)) return "backpack";
  if (category === "bags" && /sling/.test(lower)) return "sling";
  if (category === "stationery" && /notebook|journal/.test(lower)) return "notebook";
  if (category === "home accessories" && /bottle/.test(lower)) return "bottle";
  if (category === "phone accessories" && /holder|stand/.test(lower)) return "phone holder";
  if (category === "phone accessories" && /case|cover/.test(lower)) return "phone case";

  const productPhrase = lower
    .split(/\b(?:prioritize|prefer|preference|sort by|focus on)\b/)[0]
    .replace(/under\s+\d+(\.\d+)?\s*(xsgd|sgd|s\$|\$)?/g, "")
    .replace(/below\s+\d+(\.\d+)?\s*(xsgd|sgd|s\$|\$)?/g, "")
    .replace(/less than\s+\d+(\.\d+)?\s*(xsgd|sgd|s\$|\$)?/g, "")
    .replace(/(?:max(?:imum)?|budget)\s*(?:of)?\s*\d+(\.\d+)?\s*(xsgd|sgd|s\$|\$)?/g, "")
    .replace(/\b(?:buy me|find me|get me|buy|find|get|show me|search for|look for)\b/g, " ");
  const candidate = productPhrase
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((term) => term.length > 1 && !commandStopWords.has(term))
    .slice(0, 7)
    .join(" ");

  return candidate || category || command.trim();
}

export function parseIntentDeterministically(command: string): ShoppingIntent {
  const category = detectCategory(command);
  const budgetMatch = command.match(/(?:under|below|less than|max(?:imum)?|budget)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(?:xsgd|sgd|s\$|\$)?/i);
  const maxBudgetXsgd = budgetMatch ? Number(budgetMatch[1]) : undefined;
  const lower = command.toLowerCase();
  const preferences: string[] = [];

  if (/rating|quality|best/.test(lower)) preferences.push("high rating");
  if (/value|cheap|affordable|price/.test(lower)) preferences.push("good value");
  if (/fast|same day|quick/.test(lower)) preferences.push("fast shipping");
  if (/reputable|trusted|reliable|official/.test(lower)) preferences.push("trusted merchant");
  if (/compare|options|alternatives/.test(lower)) preferences.push("compare options");

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
