// client/src/screens/HistoryScreen.test.js
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import HistoryScreen from "./HistoryScreen.svelte";

const players = [
  { id: "p1", name: "Alice", color: "red" },
  { id: "p2", name: "Bob", color: "blue" },
];

const history = [
  { seq: 0, timestamp: 1000, playerId: "p1", delta: 3, resultingScore: 3, source: "manual", actorPlayerId: "p1" },
  {
    seq: 1,
    timestamp: 2000,
    playerId: "p2",
    delta: -1,
    resultingScore: 0,
    source: "card_effect",
    actorPlayerId: "p1",
    cardId: "drain",
    cardName: "Drain",
  },
];

describe("HistoryScreen", () => {
  it("lists every entry with player names resolved and delta sign shown", () => {
    render(HistoryScreen, { history, players });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText(/Drain/)).toBeInTheDocument();
    expect(screen.getByText(/déclenché par Alice/)).toBeInTheDocument();
  });

  it("shows a placeholder when history is empty", () => {
    render(HistoryScreen, { history: [], players });
    expect(screen.getByText("Aucune modification pour le moment.")).toBeInTheDocument();
  });

  it("renders without a Svelte each_key_duplicate error when two entries share timestamp/playerId/delta", () => {
    // Regression test: the #each key used to be `timestamp + playerId + delta`,
    // which collides whenever two entries happen to match on all three —
    // entirely possible (e.g. two identical manual +1 adjustments for the
    // same player within the same millisecond). `seq` is guaranteed unique.
    const collidingHistory = [
      { seq: 0, timestamp: 1000, playerId: "p1", delta: 1, resultingScore: 1, source: "manual", actorPlayerId: "p1" },
      { seq: 1, timestamp: 1000, playerId: "p1", delta: 1, resultingScore: 2, source: "manual", actorPlayerId: "p1" },
    ];
    expect(() => render(HistoryScreen, { history: collidingHistory, players })).not.toThrow();
  });
});
