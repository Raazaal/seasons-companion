// client/src/screens/FinalCountScreen.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import FinalCountScreen from "./FinalCountScreen.svelte";

const allCards = [
  { id: "gain-self", name: "Gain Self", effects: [{ target: "self", amount: 2 }], endGameCrystals: null },
  { id: "relic", name: "Relic", effects: [], endGameCrystals: 5 },
];

const players = [
  { id: "p1", name: "Alice", color: "red", score: 4 },
  { id: "p2", name: "Bob", color: "blue", score: 7 },
];

describe("FinalCountScreen", () => {
  it("only lists cards that have an end-game crystal value", () => {
    render(FinalCountScreen, { allCards, players, onAddFinalCrystals: () => {}, onEndGame: () => {} });
    expect(screen.getByText("Relic (+5)")).toBeInTheDocument();
    expect(screen.queryByText(/Gain Self/)).not.toBeInTheDocument();
  });

  it("calls onAddFinalCrystals with the player and card when added for that player", async () => {
    const onAddFinalCrystals = vi.fn();
    render(FinalCountScreen, { allCards, players, onAddFinalCrystals, onEndGame: () => {} });
    await fireEvent.click(screen.getByRole("button", { name: "Ajouter Relic (+5) à Alice" }));
    expect(onAddFinalCrystals).toHaveBeenCalledWith("p1", "relic");
  });

  it("calls onEndGame when the finish button is clicked", async () => {
    const onEndGame = vi.fn();
    render(FinalCountScreen, { allCards, players, onAddFinalCrystals: () => {}, onEndGame });
    await fireEvent.click(screen.getByRole("button", { name: "Terminer la partie" }));
    expect(onEndGame).toHaveBeenCalled();
  });
});
