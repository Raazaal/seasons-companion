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

describe("RECONNECT", () => {
  it("marks the matching player connected and returns their id", () => {
    const state1 = createInitialState();
    const { state: state2, result: joinResult } = applyAction(state1, {
      type: "JOIN_GAME",
      name: "Alice",
      color: "red",
    });
    const disconnected = { ...state2, players: state2.players.map((p) => ({ ...p, connected: false })) };
    const { state: state3, result } = applyAction(disconnected, { type: "RECONNECT", token: joinResult.token });
    expect(result.playerId).toBe(joinResult.playerId);
    expect(state3.players[0].connected).toBe(true);
  });

  it("rejects an unknown token", () => {
    const state = createInitialState();
    expect(() => applyAction(state, { type: "RECONNECT", token: "nope" })).toThrow(GameActionError);
  });
});

describe("DISCONNECT", () => {
  it("marks the player disconnected without touching score or history", () => {
    const state1 = createInitialState();
    const { state: state2, result } = applyAction(state1, { type: "JOIN_GAME", name: "Alice", color: "red" });
    const { state: state3 } = applyAction(state2, { type: "DISCONNECT", playerId: result.playerId });
    expect(state3.players[0].connected).toBe(false);
    expect(state3.players[0].score).toBe(0);
    expect(state3.history).toEqual([]);
  });
});

function startedTwoPlayerState() {
  const s1 = createInitialState();
  const { state: s2, result: alice } = applyAction(s1, { type: "JOIN_GAME", name: "Alice", color: "red" });
  const { state: s3, result: bob } = applyAction(s2, { type: "JOIN_GAME", name: "Bob", color: "blue" });
  const { state: started } = applyAction(s3, { type: "START_GAME" });
  return { state: started, alice, bob };
}

describe("ADJUST_SCORE", () => {
  it("applies a positive delta and records history", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: next } = applyAction(state, { type: "ADJUST_SCORE", playerId: alice.playerId, delta: 3 });
    const player = next.players.find((p) => p.id === alice.playerId);
    expect(player.score).toBe(3);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      playerId: alice.playerId,
      delta: 3,
      resultingScore: 3,
      source: "manual",
      actorPlayerId: alice.playerId,
    });
    expect(next.history[0].timestamp).toEqual(expect.any(Number));
  });

  it("floors the score at 0 on a negative delta", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: next } = applyAction(state, { type: "ADJUST_SCORE", playerId: alice.playerId, delta: -5 });
    expect(next.players.find((p) => p.id === alice.playerId).score).toBe(0);
    expect(next.history[0].resultingScore).toBe(0);
  });

  it("rejects adjustment outside the playing/final_count phases", () => {
    const state = createInitialState();
    const { state: joined, result } = applyAction(state, { type: "JOIN_GAME", name: "Alice", color: "red" });
    expect(() => applyAction(joined, { type: "ADJUST_SCORE", playerId: result.playerId, delta: 1 })).toThrow(
      GameActionError,
    );
  });
});

describe("NEXT_TURN", () => {
  it("advances to the next player in turnOrder, wrapping around", () => {
    const { state, alice, bob } = startedTwoPlayerState();
    const { state: turn2 } = applyAction(state, { type: "NEXT_TURN" });
    expect(turn2.activePlayerId).toBe(bob.playerId);
    const { state: turn3 } = applyAction(turn2, { type: "NEXT_TURN" });
    expect(turn3.activePlayerId).toBe(alice.playerId);
  });
});
