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
  { id: "p1", name: "Alice", color: "red", score: 4, finalCards: [] },
  { id: "p2", name: "Bob", color: "blue", score: 7, finalCards: [] },
];

describe("FinalCountScreen", () => {
  it("shows every player's score", () => {
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByText("Alice — 4")).toBeInTheDocument();
    expect(screen.getByText("Bob — 7")).toBeInTheDocument();
  });

  it("only offers cards that have an end-game crystal value", () => {
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
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
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByRole("button", { name: "Ajouter Cursed Treatise of Arus (-10)" })).toBeInTheDocument();
    expect(screen.queryByText(/\+-/)).not.toBeInTheDocument();
  });

  it("calls onAddFinalCard with the card id when a card is clicked", async () => {
    const onAddFinalCard = vi.fn();
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCard,
      onRemoveFinalCard: () => {},
      onEndGame: () => {},
    });
    await fireEvent.click(screen.getByRole("button", { name: "Ajouter Relic (+5)" }));
    expect(onAddFinalCard).toHaveBeenCalledWith("relic");
  });

  it("shows a placeholder when the current player has invoked no card yet", () => {
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByText("Aucune carte invoquée pour le moment.")).toBeInTheDocument();
  });

  it("lists the current player's invoked cards, including duplicates, with a remove button each", () => {
    const withInvoked = [
      { id: "p1", name: "Alice", color: "red", score: 10, finalCards: [
        { cardId: "relic", instanceId: "inst-1" },
        { cardId: "relic", instanceId: "inst-2" },
      ] },
      players[1],
    ];
    render(FinalCountScreen, {
      allCards,
      players: withInvoked,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
      onEndGame: () => {},
    });
    expect(screen.getAllByText("Relic (+5)")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Retirer Relic" })).toHaveLength(2);
  });

  it("does not show another player's invoked cards", () => {
    const withInvoked = [
      players[0],
      { id: "p2", name: "Bob", color: "blue", score: 12, finalCards: [{ cardId: "relic", instanceId: "inst-1" }] },
    ];
    render(FinalCountScreen, {
      allCards,
      players: withInvoked,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
      onEndGame: () => {},
    });
    expect(screen.getByText("Aucune carte invoquée pour le moment.")).toBeInTheDocument();
  });

  it("calls onRemoveFinalCard with the invoked card's instanceId when removed", async () => {
    const onRemoveFinalCard = vi.fn();
    const withInvoked = [
      { id: "p1", name: "Alice", color: "red", score: 5, finalCards: [{ cardId: "relic", instanceId: "inst-1" }] },
      players[1],
    ];
    render(FinalCountScreen, {
      allCards,
      players: withInvoked,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard,
      onEndGame: () => {},
    });
    await fireEvent.click(screen.getByRole("button", { name: "Retirer Relic" }));
    expect(onRemoveFinalCard).toHaveBeenCalledWith("inst-1");
  });

  it("calls onEndGame when the finish button is clicked", async () => {
    const onEndGame = vi.fn();
    render(FinalCountScreen, {
      allCards,
      players,
      selfPlayerId: "p1",
      onAddFinalCard: () => {},
      onRemoveFinalCard: () => {},
      onEndGame,
    });
    await fireEvent.click(screen.getByRole("button", { name: "Terminer la partie" }));
    expect(onEndGame).toHaveBeenCalled();
  });
});
