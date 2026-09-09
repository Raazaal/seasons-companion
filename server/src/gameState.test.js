import { describe, it, expect } from "vitest";
import { createInitialState, applyAction, GameActionError } from "./gameState.js";

describe("createInitialState", () => {
  it("starts in the lobby phase with a join code and no players", () => {
    const state = createInitialState();
    expect(state.phase).toBe("lobby");
    expect(state.joinCode).toMatch(/^[A-Z2-9]{4}$/);
    expect(state.players).toEqual([]);
    expect(state.turnOrder).toEqual([]);
    expect(state.activePlayerId).toBeNull();
    expect(state.history).toEqual([]);
  });
});

describe("JOIN_GAME", () => {
  it("adds a player with score 0 and an empty hand, and returns their id/token", () => {
    const state = createInitialState();
    const { state: next, result } = applyAction(state, {
      type: "JOIN_GAME",
      name: "Alice",
      color: "red",
    });
    expect(next.players).toHaveLength(1);
    expect(next.players[0]).toMatchObject({
      name: "Alice",
      color: "red",
      score: 0,
      hand: [],
      connected: true,
    });
    expect(result.playerId).toBe(next.players[0].id);
    expect(result.token).toBe(next.players[0].token);
  });

  it("rejects a duplicate color", () => {
    const state1 = createInitialState();
    const { state: state2 } = applyAction(state1, { type: "JOIN_GAME", name: "Alice", color: "red" });
    expect(() => applyAction(state2, { type: "JOIN_GAME", name: "Bob", color: "red" })).toThrow(GameActionError);
  });

  it("rejects a duplicate name", () => {
    const state1 = createInitialState();
    const { state: state2 } = applyAction(state1, { type: "JOIN_GAME", name: "Alice", color: "red" });
    expect(() => applyAction(state2, { type: "JOIN_GAME", name: "Alice", color: "blue" })).toThrow(GameActionError);
  });

  it("rejects joining once the game has started", () => {
    const state1 = createInitialState();
    const { state: state2 } = applyAction(state1, { type: "JOIN_GAME", name: "Alice", color: "red" });
    const { state: state3 } = applyAction(state2, { type: "JOIN_GAME", name: "Bob", color: "blue" });
    const { state: started } = applyAction(state3, { type: "START_GAME" });
    expect(() => applyAction(started, { type: "JOIN_GAME", name: "Carl", color: "green" })).toThrow(GameActionError);
  });
});

describe("START_GAME", () => {
  it("requires at least 2 players", () => {
    const state1 = createInitialState();
    const { state: state2 } = applyAction(state1, { type: "JOIN_GAME", name: "Alice", color: "red" });
    expect(() => applyAction(state2, { type: "START_GAME" })).toThrow(GameActionError);
  });

  it("sets phase to playing, turnOrder to join order, and activePlayerId to the first player", () => {
    const state1 = createInitialState();
    const { state: state2 } = applyAction(state1, { type: "JOIN_GAME", name: "Alice", color: "red" });
    const { state: state3 } = applyAction(state2, { type: "JOIN_GAME", name: "Bob", color: "blue" });
    const { state: started } = applyAction(state3, { type: "START_GAME" });
    expect(started.phase).toBe("playing");
    expect(started.turnOrder).toEqual([state3.players[0].id, state3.players[1].id]);
    expect(started.activePlayerId).toBe(state3.players[0].id);
  });
});
