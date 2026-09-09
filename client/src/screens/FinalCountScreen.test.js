// client/src/screens/FinalCountScreen.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import FinalCountScreen from "./FinalCountScreen.svelte";

const allCards = [
  { id: "gain-self", name: "Gain Self", effects: [{ target: "self", amount: 2 }], endGameCrystals: null },
  { id: "relic", name: "Relic", effects: [], endGameCrystals: 5 },
  { id: "cursed-treatise-of-arus", name: "Cursed Treatise of Arus", effects: [], endGameCrystals: -10 },
];

const players = [
  { id: "p1", name: "Alice", color: "red", score: 4 },
  { id: "p2", name: "Bob", color: "blue", score: 7 },
];

describe("FinalCountScreen", () => {
  it("shows every player's score", () => {
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCrystals: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByText("Alice — 4")).toBeInTheDocument();
    expect(screen.getByText("Bob — 7")).toBeInTheDocument();
  });

  it("only lists cards that have an end-game crystal value", () => {
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCrystals: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByRole("button", { name: "Ajouter Relic (+5)" })).toBeInTheDocument();
    expect(screen.queryByText(/Gain Self/)).not.toBeInTheDocument();
  });

  it("shows a negative end-game crystal value with a minus sign, not a literal '+-'", () => {
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCrystals: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByRole("button", { name: "Ajouter Cursed Treatise of Arus (-10)" })).toBeInTheDocument();
    expect(screen.queryByText(/\+-/)).not.toBeInTheDocument();
  });

  it("only offers crystal cards for the current player, not other players", async () => {
    const onAddFinalCrystals = vi.fn();
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", onAddFinalCrystals, onEndGame: () => {} });

    expect(screen.getByRole("button", { name: "Ajouter Relic (+5)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /à Alice|à Bob/ })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Ajouter Relic (+5)" }));
    expect(onAddFinalCrystals).toHaveBeenCalledWith("p1", "relic");
  });

  it("adds crystals to whichever player is passed as selfPlayerId", async () => {
    const onAddFinalCrystals = vi.fn();
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p2", onAddFinalCrystals, onEndGame: () => {} });
    await fireEvent.click(screen.getByRole("button", { name: "Ajouter Relic (+5)" }));
    expect(onAddFinalCrystals).toHaveBeenCalledWith("p2", "relic");
  });

  it("calls onEndGame when the finish button is clicked", async () => {
    const onEndGame = vi.fn();
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", onAddFinalCrystals: () => {}, onEndGame });
    await fireEvent.click(screen.getByRole("button", { name: "Terminer la partie" }));
    expect(onEndGame).toHaveBeenCalled();
  });
});
