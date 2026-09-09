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

  it("rejects a 5th player once 4 have joined", () => {
    let state = createInitialState();
    const names = [
      ["Alice", "red"],
      ["Bob", "blue"],
      ["Carl", "green"],
      ["Dana", "yellow"],
    ];
    for (const [name, color] of names) {
      ({ state } = applyAction(state, { type: "JOIN_GAME", name, color }));
    }
    expect(state.players).toHaveLength(4);
    expect(() => applyAction(state, { type: "JOIN_GAME", name: "Eve", color: "purple" })).toThrow(GameActionError);
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

describe("history seq", () => {
  it("increases monotonically across history entries within one game", () => {
    const { state, alice, bob } = startedTwoPlayerState();
    const { state: s1 } = applyAction(state, { type: "ADJUST_SCORE", playerId: alice.playerId, delta: 1 });
    const { state: s2 } = applyAction(s1, { type: "ADJUST_SCORE", playerId: bob.playerId, delta: 1 });
    const { state: s3 } = applyAction(s2, { type: "ADJUST_SCORE", playerId: alice.playerId, delta: 1 });
    expect(s3.history.map((entry) => entry.seq)).toEqual([0, 1, 2]);
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

const TEST_CARDS = new Map([
  ["gain-self", { id: "gain-self", name: "Gain Self", effects: [{ target: "self", amount: 2 }], endGameCrystals: null }],
  [
    "drain-opponents",
    {
      id: "drain-opponents",
      name: "Drain Opponents",
      effects: [{ target: "each_opponent", amount: -3 }],
      endGameCrystals: null,
    },
  ],
  [
    "bonus-all",
    { id: "bonus-all", name: "Bonus All", effects: [{ target: "all_players", amount: 1 }], endGameCrystals: null },
  ],
]);

describe("ADD_CARD_TO_HAND / REMOVE_CARD_FROM_HAND", () => {
  it("adds a card instance to the player's hand", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: next } = applyAction(
      state,
      { type: "ADD_CARD_TO_HAND", playerId: alice.playerId, cardId: "gain-self" },
      { cards: TEST_CARDS },
    );
    const hand = next.players.find((p) => p.id === alice.playerId).hand;
    expect(hand).toHaveLength(1);
    expect(hand[0].cardId).toBe("gain-self");
    expect(hand[0].instanceId).toEqual(expect.any(String));
  });

  it("rejects an unknown cardId", () => {
    const { state, alice } = startedTwoPlayerState();
    expect(() =>
      applyAction(state, { type: "ADD_CARD_TO_HAND", playerId: alice.playerId, cardId: "nope" }, { cards: TEST_CARDS }),
    ).toThrow(GameActionError);
  });

  it("removes a card instance by instanceId", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: added } = applyAction(
      state,
      { type: "ADD_CARD_TO_HAND", playerId: alice.playerId, cardId: "gain-self" },
      { cards: TEST_CARDS },
    );
    const instanceId = added.players.find((p) => p.id === alice.playerId).hand[0].instanceId;
    const { state: removed } = applyAction(added, {
      type: "REMOVE_CARD_FROM_HAND",
      playerId: alice.playerId,
      instanceId,
    });
    expect(removed.players.find((p) => p.id === alice.playerId).hand).toEqual([]);
  });
});

describe("ACTIVATE_CARD", () => {
  it("applies a self effect only to the actor", () => {
    const { state, alice, bob } = startedTwoPlayerState();
    const { state: next } = applyAction(
      state,
      { type: "ACTIVATE_CARD", actorPlayerId: alice.playerId, cardId: "gain-self" },
      { cards: TEST_CARDS },
    );
    expect(next.players.find((p) => p.id === alice.playerId).score).toBe(2);
    expect(next.players.find((p) => p.id === bob.playerId).score).toBe(0);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      playerId: alice.playerId,
      delta: 2,
      source: "card_effect",
      actorPlayerId: alice.playerId,
      cardId: "gain-self",
      cardName: "Gain Self",
    });
  });

  it("applies an each_opponent effect to every player except the actor, flooring at 0", () => {
    const { state, alice, bob } = startedTwoPlayerState();
    const { state: next } = applyAction(
      state,
      { type: "ACTIVATE_CARD", actorPlayerId: alice.playerId, cardId: "drain-opponents" },
      { cards: TEST_CARDS },
    );
    expect(next.players.find((p) => p.id === alice.playerId).score).toBe(0);
    expect(next.players.find((p) => p.id === bob.playerId).score).toBe(0);
    expect(next.history).toHaveLength(1);
    expect(next.history[0].playerId).toBe(bob.playerId);
    expect(next.history[0].actorPlayerId).toBe(alice.playerId);
  });

  it("applies an all_players effect to every player including the actor", () => {
    const { state, alice, bob } = startedTwoPlayerState();
    const { state: next } = applyAction(
      state,
      { type: "ACTIVATE_CARD", actorPlayerId: alice.playerId, cardId: "bonus-all" },
      { cards: TEST_CARDS },
    );
    expect(next.players.find((p) => p.id === alice.playerId).score).toBe(1);
    expect(next.players.find((p) => p.id === bob.playerId).score).toBe(1);
    expect(next.history).toHaveLength(2);
  });

  it("can be activated more than once", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: once } = applyAction(
      state,
      { type: "ACTIVATE_CARD", actorPlayerId: alice.playerId, cardId: "gain-self" },
      { cards: TEST_CARDS },
    );
    const { state: twice } = applyAction(
      once,
      { type: "ACTIVATE_CARD", actorPlayerId: alice.playerId, cardId: "gain-self" },
      { cards: TEST_CARDS },
    );
    expect(twice.players.find((p) => p.id === alice.playerId).score).toBe(4);
  });
});

