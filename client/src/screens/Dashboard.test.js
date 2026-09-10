// client/src/screens/Dashboard.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import Dashboard from "./Dashboard.svelte";

const game = {
  phase: "playing",
  activePlayerId: "p1",
  turnOrder: ["p1", "p2"],
  players: [
    { id: "p1", name: "Alice", color: "red", score: 4 },
    { id: "p2", name: "Bob", color: "blue", score: 7 },
  ],
};

function renderDashboard(overrides = {}) {
  return render(Dashboard, {
    game,
    selfPlayerId: "p1",
    onAdjustScore: () => {},
    onStealAllOpponents: () => {},
    onPenaltyAllOpponents: () => {},
    onNextTurn: () => {},
    ...overrides,
  });
}

describe("Dashboard", () => {
  it("shows every player's name, color, and score", () => {
    renderDashboard();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("marks the active player", () => {
    renderDashboard();
    expect(screen.getByTestId("player-p1")).toHaveClass("active");
    expect(screen.getByTestId("player-p2")).not.toHaveClass("active");
  });

  it("calls onAdjustScore with every score tier", async () => {
    const onAdjustScore = vi.fn();
    renderDashboard({ onAdjustScore });
    await fireEvent.click(screen.getByRole("button", { name: "+1" }));
    await fireEvent.click(screen.getByRole("button", { name: "-1" }));
    await fireEvent.click(screen.getByRole("button", { name: "+2" }));
    await fireEvent.click(screen.getByRole("button", { name: "-2" }));
    await fireEvent.click(screen.getByRole("button", { name: "+3" }));
    await fireEvent.click(screen.getByRole("button", { name: "-3" }));
    expect(onAdjustScore).toHaveBeenNthCalledWith(1, 1);
    expect(onAdjustScore).toHaveBeenNthCalledWith(2, -1);
    expect(onAdjustScore).toHaveBeenNthCalledWith(3, 2);
    expect(onAdjustScore).toHaveBeenNthCalledWith(4, -2);
    expect(onAdjustScore).toHaveBeenNthCalledWith(5, 3);
    expect(onAdjustScore).toHaveBeenNthCalledWith(6, -3);
  });

  it("calls onStealAllOpponents with the chosen tier", async () => {
    const onStealAllOpponents = vi.fn();
    renderDashboard({ onStealAllOpponents });
    await fireEvent.click(screen.getByRole("button", { name: "Voler 2" }));
    expect(onStealAllOpponents).toHaveBeenCalledWith(2);
  });

  it("calls onPenaltyAllOpponents with the chosen tier", async () => {
    const onPenaltyAllOpponents = vi.fn();
    renderDashboard({ onPenaltyAllOpponents });
    await fireEvent.click(screen.getByRole("button", { name: "-3 à tous" }));
    expect(onPenaltyAllOpponents).toHaveBeenCalledWith(3);
  });

  it("calls onNextTurn when the next-turn button is clicked", async () => {
    const onNextTurn = vi.fn();
    renderDashboard({ onNextTurn });
    await fireEvent.click(screen.getByRole("button", { name: "Joueur suivant" }));
    expect(onNextTurn).toHaveBeenCalled();
  });
});
