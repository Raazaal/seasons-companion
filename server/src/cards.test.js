import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCardList, loadCardsFromFile, CardValidationError } from "./cards.js";

const VALID_CARDS = [
  { id: "sundial", name: "Sundial", effects: [{ target: "self", amount: 2 }], endGameCrystals: null },
  {
    id: "burning-glass",
    name: "Burning Glass",
    effects: [{ target: "each_opponent", amount: -1 }],
    endGameCrystals: 3,
  },
];

describe("validateCardList", () => {
  it("accepts a well-formed list", () => {
    expect(() => validateCardList(VALID_CARDS)).not.toThrow();
  });

  it("rejects duplicate ids", () => {
    const dup = [...VALID_CARDS, VALID_CARDS[0]];
    expect(() => validateCardList(dup)).toThrow(CardValidationError);
  });

  it("rejects an invalid effect target", () => {
    const bad = [{ id: "x", name: "X", effects: [{ target: "choose_opponent", amount: 1 }], endGameCrystals: null }];
    expect(() => validateCardList(bad)).toThrow(CardValidationError);
  });

  it("rejects a non-integer effect amount", () => {
    const bad = [{ id: "x", name: "X", effects: [{ target: "self", amount: 1.5 }], endGameCrystals: null }];
    expect(() => validateCardList(bad)).toThrow(CardValidationError);
  });

  it("rejects a missing name", () => {
    const bad = [{ id: "x", effects: [], endGameCrystals: null }];
    expect(() => validateCardList(bad)).toThrow(CardValidationError);
  });
});

describe("loadCardsFromFile", () => {
  it("reads a JSON file and returns a Map keyed by card id", () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-test-"));
    const filePath = join(dir, "cards.json");
    writeFileSync(filePath, JSON.stringify(VALID_CARDS), "utf8");
    const cards = loadCardsFromFile(filePath);
    expect(cards).toBeInstanceOf(Map);
    expect(cards.get("sundial")).toEqual(VALID_CARDS[0]);
    rmSync(dir, { recursive: true, force: true });
  });
});