describe("final count and end game", () => {
  it("START_FINAL_COUNT moves phase from playing to final_count", () => {
    const { state } = startedTwoPlayerState();
    const { state: next } = applyAction(state, { type: "START_FINAL_COUNT" });
    expect(next.phase).toBe("final_count");
  });

  it("START_FINAL_COUNT initializes an empty invoked-cards list and freezes the base score", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: adjusted } = applyAction(state, { type: "ADJUST_SCORE", playerId: alice.playerId, delta: 3 });
    const { state: counting } = applyAction(adjusted, { type: "START_FINAL_COUNT" });
    const player = counting.players.find((p) => p.id === alice.playerId);
    expect(player.finalCards).toEqual([]);
    expect(player.finalCountBaseScore).toBe(3);
  });

  const cardsWithCrystals = new Map(TEST_CARDS);
  cardsWithCrystals.set("relic", { id: "relic", name: "Relic", effects: [], endGameCrystals: 5 });
  cardsWithCrystals.set("cursed-relic", { id: "cursed-relic", name: "Cursed Relic", effects: [], endGameCrystals: -10 });

  it("ADD_FINAL_CARD rejects a card with no end-game value", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    expect(() =>
      applyAction(
        counting,
        { type: "ADD_FINAL_CARD", playerId: alice.playerId, cardId: "gain-self" },
        { cards: TEST_CARDS },
      ),
    ).toThrow(GameActionError);
  });

  it("ADD_FINAL_CARD records the card in the player's invoked list and applies its value", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: next } = applyAction(
      counting,
      { type: "ADD_FINAL_CARD", playerId: alice.playerId, cardId: "relic" },
      { cards: cardsWithCrystals },
    );
    const player = next.players.find((p) => p.id === alice.playerId);
    expect(player.score).toBe(5);
    expect(player.finalCards).toHaveLength(1);
    expect(player.finalCards[0]).toMatchObject({ cardId: "relic" });
    expect(player.finalCards[0].instanceId).toEqual(expect.any(String));
    expect(next.history[0]).toMatchObject({ source: "final_count", cardId: "relic", cardName: "Relic" });
  });

  it("allows adding the same card more than once", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: once } = applyAction(
      counting,
      { type: "ADD_FINAL_CARD", playerId: alice.playerId, cardId: "relic" },
      { cards: cardsWithCrystals },
    );
    const { state: twice } = applyAction(
      once,
      { type: "ADD_FINAL_CARD", playerId: alice.playerId, cardId: "relic" },
      { cards: cardsWithCrystals },
    );
    const player = twice.players.find((p) => p.id === alice.playerId);
    expect(player.score).toBe(10);
    expect(player.finalCards).toHaveLength(2);
  });

  it("REMOVE_FINAL_CARD reverses the card's value and removes it from the invoked list", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: added } = applyAction(
      counting,
      { type: "ADD_FINAL_CARD", playerId: alice.playerId, cardId: "relic" },
      { cards: cardsWithCrystals },
    );
    const instanceId = added.players.find((p) => p.id === alice.playerId).finalCards[0].instanceId;
    const { state: removed } = applyAction(
      added,
      { type: "REMOVE_FINAL_CARD", playerId: alice.playerId, instanceId },
      { cards: cardsWithCrystals },
    );
    const player = removed.players.find((p) => p.id === alice.playerId);
    expect(player.score).toBe(0);
    expect(player.finalCards).toEqual([]);
    expect(removed.history.at(-1)).toMatchObject({ source: "final_count_removal", cardId: "relic" });
  });

  it("REMOVE_FINAL_CARD rejects an unknown instanceId", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    expect(() =>
      applyAction(
        counting,
        { type: "REMOVE_FINAL_CARD", playerId: alice.playerId, instanceId: "nope" },
        { cards: cardsWithCrystals },
      ),
    ).toThrow(GameActionError);
  });

  it("recomputes the score from the remaining invoked cards, not a running delta, so removal after a floor is exact", () => {
    // Regression guard: if the score were adjusted via one-off +/- deltas
    // instead of being recomputed from the invoked-card list, a negative
    // card that gets floored at 0 would "give back" too much once removed
    // (undoing a floored delta overshoots). Recomputing from scratch avoids
    // that entirely.
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: cursed } = applyAction(
      counting,
      { type: "ADD_FINAL_CARD", playerId: alice.playerId, cardId: "cursed-relic" },
      { cards: cardsWithCrystals },
    );
    expect(cursed.players.find((p) => p.id === alice.playerId).score).toBe(0);
    const instanceId = cursed.players.find((p) => p.id === alice.playerId).finalCards[0].instanceId;
    const { state: removed } = applyAction(
      cursed,
      { type: "REMOVE_FINAL_CARD", playerId: alice.playerId, instanceId },
      { cards: cardsWithCrystals },
    );
    expect(removed.players.find((p) => p.id === alice.playerId).score).toBe(0);
  });

  it("END_GAME moves phase from final_count to ended and blocks further score actions", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: ended } = applyAction(counting, { type: "END_GAME" });
    expect(ended.phase).toBe("ended");
    expect(() => applyAction(ended, { type: "ADJUST_SCORE", playerId: alice.playerId, delta: 1 })).toThrow(
      GameActionError,
    );
  });
});

describe("NEW_GAME", () => {
  it("resets to a fresh lobby with a new join code and no players", () => {
    const { state } = startedTwoPlayerState();
    const { state: next } = applyAction(state, { type: "NEW_GAME" });
    expect(next.phase).toBe("lobby");
    expect(next.players).toEqual([]);
    expect(next.history).toEqual([]);
    expect(next.joinCode).toEqual(expect.any(String));
  });
});
