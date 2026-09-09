import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateCardList, loadCardsFromFile } from "./cards.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cards = [...loadCardsFromFile(join(__dirname, "cards.json")).values()];

describe("cards.json", () => {
  it("is a non-empty, schema-valid list covering the Seasons base game", () => {
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);
    expect(() => validateCardList(cards)).not.toThrow();
  });

  it("every card has a non-empty name and a unique id", () => {
    const ids = new Set();
    for (const card of cards) {
      expect(card.name.trim().length).toBeGreaterThan(0);
      expect(ids.has(card.id)).toBe(false);
      ids.add(card.id);
    }
  });
});
