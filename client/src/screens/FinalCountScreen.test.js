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
  { id: "p1", name: "Alice", color: "red", score: 4, finalCards: [], finalCountReady: false },
  { id: "p2", name: "Bob", color: "blue", score: 7, finalCards: [], finalCountReady: false },
];

const noop = { onAddFinalCard: () => {}, onRemoveFinalCard: () => {}, onSetReady: () => {}, onEndGame: () => {} };

describe("FinalCountScreen", () => {
  it("shows every player's score", () => {
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop });
    expect(screen.getByText("Alice — 4")).toBeInTheDocument();
    expect(screen.getByText("Bob — 7")).toBeInTheDocument();
  });

  it("only offers cards that have an end-game crystal value", () => {
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop });
    expect(screen.getByRole("button", { name: "Ajouter Relic (+5)" })).toBeInTheDocument();
    expect(screen.queryByText(/Gain Self/)).not.toBeInTheDocument();
  });

  it("shows a negative end-game crystal value with a minus sign, not a literal '+-'", () => {
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop });
    expect(screen.getByRole("button", { name: "Ajouter Cursed Treatise of Arus (-10)" })).toBeInTheDocument();
    expect(screen.queryByText(/\+-/)).not.toBeInTheDocument();
  });

  it("calls onAddFinalCard with the card id when a card is clicked", async () => {
    const onAddFinalCard = vi.fn();
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop, onAddFinalCard });
    await fireEvent.click(screen.getByRole("button", { name: "Ajouter Relic (+5)" }));
    expect(onAddFinalCard).toHaveBeenCalledWith("relic");
  });

  it("shows a placeholder when the current player has invoked no card yet", () => {
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop });
    expect(screen.getByText("Aucune carte invoquée pour le moment.")).toBeInTheDocument();
  });

  it("lists the current player's invoked cards, including duplicates, with a remove button each", () => {
    const withInvoked = [
      {
        ...players[0],
        score: 10,
        finalCards: [
          { cardId: "relic", instanceId: "inst-1" },
          { cardId: "relic", instanceId: "inst-2" },
        ],
      },
      players[1],
    ];
    render(FinalCountScreen, { allCards, players: withInvoked, selfPlayerId: "p1", ...noop });
    expect(screen.getAllByText("Relic (+5)")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Retirer Relic" })).toHaveLength(2);
  });

  it("does not show another player's invoked cards", () => {
    const withInvoked = [
      players[0],
      { ...players[1], score: 12, finalCards: [{ cardId: "relic", instanceId: "inst-1" }] },
    ];
    render(FinalCountScreen, { allCards, players: withInvoked, selfPlayerId: "p1", ...noop });
    expect(screen.getByText("Aucune carte invoquée pour le moment.")).toBeInTheDocument();
  });

  it("calls onRemoveFinalCard with the invoked card's instanceId when removed", async () => {
    const onRemoveFinalCard = vi.fn();
    const withInvoked = [
      { ...players[0], score: 5, finalCards: [{ cardId: "relic", instanceId: "inst-1" }] },
      players[1],
    ];
    render(FinalCountScreen, { allCards, players: withInvoked, selfPlayerId: "p1", ...noop, onRemoveFinalCard });
    await fireEvent.click(screen.getByRole("button", { name: "Retirer Relic" }));
    expect(onRemoveFinalCard).toHaveBeenCalledWith("inst-1");
  });

  it("shows each player's ready status", () => {
    const mixed = [{ ...players[0], finalCountReady: true }, players[1]];
    render(FinalCountScreen, { allCards, players: mixed, selfPlayerId: "p1", ...noop });
    expect(screen.getByText("Prêt")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("calls onSetReady with true when the current player marks themselves ready", async () => {
    const onSetReady = vi.fn();
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop, onSetReady });
    await fireEvent.click(screen.getByRole("button", { name: "J'ai terminé mon décompte" }));
    expect(onSetReady).toHaveBeenCalledWith(true);
  });

  it("calls onSetReady with false when an already-ready player undoes it", async () => {
    const onSetReady = vi.fn();
    const ready = [{ ...players[0], finalCountReady: true }, players[1]];
    render(FinalCountScreen, { allCards, players: ready, selfPlayerId: "p1", ...noop, onSetReady });
    await fireEvent.click(screen.getByRole("button", { name: "J'ai terminé mon décompte (annuler)" }));
    expect(onSetReady).toHaveBeenCalledWith(false);
  });

  it("disables Terminer la partie until every player is ready, and names who is still counting", () => {
    render(FinalCountScreen, { allCards, players, selfPlayerId: "p1", ...noop });
    expect(screen.getByRole("button", { name: "Terminer la partie" })).toBeDisabled();
    expect(screen.getByText("En attente de : Alice, Bob")).toBeInTheDocument();
  });

  it("enables Terminer la partie once every player is ready", () => {
    const allReady = players.map((p) => ({ ...p, finalCountReady: true }));
    render(FinalCountScreen, { allCards, players: allReady, selfPlayerId: "p1", ...noop });
    expect(screen.getByRole("button", { name: "Terminer la partie" })).toBeEnabled();
    expect(screen.queryByText(/En attente de/)).not.toBeInTheDocument();
  });

  it("calls onEndGame when the finish button is clicked", async () => {
    const onEndGame = vi.fn();
    const allReady = players.map((p) => ({ ...p, finalCountReady: true }));
    render(FinalCountScreen, { allCards, players: allReady, selfPlayerId: "p1", ...noop, onEndGame });
    await fireEvent.click(screen.getByRole("button", { name: "Terminer la partie" }));
    expect(onEndGame).toHaveBeenCalled();
  });
});
