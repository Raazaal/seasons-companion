// client/src/screens/Dashboard.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import Dashboard from "./Dashboard.svelte";

const game = {
  phase: "playing",
  activePlayerId: "p1",
  turnOrder: ["p1", "p2"],
  players: [
    { id: "p1", name: "Alice", color: "red", score: 4, hand: [] },
    { id: "p2", name: "Bob", color: "blue", score: 7, hand: [] },
  ],
};

describe("Dashboard", () => {
  it("shows every player's name, color, and score", () => {
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore: () => {}, onNextTurn: () => {} });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("marks the active player", () => {
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore: () => {}, onNextTurn: () => {} });
    expect(screen.getByTestId("player-p1")).toHaveClass("active");
    expect(screen.getByTestId("player-p2")).not.toHaveClass("active");
  });

  it("calls onAdjustScore with +1 and -1", async () => {
    const onAdjustScore = vi.fn();
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore, onNextTurn: () => {} });
    await fireEvent.click(screen.getByRole("button", { name: "+1" }));
    await fireEvent.click(screen.getByRole("button", { name: "-1" }));
    expect(onAdjustScore).toHaveBeenNthCalledWith(1, 1);
    expect(onAdjustScore).toHaveBeenNthCalledWith(2, -1);
  });

  it("calls onNextTurn when the next-turn button is clicked", async () => {
    const onNextTurn = vi.fn();
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore: () => {}, onNextTurn });
    await fireEvent.click(screen.getByRole("button", { name: "Joueur suivant" }));
    expect(onNextTurn).toHaveBeenCalled();
  });
});
