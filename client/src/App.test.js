import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";

vi.mock("./lib/store.js", async () => {
  const { writable } = await import("svelte/store");
  return {
    createGameStore: vi.fn(() => ({
      state: writable(null),
      selfPlayerId: writable(null),
      error: writable(null),
      send: vi.fn(),
    })),
  };
});

import App from "./App.svelte";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ id: "gain-self", name: "Gain Self", effects: [], endGameCrystals: null }]),
    }),
  );
});

describe("App", () => {
  it("shows the join screen when there is no player yet", () => {
    render(App);
    expect(screen.getByText("Seasons Companion")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
  });

  it("applies the self player's color as a CSS custom property once joined", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    createGameStore.mockReturnValueOnce({
      state: writable({
        phase: "playing",
        activePlayerId: "p1",
        turnOrder: ["p1"],
        players: [{ id: "p1", name: "Alice", color: "red", score: 0, hand: [] }],
        history: [],
      }),
      selfPlayerId: writable("p1"),
      error: writable(null),
      send: vi.fn(),
    });

    render(App);
    expect(screen.getByTestId("app-root")).toHaveStyle({ "--player-color": "red" });
  });

  it("shows a lobby with a disabled start button until 2 players have joined", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    createGameStore.mockReturnValueOnce({
      state: writable({
        phase: "lobby",
        activePlayerId: null,
        turnOrder: [],
        players: [{ id: "p1", name: "Alice", color: "red", score: 0, hand: [] }],
        history: [],
      }),
      selfPlayerId: writable("p1"),
      error: writable(null),
      send: vi.fn(),
    });

    render(App);
    expect(screen.getByRole("button", { name: "Démarrer la partie" })).toBeDisabled();
  });

  it("sends START_GAME once at least 2 players have joined", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    const send = vi.fn();
    createGameStore.mockReturnValueOnce({
      state: writable({
        phase: "lobby",
        activePlayerId: null,
        turnOrder: [],
        players: [
          { id: "p1", name: "Alice", color: "red", score: 0, hand: [] },
          { id: "p2", name: "Bob", color: "blue", score: 0, hand: [] },
        ],
        history: [],
      }),
      selfPlayerId: writable("p1"),
      error: writable(null),
      send,
    });

    render(App);
    const startButton = screen.getByRole("button", { name: "Démarrer la partie" });
    expect(startButton).toBeEnabled();
    await fireEvent.click(startButton);
    expect(send).toHaveBeenCalledWith({ type: "START_GAME" });
  });

  it("passes the game state's joinCode through to JoinScreen before joining", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    createGameStore.mockReturnValueOnce({
      state: writable({
        joinCode: "AB12",
        phase: "lobby",
        activePlayerId: null,
        turnOrder: [],
        players: [],
        history: [],
      }),
      selfPlayerId: writable(null),
      error: writable(null),
      send: vi.fn(),
    });

    render(App);
    expect(screen.getByText("Code de partie : AB12")).toBeInTheDocument();
  });

  it("sends START_FINAL_COUNT after confirmation when the 'Décompte final' button is clicked during play", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    const send = vi.fn();
    createGameStore.mockReturnValueOnce({
      state: writable({
        phase: "playing",
        activePlayerId: "p1",
        turnOrder: ["p1", "p2"],
        players: [
          { id: "p1", name: "Alice", color: "red", score: 0, hand: [] },
          { id: "p2", name: "Bob", color: "blue", score: 0, hand: [] },
        ],
        history: [],
      }),
      selfPlayerId: writable("p1"),
      error: writable(null),
      send,
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(App);
    await fireEvent.click(screen.getByRole("button", { name: "Décompte final" }));
    expect(confirm).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: "START_FINAL_COUNT" });
  });

  it("does not send START_FINAL_COUNT when the confirmation is declined", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    const send = vi.fn();
    createGameStore.mockReturnValueOnce({
      state: writable({
        phase: "playing",
        activePlayerId: "p1",
        turnOrder: ["p1", "p2"],
        players: [
          { id: "p1", name: "Alice", color: "red", score: 0, hand: [] },
          { id: "p2", name: "Bob", color: "blue", score: 0, hand: [] },
        ],
        history: [],
      }),
      selfPlayerId: writable("p1"),
      error: writable(null),
      send,
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    render(App);
    await fireEvent.click(screen.getByRole("button", { name: "Décompte final" }));
    expect(confirm).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalledWith({ type: "START_FINAL_COUNT" });
  });

  it("shows final scores and sends NEW_GAME after confirmation once the game has ended", async () => {
    const { writable } = await import("svelte/store");
    const { createGameStore } = await import("./lib/store.js");
    const send = vi.fn();
    createGameStore.mockReturnValueOnce({
      state: writable({
        phase: "ended",
        activePlayerId: null,
        turnOrder: ["p1", "p2"],
        players: [
          { id: "p1", name: "Alice", color: "red", score: 12, hand: [] },
          { id: "p2", name: "Bob", color: "blue", score: 9, hand: [] },
        ],
        history: [],
      }),
      selfPlayerId: writable("p1"),
      error: writable(null),
      send,
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(App);
    expect(screen.getByText("1er — Alice")).toBeInTheDocument();
    expect(screen.getByText("2ème — Bob")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Nouvelle partie" }));
    expect(confirm).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: "NEW_GAME" });
  });
});
