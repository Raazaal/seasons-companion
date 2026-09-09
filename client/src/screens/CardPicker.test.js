// client/src/screens/CardPicker.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import CardPicker from "./CardPicker.svelte";

const allCards = [
  { id: "gain-self", name: "Gain Self", effects: [{ target: "self", amount: 2 }], endGameCrystals: null },
  { id: "relic", name: "Relic", effects: [], endGameCrystals: 5 },
];

describe("CardPicker", () => {
  it("lists every card in the database and adds one on click", async () => {
    const onAddCard = vi.fn();
    render(CardPicker, { allCards, hand: [], onAddCard, onActivateCard: () => {}, onRemoveCard: () => {} });
    expect(screen.getByText("Gain Self")).toBeInTheDocument();
    expect(screen.getByText("Relic")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Ajouter Gain Self" }));
    expect(onAddCard).toHaveBeenCalledWith("gain-self");
  });

  it("lists hand cards with activate and remove buttons", async () => {
    const onActivateCard = vi.fn();
    const onRemoveCard = vi.fn();
    render(CardPicker, {
      allCards,
      hand: [{ cardId: "gain-self", instanceId: "inst-1" }],
      onAddCard: () => {},
      onActivateCard,
      onRemoveCard,
    });
    await fireEvent.click(screen.getByRole("button", { name: "Activer Gain Self" }));
    expect(onActivateCard).toHaveBeenCalledWith("gain-self");
    await fireEvent.click(screen.getByRole("button", { name: "Retirer Gain Self" }));
    expect(onRemoveCard).toHaveBeenCalledWith("inst-1");
  });
});
