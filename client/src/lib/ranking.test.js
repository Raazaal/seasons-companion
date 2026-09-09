import { describe, it, expect } from "vitest";
import { rankPlayers, ordinal } from "./ranking.js";

describe("rankPlayers", () => {
  it("sorts by score descending and assigns 1-based ranks", () => {
    const players = [
      { id: "p1", name: "Alice", score: 9 },
      { id: "p2", name: "Bob", score: 12 },
      { id: "p3", name: "Carl", score: 3 },
    ];
    const ranked = rankPlayers(players);
    expect(ranked.map((p) => p.name)).toEqual(["Bob", "Alice", "Carl"]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it("gives tied scores the same rank and skips ahead for the next distinct score", () => {
    const players = [
      { id: "p1", name: "Alice", score: 10 },
      { id: "p2", name: "Bob", score: 10 },
      { id: "p3", name: "Carl", score: 5 },
      { id: "p4", name: "Dana", score: 1 },
    ];
    const ranked = rankPlayers(players);
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 3, 4]);
  });

  it("does not mutate the input array", () => {
    const players = [
      { id: "p1", name: "Alice", score: 1 },
      { id: "p2", name: "Bob", score: 2 },
    ];
    rankPlayers(players);
    expect(players.map((p) => p.name)).toEqual(["Alice", "Bob"]);
  });
});

describe("ordinal", () => {
  it("formats 1 as 1er and every other rank as Nème", () => {
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(2)).toBe("2ème");
    expect(ordinal(3)).toBe("3ème");
    expect(ordinal(4)).toBe("4ème");
  });
});
