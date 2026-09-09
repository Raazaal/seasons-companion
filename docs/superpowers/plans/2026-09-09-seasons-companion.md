# Seasons Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time, multi-device score companion for the board game Seasons: 2-4 players track/adjust crystal scores from their phones, synced live, with a predefined card database whose effects apply to all players, a turn tracker, a separate final-count step, and a public per-player history.

**Architecture:** A single Node.js process (server) run under Termux on the host's phone serves a static Svelte build and runs a WebSocket server. The server holds the one canonical game state in memory (players, scores, history, phase), applies every client action through a pure reducer, persists the full state to a JSON file after each mutation, and rebroadcasts the full state to every connected client. Clients hold no score logic — they render whatever the server sends and reconnect using a token stored in `localStorage`.

**Tech Stack:** Node.js (`express`, `ws`, no native-binary dependencies), Vitest for server tests. Svelte 5 + Vite for the client, `@testing-library/svelte` + `jsdom` for component tests. npm workspaces for the monorepo.

**Spec:** [docs/superpowers/specs/2026-09-09-seasons-companion-design.md](../specs/2026-09-09-seasons-companion-design.md)

## Global Constraints

- No dependency that requires native compilation (must install reliably under Termux/Android) — plain `ws`, not Socket.IO; no `better-sqlite3`.
- A player's score is always `>= 0` (floor at 0 on every delta, never negative).
- Exactly one active game per running server instance — no multi-session/game-id routing.
- State persists to a single JSON file (`server/data/game-state.json`), written atomically (temp file + rename) after every mutating action.
- All history entries are append-only and visible to every player (no per-player privacy on history).
- Card effect targets are only `self`, `each_opponent`, `all_players` — no `choose_opponent` (YAGNI, add later if a card needs it).
- Card database covers the Seasons base game only (no expansion).
- Reconnection is via a private token stored client-side in `localStorage`; the server never re-derives identity by name.

---

## Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json` (root, npm workspaces)
- Create: `.gitignore`
- Create: `server/package.json`
- Create: `server/vitest.config.js`
- Create: `server/src/smoke.test.js`
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/src/smoke.test.js`

**Interfaces:**
- Produces: `npm test --workspace server` and `npm test --workspace client` both runnable from repo root.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "seasons-companion",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "build": "npm run build --workspace client",
    "start": "npm run start --workspace server",
    "test": "npm test --workspace server && npm test --workspace client"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
client/dist/
server/data/*.json
```

- [ ] **Step 3: Create `server/package.json`**

```json
{
  "name": "seasons-companion-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Create `server/vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

- [ ] **Step 5: Create a failing smoke test `server/src/smoke.test.js`**

```js
import { describe, it, expect } from "vitest";

describe("server tooling", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(3);
  });
});
```

- [ ] **Step 6: Install server deps and run to confirm it fails**

Run: `cd server && npm install && npm test`
Expected: FAIL (`1 + 1` is not `3`)

- [ ] **Step 7: Fix the assertion**

```js
import { describe, it, expect } from "vitest";

describe("server tooling", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run to confirm it passes**

Run: `npm test` (inside `server/`)
Expected: PASS

- [ ] **Step 9: Create `client/package.json`**

```json
{
  "name": "seasons-companion-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@testing-library/svelte": "^5.2.0",
    "jsdom": "^25.0.0",
    "svelte": "^5.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 10: Create `client/vite.config.js`**

```js
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 11: Create a failing smoke test `client/src/smoke.test.js`**

```js
import { describe, it, expect } from "vitest";

describe("client tooling", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(3);
  });
});
```

- [ ] **Step 12: Install client deps and run to confirm it fails**

Run: `cd client && npm install && npm test`
Expected: FAIL

- [ ] **Step 13: Fix the assertion and confirm it passes**

Change `toBe(3)` to `toBe(2)` in `client/src/smoke.test.js`.
Run: `npm test` (inside `client/`)
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add package.json .gitignore server/package.json server/vitest.config.js server/src/smoke.test.js client/package.json client/vite.config.js client/src/smoke.test.js server/package-lock.json client/package-lock.json
git commit -m "chore: scaffold monorepo with server and client tooling"
```

---

## Task 2: ID and join-code generation

**Files:**
- Create: `server/src/ids.js`
- Test: `server/src/ids.test.js`

**Interfaces:**
- Produces: `generateJoinCode(length = 4): string`, `generateId(): string`, `generateToken(): string`

- [ ] **Step 1: Write the failing tests**

```js
// server/src/ids.test.js
import { describe, it, expect } from "vitest";
import { generateJoinCode, generateId, generateToken } from "./ids.js";

describe("generateJoinCode", () => {
  it("returns a 4-character code from the unambiguous charset", () => {
    const code = generateJoinCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it("supports a custom length", () => {
    expect(generateJoinCode(6)).toHaveLength(6);
  });
});

describe("generateId / generateToken", () => {
  it("returns distinct UUID-like strings", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("generateToken also returns a distinct UUID-like string", () => {
    expect(generateToken()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ids.test.js` (inside `server/`)
Expected: FAIL with "Cannot find module './ids.js'"

- [ ] **Step 3: Implement**

```js
// server/src/ids.js
import { randomInt, randomUUID } from "node:crypto";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 4) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

export function generateId() {
  return randomUUID();
}

export function generateToken() {
  return randomUUID();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- ids.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/ids.js server/src/ids.test.js
git commit -m "feat(server): add id and join-code generators"
```

---

## Task 3: Game state — create, join, start

**Files:**
- Create: `server/src/gameState.js`
- Test: `server/src/gameState.test.js`

**Interfaces:**
- Consumes: `generateJoinCode()`, `generateId()`, `generateToken()` from `./ids.js` (Task 2)
- Produces: `GameActionError`, `createInitialState(): GameState`, `applyAction(state, action, context = {}): { state: GameState, result?: object }` (this task handles `JOIN_GAME`, `START_GAME`; later tasks extend the same `switch`)

- [ ] **Step 1: Write the failing tests**

```js
// server/src/gameState.test.js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- gameState.test.js` (inside `server/`)
Expected: FAIL with "Cannot find module './gameState.js'"

- [ ] **Step 3: Implement**

```js
// server/src/gameState.js
import { generateId, generateToken, generateJoinCode } from "./ids.js";

export class GameActionError extends Error {}

export function createInitialState() {
  return {
    joinCode: generateJoinCode(),
    players: [],
    turnOrder: [],
    activePlayerId: null,
    phase: "lobby",
    history: [],
  };
}

function assertPhase(state, allowed) {
  if (!allowed.includes(state.phase)) {
    throw new GameActionError(`Action not allowed in phase "${state.phase}"`);
  }
}

function findPlayer(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new GameActionError(`Unknown player: ${playerId}`);
  return player;
}

function joinGame(state, action) {
  assertPhase(state, ["lobby"]);
  const { name, color } = action;
  if (state.players.some((p) => p.name === name)) {
    throw new GameActionError(`Name already taken: ${name}`);
  }
  if (state.players.some((p) => p.color === color)) {
    throw new GameActionError(`Color already taken: ${color}`);
  }
  const player = {
    id: generateId(),
    token: generateToken(),
    name,
    color,
    score: 0,
    hand: [],
    connected: true,
  };
  const nextState = { ...state, players: [...state.players, player] };
  return { state: nextState, result: { playerId: player.id, token: player.token } };
}

function startGame(state) {
  assertPhase(state, ["lobby"]);
  if (state.players.length < 2) {
    throw new GameActionError("At least 2 players are required to start");
  }
  const turnOrder = state.players.map((p) => p.id);
  return {
    state: { ...state, phase: "playing", turnOrder, activePlayerId: turnOrder[0] },
  };
}

export function applyAction(state, action, context = {}) {
  switch (action.type) {
    case "JOIN_GAME":
      return joinGame(state, action);
    case "START_GAME":
      return startGame(state, action);
    default:
      throw new GameActionError(`Unknown action type: ${action.type}`);
  }
}

export { findPlayer, assertPhase };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- gameState.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/gameState.js server/src/gameState.test.js
git commit -m "feat(server): game state with JOIN_GAME and START_GAME"
```

---

## Task 4: Game state — reconnect and disconnect

**Files:**
- Modify: `server/src/gameState.js`
- Modify: `server/src/gameState.test.js`

**Interfaces:**
- Consumes: `findPlayer`, `assertPhase` from Task 3
- Produces: `applyAction` now also handles `RECONNECT { token }` (result: `{ playerId }`) and `DISCONNECT { playerId }`

- [ ] **Step 1: Add the failing tests**

Append to `server/src/gameState.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- gameState.test.js`
Expected: FAIL (`RECONNECT`/`DISCONNECT` hit the `default` case and throw "Unknown action type")

- [ ] **Step 3: Implement**

Add to `server/src/gameState.js`, above `applyAction`:

```js
function reconnect(state, action) {
  const player = state.players.find((p) => p.token === action.token);
  if (!player) throw new GameActionError("Invalid reconnection token");
  const nextState = {
    ...state,
    players: state.players.map((p) => (p.id === player.id ? { ...p, connected: true } : p)),
  };
  return { state: nextState, result: { playerId: player.id } };
}

function disconnect(state, action) {
  findPlayer(state, action.playerId);
  const nextState = {
    ...state,
    players: state.players.map((p) => (p.id === action.playerId ? { ...p, connected: false } : p)),
  };
  return { state: nextState };
}
```

Add two cases to the `switch` in `applyAction`:

```js
    case "RECONNECT":
      return reconnect(state, action);
    case "DISCONNECT":
      return disconnect(state, action);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- gameState.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/gameState.js server/src/gameState.test.js
git commit -m "feat(server): RECONNECT and DISCONNECT actions"
```

---

## Task 5: Game state — manual score adjustment and turn order

**Files:**
- Modify: `server/src/gameState.js`
- Modify: `server/src/gameState.test.js`

**Interfaces:**
- Produces: `applyAction` now also handles `ADJUST_SCORE { playerId, delta }` and `NEXT_TURN {}`

- [ ] **Step 1: Add the failing tests**

Append to `server/src/gameState.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- gameState.test.js`
Expected: FAIL ("Unknown action type: ADJUST_SCORE")

- [ ] **Step 3: Implement**

Add to `server/src/gameState.js`:

```js
function addHistoryEntry(state, entry) {
  return { ...state, history: [...state.history, { timestamp: Date.now(), ...entry }] };
}

function applyScoreDelta(state, playerId, delta, meta) {
  const player = findPlayer(state, playerId);
  const resultingScore = Math.max(0, player.score + delta);
  const nextState = {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, score: resultingScore } : p)),
  };
  return addHistoryEntry(nextState, { playerId, delta, resultingScore, ...meta });
}

function adjustScore(state, action) {
  assertPhase(state, ["playing", "final_count"]);
  const nextState = applyScoreDelta(state, action.playerId, action.delta, {
    source: "manual",
    actorPlayerId: action.playerId,
  });
  return { state: nextState };
}

function nextTurn(state) {
  assertPhase(state, ["playing"]);
  const currentIndex = state.turnOrder.indexOf(state.activePlayerId);
  const nextIndex = (currentIndex + 1) % state.turnOrder.length;
  return { state: { ...state, activePlayerId: state.turnOrder[nextIndex] } };
}
```

Add to the `switch`:

```js
    case "ADJUST_SCORE":
      return adjustScore(state, action);
    case "NEXT_TURN":
      return nextTurn(state, action);
```

Export `applyScoreDelta` and `addHistoryEntry` alongside the existing exports (`export { findPlayer, assertPhase, applyScoreDelta, addHistoryEntry };`) — Task 7 reuses them for card effects.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- gameState.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/gameState.js server/src/gameState.test.js
git commit -m "feat(server): ADJUST_SCORE and NEXT_TURN actions"
```

---

## Task 6: Card schema and loader

**Files:**
- Create: `server/src/cards.js`
- Test: `server/src/cards.test.js`

**Interfaces:**
- Produces: `CardValidationError`, `validateCardList(cards: Card[]): void` (throws on error), `loadCardsFromFile(filePath: string): Map<string, Card>`

- [ ] **Step 1: Write the failing tests**

```js
// server/src/cards.test.js
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCardList, loadCardsFromFile, CardValidationError } from "./cards.js";

const VALID_CARDS = [
  { id: "sundial", name: "Sundial", effects: [{ target: "self", amount: 2 }], endGameCrystals: null },
  {
    id: "burning-glass",
    name: "Burning Glass",
    effects: [{ target: "each_opponent", amount: -1 }],
    endGameCrystals: 3,
  },
];

describe("validateCardList", () => {
  it("accepts a well-formed list", () => {
    expect(() => validateCardList(VALID_CARDS)).not.toThrow();
  });

  it("rejects duplicate ids", () => {
    const dup = [...VALID_CARDS, VALID_CARDS[0]];
    expect(() => validateCardList(dup)).toThrow(CardValidationError);
  });

  it("rejects an invalid effect target", () => {
    const bad = [{ id: "x", name: "X", effects: [{ target: "choose_opponent", amount: 1 }], endGameCrystals: null }];
    expect(() => validateCardList(bad)).toThrow(CardValidationError);
  });

  it("rejects a non-integer effect amount", () => {
    const bad = [{ id: "x", name: "X", effects: [{ target: "self", amount: 1.5 }], endGameCrystals: null }];
    expect(() => validateCardList(bad)).toThrow(CardValidationError);
  });

  it("rejects a missing name", () => {
    const bad = [{ id: "x", effects: [], endGameCrystals: null }];
    expect(() => validateCardList(bad)).toThrow(CardValidationError);
  });
});

describe("loadCardsFromFile", () => {
  it("reads a JSON file and returns a Map keyed by card id", () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-test-"));
    const filePath = join(dir, "cards.json");
    writeFileSync(filePath, JSON.stringify(VALID_CARDS), "utf8");
    const cards = loadCardsFromFile(filePath);
    expect(cards).toBeInstanceOf(Map);
    expect(cards.get("sundial")).toEqual(VALID_CARDS[0]);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- cards.test.js` (inside `server/`)
Expected: FAIL with "Cannot find module './cards.js'"

- [ ] **Step 3: Implement**

```js
// server/src/cards.js
import { readFileSync } from "node:fs";

export class CardValidationError extends Error {}

const VALID_TARGETS = new Set(["self", "each_opponent", "all_players"]);

function validateCard(card, index) {
  const label = `cards[${index}]`;
  if (typeof card.id !== "string" || card.id.length === 0) {
    throw new CardValidationError(`${label}: missing id`);
  }
  if (typeof card.name !== "string" || card.name.length === 0) {
    throw new CardValidationError(`${label} (${card.id}): missing name`);
  }
  if (!Array.isArray(card.effects)) {
    throw new CardValidationError(`${label} (${card.id}): effects must be an array`);
  }
  for (const effect of card.effects) {
    if (!VALID_TARGETS.has(effect.target)) {
      throw new CardValidationError(`${label} (${card.id}): invalid effect target "${effect.target}"`);
    }
    if (!Number.isInteger(effect.amount)) {
      throw new CardValidationError(`${label} (${card.id}): effect amount must be an integer`);
    }
  }
  if (card.endGameCrystals !== null && !Number.isInteger(card.endGameCrystals)) {
    throw new CardValidationError(`${label} (${card.id}): endGameCrystals must be an integer or null`);
  }
}

export function validateCardList(cards) {
  const seenIds = new Set();
  cards.forEach((card, index) => {
    validateCard(card, index);
    if (seenIds.has(card.id)) {
      throw new CardValidationError(`Duplicate card id: ${card.id}`);
    }
    seenIds.add(card.id);
  });
}

export function loadCardsFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const cards = JSON.parse(raw);
  validateCardList(cards);
  return new Map(cards.map((card) => [card.id, card]));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- cards.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/cards.js server/src/cards.test.js
git commit -m "feat(server): card schema validation and loader"
```

---

## Task 7: Game state — hand management and card activation

**Files:**
- Modify: `server/src/gameState.js`
- Modify: `server/src/gameState.test.js`

**Interfaces:**
- Consumes: `applyScoreDelta`, `addHistoryEntry`, `findPlayer`, `assertPhase` (Tasks 3/5); a `context.cards: Map<string, Card>` (shape from Task 6) is now required by `applyAction` for card-related actions
- Produces: `applyAction` now also handles `ADD_CARD_TO_HAND { playerId, cardId }`, `REMOVE_CARD_FROM_HAND { playerId, instanceId }`, `ACTIVATE_CARD { actorPlayerId, cardId }`

- [ ] **Step 1: Add the failing tests**

Append to `server/src/gameState.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- gameState.test.js`
Expected: FAIL ("Unknown action type: ADD_CARD_TO_HAND")

- [ ] **Step 3: Implement**

Add to `server/src/gameState.js` (near the top, alongside other imports):

```js
function requireCard(context, cardId) {
  const card = context.cards?.get(cardId);
  if (!card) throw new GameActionError(`Unknown card: ${cardId}`);
  return card;
}

function addCardToHand(state, action, context) {
  assertPhase(state, ["playing"]);
  const card = requireCard(context, action.cardId);
  const player = findPlayer(state, action.playerId);
  const instance = { cardId: card.id, instanceId: generateId() };
  return {
    state: {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, hand: [...p.hand, instance] } : p)),
    },
  };
}

function removeCardFromHand(state, action) {
  assertPhase(state, ["playing"]);
  const player = findPlayer(state, action.playerId);
  return {
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, hand: p.hand.filter((c) => c.instanceId !== action.instanceId) } : p,
      ),
    },
  };
}

function effectTargets(effect, actorPlayerId, players) {
  switch (effect.target) {
    case "self":
      return [actorPlayerId];
    case "each_opponent":
      return players.filter((p) => p.id !== actorPlayerId).map((p) => p.id);
    case "all_players":
      return players.map((p) => p.id);
    default:
      throw new GameActionError(`Unknown effect target: ${effect.target}`);
  }
}

function activateCard(state, action, context) {
  assertPhase(state, ["playing"]);
  const card = requireCard(context, action.cardId);
  findPlayer(state, action.actorPlayerId);
  let nextState = state;
  for (const effect of card.effects) {
    const targets = effectTargets(effect, action.actorPlayerId, state.players);
    for (const targetPlayerId of targets) {
      nextState = applyScoreDelta(nextState, targetPlayerId, effect.amount, {
        source: "card_effect",
        actorPlayerId: action.actorPlayerId,
        cardId: card.id,
        cardName: card.name,
      });
    }
  }
  return { state: nextState };
}
```

Add three cases to the `switch` in `applyAction` (note the `context` parameter is now threaded through):

```js
    case "ADD_CARD_TO_HAND":
      return addCardToHand(state, action, context);
    case "REMOVE_CARD_FROM_HAND":
      return removeCardFromHand(state, action);
    case "ACTIVATE_CARD":
      return activateCard(state, action, context);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- gameState.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/gameState.js server/src/gameState.test.js
git commit -m "feat(server): hand management and card activation"
```

---

## Task 8: Game state — final count, end game, new game

**Files:**
- Modify: `server/src/gameState.js`
- Modify: `server/src/gameState.test.js`

**Interfaces:**
- Produces: `applyAction` now also handles `START_FINAL_COUNT {}`, `ADD_FINAL_CRYSTALS { playerId, cardId }`, `END_GAME {}`, `NEW_GAME {}`

- [ ] **Step 1: Add the failing tests**

Append to `server/src/gameState.test.js`:

```js
describe("final count and end game", () => {
  it("START_FINAL_COUNT moves phase from playing to final_count", () => {
    const { state } = startedTwoPlayerState();
    const { state: next } = applyAction(state, { type: "START_FINAL_COUNT" });
    expect(next.phase).toBe("final_count");
  });

  it("ADD_FINAL_CRYSTALS applies endGameCrystals with source final_count", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: next } = applyAction(
      counting,
      { type: "ADD_FINAL_CRYSTALS", playerId: alice.playerId, cardId: "drain-opponents" },
      { cards: TEST_CARDS },
    );
    // drain-opponents has no endGameCrystals (null) in TEST_CARDS, so use a card that has one
  });

  it("ADD_FINAL_CRYSTALS rejects a card with no end-game value", () => {
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    expect(() =>
      applyAction(
        counting,
        { type: "ADD_FINAL_CRYSTALS", playerId: alice.playerId, cardId: "gain-self" },
        { cards: TEST_CARDS },
      ),
    ).toThrow(GameActionError);
  });

  it("ADD_FINAL_CRYSTALS applies a positive end-game value", () => {
    const cardsWithCrystals = new Map(TEST_CARDS);
    cardsWithCrystals.set("relic", {
      id: "relic",
      name: "Relic",
      effects: [],
      endGameCrystals: 5,
    });
    const { state, alice } = startedTwoPlayerState();
    const { state: counting } = applyAction(state, { type: "START_FINAL_COUNT" });
    const { state: next } = applyAction(
      counting,
      { type: "ADD_FINAL_CRYSTALS", playerId: alice.playerId, cardId: "relic" },
      { cards: cardsWithCrystals },
    );
    expect(next.players.find((p) => p.id === alice.playerId).score).toBe(5);
    expect(next.history[0]).toMatchObject({ source: "final_count", cardId: "relic", cardName: "Relic" });
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- gameState.test.js`
Expected: FAIL ("Unknown action type: START_FINAL_COUNT")

- [ ] **Step 3: Implement**

Add to `server/src/gameState.js`:

```js
function startFinalCount(state) {
  assertPhase(state, ["playing"]);
  return { state: { ...state, phase: "final_count" } };
}

function addFinalCrystals(state, action, context) {
  assertPhase(state, ["final_count"]);
  const card = requireCard(context, action.cardId);
  if (card.endGameCrystals === null || card.endGameCrystals === undefined) {
    throw new GameActionError(`Card ${card.id} has no end-game crystal value`);
  }
  const nextState = applyScoreDelta(state, action.playerId, card.endGameCrystals, {
    source: "final_count",
    actorPlayerId: action.playerId,
    cardId: card.id,
    cardName: card.name,
  });
  return { state: nextState };
}

function endGame(state) {
  assertPhase(state, ["final_count"]);
  return { state: { ...state, phase: "ended" } };
}

function newGame() {
  return { state: createInitialState() };
}
```

Add four cases to the `switch` in `applyAction`:

```js
    case "START_FINAL_COUNT":
      return startFinalCount(state, action);
    case "ADD_FINAL_CRYSTALS":
      return addFinalCrystals(state, action, context);
    case "END_GAME":
      return endGame(state, action);
    case "NEW_GAME":
      return newGame(state, action);
```

- [ ] **Step 4: Remove the incomplete test stub**

Delete the first `it("ADD_FINAL_CRYSTALS applies endGameCrystals with source final_count" ...)` block added in Step 1 — it was a scratch note superseded by the "applies a positive end-game value" test right after it.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- gameState.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/gameState.js server/src/gameState.test.js
git commit -m "feat(server): final count, end game, and new game actions"
```

---

## Task 9: Persistence

**Files:**
- Create: `server/src/persistence.js`
- Test: `server/src/persistence.test.js`

**Interfaces:**
- Produces: `saveState(filePath: string, state: object): Promise<void>`, `loadState(filePath: string): Promise<object | null>`

- [ ] **Step 1: Write the failing tests**

```js
// server/src/persistence.test.js
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveState, loadState } from "./persistence.js";

let dir;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("saveState / loadState", () => {
  it("round-trips an object through disk", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const filePath = join(dir, "nested", "game-state.json");
    const state = { phase: "lobby", players: [] };
    await saveState(filePath, state);
    expect(existsSync(filePath)).toBe(true);
    const loaded = await loadState(filePath);
    expect(loaded).toEqual(state);
  });

  it("loadState returns null when the file does not exist", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const loaded = await loadState(join(dir, "missing.json"));
    expect(loaded).toBeNull();
  });

  it("does not leave a .tmp file behind after saving", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const filePath = join(dir, "game-state.json");
    await saveState(filePath, { a: 1 });
    expect(existsSync(`${filePath}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- persistence.test.js` (inside `server/`)
Expected: FAIL with "Cannot find module './persistence.js'"

- [ ] **Step 3: Implement**

```js
// server/src/persistence.js
import { writeFile, rename, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function saveState(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tmpPath, filePath);
}

export async function loadState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- persistence.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/persistence.js server/src/persistence.test.js
git commit -m "feat(server): atomic JSON persistence for game state"
```

---

## Task 10: Seasons base-game card database

**Files:**
- Create: `server/src/cards.json`
- Test: `server/src/cards.data.test.js`

**Interfaces:**
- Consumes: `validateCardList` from Task 6
- Produces: `server/src/cards.json`, the real data `loadCardsFromFile("./cards.json")` will load at server startup (Task 12)

This task is data compilation, not logic. Source the card list and exact wording/effects from the **official Seasons rulebook** (PDF available from Libellud/Asmodee) and cross-check against the community reference card list on BoardGameGeek (search "Seasons card list") — do not invent numbers. Only include cards from the Seasons base game (no "Enclave of the Dead" expansion cards).

- [ ] **Step 1: Write the failing data test**

```js
// server/src/cards.data.test.js
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateCardList, loadCardsFromFile } from "./cards.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cards = [...loadCardsFromFile(join(__dirname, "cards.json")).values()];

describe("cards.json", () => {
  it("is a non-empty, schema-valid list covering the Seasons base game", () => {
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);
    expect(() => validateCardList(cards)).not.toThrow();
  });

  it("every card has a non-empty name and a unique id", () => {
    const ids = new Set();
    for (const card of cards) {
      expect(card.name.trim().length).toBeGreaterThan(0);
      expect(ids.has(card.id)).toBe(false);
      ids.add(card.id);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- cards.data.test.js` (inside `server/`)
Expected: FAIL (`cards.json` does not exist yet)

- [ ] **Step 3: Compile `server/src/cards.json`**

Create one entry per Seasons base-game card, following the schema from Task 6:

```json
[
  {
    "id": "example-slug",
    "name": "Example Card Name",
    "effects": [{ "target": "self", "amount": 2 }],
    "endGameCrystals": null
  }
]
```

Guidelines while compiling the real list:
- `id`: a kebab-case slug derived from the card's name, unique across the file.
- `effects`: only include entries for cards whose printed text is an immediate, unconditional crystal gain/loss for the activating player and/or opponents (matches `self` / `each_opponent` / `all_players`). Cards whose effect is conditional on game state the app doesn't track (dice, tokens, mana crystals of a specific color, library level, etc.) still get an entry in `cards.json` for the purpose of the final-count screen, but with `effects: []` — the app does not attempt to auto-apply effects it cannot safely resolve without the player's own judgement.
- `endGameCrystals`: the fixed victory-point value printed on the card for end-of-game scoring, or `null` if the card has none.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- cards.data.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/cards.json server/src/cards.data.test.js
git commit -m "feat(server): compile Seasons base-game card database"
```

---

## Task 11: WebSocket server

**Files:**
- Create: `server/src/wsServer.js`
- Test: `server/src/wsServer.test.js`

**Interfaces:**
- Consumes: `applyAction`, `createInitialState`, `GameActionError` (gameState.js), `saveState` (persistence.js)
- Produces: `createWsServer(httpServer, { cards, statePath, initialState }): { wss: WebSocketServer, getState(): GameState }`. Wire protocol — client→server: raw JSON action objects (`{ type, ... }`); server→client: `{ type: "STATE", state }` (broadcast to all), `{ type: "JOINED", playerId, token }` (sent only to the requesting client after `JOIN_GAME`/`RECONNECT`), `{ type: "ERROR", message }` (sent only to the client whose action failed).

- [ ] **Step 1: Write the failing test**

```js
// server/src/wsServer.test.js
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWsServer } from "./wsServer.js";
import { createInitialState } from "./gameState.js";

const TEST_CARDS = new Map([
  ["gain-self", { id: "gain-self", name: "Gain Self", effects: [{ target: "self", amount: 2 }], endGameCrystals: null }],
]);

let httpServer;
let dir;
let baseUrl;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "wsserver-test-"));
  httpServer = createServer();
  createWsServer(httpServer, {
    cards: TEST_CARDS,
    statePath: join(dir, "game-state.json"),
    initialState: createInitialState(),
  });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `ws://localhost:${httpServer.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

function nextMessage(ws) {
  return new Promise((resolve) => ws.once("message", (raw) => resolve(JSON.parse(raw.toString()))));
}

describe("createWsServer", () => {
  it("responds to JOIN_GAME with JOINED then broadcasts STATE", async () => {
    const ws = new WebSocket(baseUrl);
    await new Promise((resolve) => ws.once("open", resolve));

    const joinedPromise = nextMessage(ws);
    ws.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    const joined = await joinedPromise;
    expect(joined.type).toBe("JOINED");
    expect(joined.token).toEqual(expect.any(String));

    const state = await nextMessage(ws);
    expect(state.type).toBe("STATE");
    expect(state.state.players).toHaveLength(1);

    ws.close();
  });

  it("sends an ERROR only to the client whose action was invalid", async () => {
    const ws = new WebSocket(baseUrl);
    await new Promise((resolve) => ws.once("open", resolve));

    // ADJUST_SCORE checks the game phase before it looks up the player, so
    // an unknown playerId only surfaces "Unknown player" once the game is
    // actually in the "playing" phase — get it there first.
    ws.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    await nextMessage(ws); // JOINED
    await nextMessage(ws); // STATE
    ws.send(JSON.stringify({ type: "JOIN_GAME", name: "Bob", color: "blue" }));
    await nextMessage(ws); // JOINED
    await nextMessage(ws); // STATE
    ws.send(JSON.stringify({ type: "START_GAME" }));
    await nextMessage(ws); // STATE (phase: playing)

    const errorPromise = nextMessage(ws);
    ws.send(JSON.stringify({ type: "ADJUST_SCORE", playerId: "unknown", delta: 1 }));
    const error = await errorPromise;
    expect(error.type).toBe("ERROR");
    expect(error.message).toContain("Unknown player");

    ws.close();
  });

  it("broadcasts state to a second client after a first client's action", async () => {
    const ws1 = new WebSocket(baseUrl);
    await new Promise((resolve) => ws1.once("open", resolve));
    ws1.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    await nextMessage(ws1); // JOINED
    await nextMessage(ws1); // STATE — ws1's own join messages are now fully drained

    const ws2 = new WebSocket(baseUrl);
    await new Promise((resolve) => ws2.once("open", resolve));

    // Register on ws1 before triggering ws2's join: ws1 has no pending
    // messages at this point, so this listener deterministically captures
    // the broadcast caused by ws2 joining (no race with ws1's own messages).
    const ws1BroadcastPromise = nextMessage(ws1);
    ws2.send(JSON.stringify({ type: "JOIN_GAME", name: "Bob", color: "blue" }));

    const ws1Broadcast = await ws1BroadcastPromise;
    expect(ws1Broadcast.type).toBe("STATE");
    expect(ws1Broadcast.state.players).toHaveLength(2);

    ws1.close();
    ws2.close();
  });

  it("does not crash when a client disconnects after NEW_GAME removed its player", async () => {
    const ws = new WebSocket(baseUrl);
    await new Promise((resolve) => ws.once("open", resolve));
    ws.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    await nextMessage(ws); // JOINED
    await nextMessage(ws); // STATE

    ws.send(JSON.stringify({ type: "NEW_GAME" }));
    await nextMessage(ws); // STATE reflecting the reset (fresh lobby, no players)

    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // No assertion beyond "the process is still alive" — this test fails
    // only if the close handler throws and crashes the test runner.
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- wsServer.test.js` (inside `server/`, add `"ws": "^8.18.0"` is already a dependency from Task 1)
Expected: FAIL with "Cannot find module './wsServer.js'"

- [ ] **Step 3: Implement**

```js
// server/src/wsServer.js
import { WebSocketServer } from "ws";
import { applyAction } from "./gameState.js";
import { saveState } from "./persistence.js";

export function createWsServer(httpServer, { cards, statePath, initialState }) {
  let state = initialState;
  const wss = new WebSocketServer({ server: httpServer });
  const clientPlayerIds = new Map();

  function broadcastState() {
    const payload = JSON.stringify({ type: "STATE", state });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  }

  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      let action;
      try {
        action = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "ERROR", message: "Invalid JSON" }));
        return;
      }

      let outcome;
      try {
        outcome = applyAction(state, action, { cards });
      } catch (err) {
        ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
        return;
      }

      state = outcome.state;
      if ((action.type === "JOIN_GAME" || action.type === "RECONNECT") && outcome.result) {
        clientPlayerIds.set(ws, outcome.result.playerId);
        ws.send(
          JSON.stringify({
            type: "JOINED",
            playerId: outcome.result.playerId,
            token: outcome.result.token ?? action.token,
          }),
        );
      }

      try {
        await saveState(statePath, state);
      } catch (err) {
        console.error("Failed to persist game state:", err);
      }
      broadcastState();
    });

    ws.on("close", async () => {
      const playerId = clientPlayerIds.get(ws);
      if (!playerId) return;
      clientPlayerIds.delete(ws);
      try {
        const outcome = applyAction(state, { type: "DISCONNECT", playerId });
        state = outcome.state;
      } catch (err) {
        // Player no longer exists (e.g. NEW_GAME reset the game while this
        // client was still connected) — nothing to mark disconnected.
        return;
      }
      try {
        await saveState(statePath, state);
      } catch (err) {
        console.error("Failed to persist game state:", err);
      }
      broadcastState();
    });
  });

  return { wss, getState: () => state };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- wsServer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/wsServer.js server/src/wsServer.test.js
git commit -m "feat(server): WebSocket glue with broadcast, join/reconnect, and error handling"
```

---

## Task 12: HTTP entry point

**Files:**
- Create: `server/src/index.js`

**Interfaces:**
- Consumes: `loadCardsFromFile` (cards.js), `loadState` (persistence.js), `createInitialState` (gameState.js), `createWsServer` (wsServer.js)
- Produces: a running process listening on `process.env.PORT || 3000`, serving `client/dist` and upgrading WebSocket connections

- [ ] **Step 1: Implement**

```js
// server/src/index.js
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { createInitialState } from "./gameState.js";
import { loadCardsFromFile } from "./cards.js";
import { loadState } from "./persistence.js";
import { createWsServer } from "./wsServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, "..", "data", "game-state.json");
const CARDS_PATH = path.join(__dirname, "cards.json");
const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");

async function main() {
  const cards = loadCardsFromFile(CARDS_PATH);
  const persisted = await loadState(STATE_PATH);
  const initialState = persisted ?? createInitialState();

  const app = express();
  app.use(express.static(CLIENT_DIST));
  app.get("*", (req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));

  const server = createServer(app);
  createWsServer(server, { cards, statePath: STATE_PATH, initialState });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Seasons Companion listening on port ${port}`);
    console.log(`Join code: ${initialState.joinCode}`);
  });
}

main().catch((err) => {
  console.error("Failed to start Seasons Companion server:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Manually verify it boots**

Run (inside `server/`, after `client/dist` exists — a placeholder `client/dist/index.html` with `<html></html>` is fine for this check; running `npm run build --workspace client` from the repo root, as documented in Task 22's README, produces the real one once the client exists):

```bash
mkdir -p ../client/dist && echo "<html></html>" > ../client/dist/index.html
node src/index.js
```

Expected: console prints `Seasons Companion listening on port 3000` and a 4-character join code; `curl http://localhost:3000/` returns the placeholder HTML. Stop the process with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.js
git commit -m "feat(server): HTTP entry point wiring cards, persistence, and WebSocket server"
```

---

## Task 13: Client scaffolding

**Files:**
- Create: `client/index.html`
- Create: `client/src/main.js`
- Create: `client/src/App.svelte`
- Modify: `client/src/smoke.test.js` (replace with a real render test)

**Interfaces:**
- Produces: a Vite dev server that renders `App.svelte` into `#app`

- [ ] **Step 1: Write the failing test**

Replace the contents of `client/src/smoke.test.js`:

```js
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import App from "./App.svelte";

describe("App", () => {
  it("renders the app title", () => {
    render(App);
    expect(screen.getByText("Seasons Companion")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- smoke.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module './App.svelte'"

- [ ] **Step 3: Implement**

```html
<!-- client/index.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Seasons Companion</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

```js
// client/src/main.js
import { mount } from "svelte";
import App from "./App.svelte";

const app = mount(App, { target: document.getElementById("app") });

export default app;
```

```svelte
<!-- client/src/App.svelte -->
<script>
  let title = "Seasons Companion";
</script>

<main>
  <h1>{title}</h1>
</main>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- smoke.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/index.html client/src/main.js client/src/App.svelte client/src/smoke.test.js
git commit -m "feat(client): scaffold Svelte app entry point"
```

---

## Task 14: WebSocket client wrapper

**Files:**
- Create: `client/src/lib/ws.js`
- Test: `client/src/lib/ws.test.js`

**Interfaces:**
- Produces: `createConnection({ url, onMessage }): { send(action: object): void }`. On `JOINED` messages it persists `token` to `localStorage` under the key `"seasons-companion-token"`; on `open` it sends `{ type: "RECONNECT", token }` if a token is already stored.

- [ ] **Step 1: Write the failing tests**

```js
// client/src/lib/ws.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConnection } from "./ws.js";

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = {};
    FakeWebSocket.instances.push(this);
  }
  addEventListener(event, handler) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(handler);
  }
  send(data) {
    this.lastSent = data;
  }
  emitOpen() {
    this.readyState = FakeWebSocket.OPEN;
    (this.listeners.open || []).forEach((h) => h());
  }
  emitMessage(data) {
    (this.listeners.message || []).forEach((h) => h({ data: JSON.stringify(data) }));
  }
  emitClose() {
    (this.listeners.close || []).forEach((h) => h());
  }
}
FakeWebSocket.CONNECTING = 0;
FakeWebSocket.OPEN = 1;

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  localStorage.clear();
});

describe("createConnection", () => {
  it("sends a RECONNECT with the stored token on open", () => {
    localStorage.setItem("seasons-companion-token", "abc123");
    createConnection({ url: "ws://x", onMessage: () => {} });
    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    expect(JSON.parse(socket.lastSent)).toEqual({ type: "RECONNECT", token: "abc123" });
  });

  it("stores the token from a JOINED message and forwards it to onMessage", () => {
    const messages = [];
    createConnection({ url: "ws://x", onMessage: (m) => messages.push(m) });
    const socket = FakeWebSocket.instances[0];
    socket.emitMessage({ type: "JOINED", playerId: "p1", token: "tok-1" });
    expect(localStorage.getItem("seasons-companion-token")).toBe("tok-1");
    expect(messages).toEqual([{ type: "JOINED", playerId: "p1", token: "tok-1" }]);
  });

  it("send() only writes to the socket once it is open", () => {
    const { send } = createConnection({ url: "ws://x", onMessage: () => {} });
    const socket = FakeWebSocket.instances[0];
    send({ type: "ADJUST_SCORE", playerId: "p1", delta: 1 });
    expect(socket.lastSent).toBeUndefined();
    socket.emitOpen();
    send({ type: "ADJUST_SCORE", playerId: "p1", delta: 1 });
    expect(JSON.parse(socket.lastSent)).toEqual({ type: "ADJUST_SCORE", playerId: "p1", delta: 1 });
  });

  it("reconnects after the socket closes", () => {
    createConnection({ url: "ws://x", onMessage: () => {} });
    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0].emitClose();
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ws.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module './ws.js'"

- [ ] **Step 3: Implement**

```js
// client/src/lib/ws.js
const TOKEN_KEY = "seasons-companion-token";

export function createConnection({ url, onMessage }) {
  let ws;

  function connect() {
    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) send({ type: "RECONNECT", token });
    });

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "JOINED") {
        localStorage.setItem(TOKEN_KEY, message.token);
      }
      onMessage(message);
    });

    ws.addEventListener("close", () => {
      connect();
    });
  }

  function send(action) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
    }
  }

  connect();
  return { send };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- ws.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/ws.js client/src/lib/ws.test.js
git commit -m "feat(client): WebSocket wrapper with token-based reconnect"
```

---

## Task 15: Game store

**Files:**
- Create: `client/src/lib/store.js`
- Test: `client/src/lib/store.test.js`

**Interfaces:**
- Consumes: `createConnection` (Task 14)
- Produces: `createGameStore(url): { state: Writable<GameState|null>, selfPlayerId: Writable<string|null>, error: Writable<string|null>, send(action): void }`

- [ ] **Step 1: Write the failing tests**

```js
// client/src/lib/store.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { get } from "svelte/store";

vi.mock("./ws.js", () => {
  return {
    createConnection: vi.fn(({ onMessage }) => {
      globalThis.__lastOnMessage = onMessage;
      return { send: vi.fn() };
    }),
  };
});

import { createGameStore } from "./store.js";

beforeEach(() => {
  globalThis.__lastOnMessage = null;
});

describe("createGameStore", () => {
  it("updates state on a STATE message", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "STATE", state: { phase: "lobby" } });
    expect(get(store.state)).toEqual({ phase: "lobby" });
  });

  it("sets selfPlayerId on a JOINED message", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "JOINED", playerId: "p1", token: "t1" });
    expect(get(store.selfPlayerId)).toBe("p1");
  });

  it("sets error on an ERROR message", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "ERROR", message: "boom" });
    expect(get(store.error)).toBe("boom");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- store.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module './store.js'"

- [ ] **Step 3: Implement**

```js
// client/src/lib/store.js
import { writable } from "svelte/store";
import { createConnection } from "./ws.js";

export function createGameStore(url) {
  const state = writable(null);
  const selfPlayerId = writable(null);
  const error = writable(null);

  const conn = createConnection({
    url,
    onMessage(message) {
      if (message.type === "STATE") {
        state.set(message.state);
      } else if (message.type === "JOINED") {
        selfPlayerId.set(message.playerId);
      } else if (message.type === "ERROR") {
        error.set(message.message);
      }
    },
  });

  return { state, selfPlayerId, error, send: conn.send };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/store.js client/src/lib/store.test.js
git commit -m "feat(client): game store bridging WebSocket messages to Svelte stores"
```

---

## Task 16: Join screen and color picker

**Files:**
- Create: `client/src/components/ColorPicker.svelte`
- Test: `client/src/components/ColorPicker.test.js`
- Create: `client/src/screens/JoinScreen.svelte`
- Test: `client/src/screens/JoinScreen.test.js`

**Interfaces:**
- Consumes: none beyond Svelte itself; `JoinScreen` takes props `takenColors: string[]`, `onJoin: (name: string, color: string) => void`
- Produces: `ColorPicker` takes props `takenColors: string[]`, `selected: string|null`, `onSelect: (color: string) => void`; a fixed palette exported as `COLOR_PALETTE` from `ColorPicker.svelte`'s module context is not needed elsewhere, so it stays local to the component

- [ ] **Step 1: Write the failing tests**

```js
// client/src/components/ColorPicker.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import ColorPicker from "./ColorPicker.svelte";

describe("ColorPicker", () => {
  it("disables colors already taken", () => {
    render(ColorPicker, { takenColors: ["red"], selected: null, onSelect: () => {} });
    expect(screen.getByRole("button", { name: "red" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "blue" })).toBeEnabled();
  });

  it("calls onSelect with the clicked color", async () => {
    const onSelect = vi.fn();
    render(ColorPicker, { takenColors: [], selected: null, onSelect });
    await fireEvent.click(screen.getByRole("button", { name: "blue" }));
    expect(onSelect).toHaveBeenCalledWith("blue");
  });
});
```

```js
// client/src/screens/JoinScreen.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import JoinScreen from "./JoinScreen.svelte";

describe("JoinScreen", () => {
  it("calls onJoin with the entered name and selected color", async () => {
    const onJoin = vi.fn();
    render(JoinScreen, { takenColors: [], onJoin });

    await fireEvent.input(screen.getByLabelText("Nom"), { target: { value: "Alice" } });
    await fireEvent.click(screen.getByRole("button", { name: "red" }));
    await fireEvent.click(screen.getByRole("button", { name: "Rejoindre" }));

    expect(onJoin).toHaveBeenCalledWith("Alice", "red");
  });

  it("disables the join button until a name and color are chosen", async () => {
    render(JoinScreen, { takenColors: [], onJoin: () => {} });
    expect(screen.getByRole("button", { name: "Rejoindre" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify both fail**

Run: `npm test -- ColorPicker.test.js JoinScreen.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

```svelte
<!-- client/src/components/ColorPicker.svelte -->
<script>
  const COLOR_PALETTE = ["red", "blue", "green", "yellow"];

  let { takenColors = [], selected = null, onSelect } = $props();
</script>

<div class="color-picker">
  {#each COLOR_PALETTE as color}
    <button
      type="button"
      aria-label={color}
      class:selected={selected === color}
      disabled={takenColors.includes(color)}
      onclick={() => onSelect(color)}
    >
      {color}
    </button>
  {/each}
</div>
```

```svelte
<!-- client/src/screens/JoinScreen.svelte -->
<script>
  import ColorPicker from "../components/ColorPicker.svelte";

  let { takenColors = [], onJoin } = $props();
  let name = $state("");
  let color = $state(null);

  function submit() {
    if (name.trim().length > 0 && color) {
      onJoin(name.trim(), color);
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); submit(); }}>
  <label for="player-name">Nom</label>
  <input id="player-name" bind:value={name} />

  <ColorPicker {takenColors} selected={color} onSelect={(c) => (color = c)} />

  <button type="submit" disabled={name.trim().length === 0 || !color}>Rejoindre</button>
</form>
```

- [ ] **Step 4: Run to verify both pass**

Run: `npm test -- ColorPicker.test.js JoinScreen.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ColorPicker.svelte client/src/components/ColorPicker.test.js client/src/screens/JoinScreen.svelte client/src/screens/JoinScreen.test.js
git commit -m "feat(client): join screen with color picker"
```

---

## Task 17: Dashboard screen

**Files:**
- Create: `client/src/screens/Dashboard.svelte`
- Test: `client/src/screens/Dashboard.test.js`

**Interfaces:**
- Consumes: a `GameState`-shaped `game` prop (from Task 3/5/7's state shape: `players[]` with `id,name,color,score`, `activePlayerId`, `turnOrder`), `selfPlayerId: string`, `onAdjustScore: (delta: number) => void`, `onNextTurn: () => void`

- [ ] **Step 1: Write the failing tests**

```js
// client/src/screens/Dashboard.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import Dashboard from "./Dashboard.svelte";

const game = {
  phase: "playing",
  activePlayerId: "p1",
  turnOrder: ["p1", "p2"],
  players: [
    { id: "p1", name: "Alice", color: "red", score: 4, hand: [] },
    { id: "p2", name: "Bob", color: "blue", score: 7, hand: [] },
  ],
};

describe("Dashboard", () => {
  it("shows every player's name, color, and score", () => {
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore: () => {}, onNextTurn: () => {} });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("marks the active player", () => {
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore: () => {}, onNextTurn: () => {} });
    expect(screen.getByTestId("player-p1")).toHaveClass("active");
    expect(screen.getByTestId("player-p2")).not.toHaveClass("active");
  });

  it("calls onAdjustScore with +1 and -1", async () => {
    const onAdjustScore = vi.fn();
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore, onNextTurn: () => {} });
    await fireEvent.click(screen.getByRole("button", { name: "+1" }));
    await fireEvent.click(screen.getByRole("button", { name: "-1" }));
    expect(onAdjustScore).toHaveBeenNthCalledWith(1, 1);
    expect(onAdjustScore).toHaveBeenNthCalledWith(2, -1);
  });

  it("calls onNextTurn when the next-turn button is clicked", async () => {
    const onNextTurn = vi.fn();
    render(Dashboard, { game, selfPlayerId: "p1", onAdjustScore: () => {}, onNextTurn });
    await fireEvent.click(screen.getByRole("button", { name: "Joueur suivant" }));
    expect(onNextTurn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Dashboard.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

```svelte
<!-- client/src/screens/Dashboard.svelte -->
<script>
  let { game, selfPlayerId, onAdjustScore, onNextTurn } = $props();
</script>

<section>
  <ul>
    {#each game.players as player (player.id)}
      <li data-testid={`player-${player.id}`} class:active={player.id === game.activePlayerId} style={`color: ${player.color}`}>
        <span>{player.name}</span>
        <span>{player.score}</span>
      </li>
    {/each}
  </ul>

  <div class="controls">
    <button type="button" onclick={() => onAdjustScore(1)}>+1</button>
    <button type="button" onclick={() => onAdjustScore(-1)}>-1</button>
  </div>

  <button type="button" onclick={onNextTurn}>Joueur suivant</button>
</section>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- Dashboard.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/Dashboard.svelte client/src/screens/Dashboard.test.js
git commit -m "feat(client): dashboard screen with score controls and turn tracking"
```

---

## Task 18: Card picker screen

**Files:**
- Create: `client/src/screens/CardPicker.svelte`
- Test: `client/src/screens/CardPicker.test.js`

**Interfaces:**
- Consumes: `allCards: Card[]` (the shape from Task 6/10: `{id,name,effects,endGameCrystals}`), `hand: Array<{cardId,instanceId}>`, `onAddCard: (cardId: string) => void`, `onActivateCard: (cardId: string) => void`, `onRemoveCard: (instanceId: string) => void`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- CardPicker.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

```svelte
<!-- client/src/screens/CardPicker.svelte -->
<script>
  let { allCards, hand, onAddCard, onActivateCard, onRemoveCard } = $props();

  function cardName(cardId) {
    return allCards.find((c) => c.id === cardId)?.name ?? cardId;
  }
</script>

<section>
  <h2>Ma main</h2>
  <ul>
    {#each hand as entry (entry.instanceId)}
      <li>
        <span>{cardName(entry.cardId)}</span>
        <button type="button" onclick={() => onActivateCard(entry.cardId)}>{`Activer ${cardName(entry.cardId)}`}</button>
        <button type="button" onclick={() => onRemoveCard(entry.instanceId)}>{`Retirer ${cardName(entry.cardId)}`}</button>
      </li>
    {/each}
  </ul>

  <h2>Toutes les cartes</h2>
  <ul>
    {#each allCards as card (card.id)}
      <li>
        <span>{card.name}</span>
        <button type="button" onclick={() => onAddCard(card.id)}>{`Ajouter ${card.name}`}</button>
      </li>
    {/each}
  </ul>
</section>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- CardPicker.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/CardPicker.svelte client/src/screens/CardPicker.test.js
git commit -m "feat(client): card picker screen for hand management and activation"
```

---

## Task 19: History screen

**Files:**
- Create: `client/src/screens/HistoryScreen.svelte`
- Test: `client/src/screens/HistoryScreen.test.js`

**Interfaces:**
- Consumes: `history: HistoryEntry[]` (shape from Task 5/7/8: `{timestamp,playerId,delta,resultingScore,source,actorPlayerId,cardId?,cardName?}`), `players: Player[]` (for name lookup)

- [ ] **Step 1: Write the failing test**

```js
// client/src/screens/HistoryScreen.test.js
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import HistoryScreen from "./HistoryScreen.svelte";

const players = [
  { id: "p1", name: "Alice", color: "red" },
  { id: "p2", name: "Bob", color: "blue" },
];

const history = [
  { timestamp: 1000, playerId: "p1", delta: 3, resultingScore: 3, source: "manual", actorPlayerId: "p1" },
  {
    timestamp: 2000,
    playerId: "p2",
    delta: -1,
    resultingScore: 0,
    source: "card_effect",
    actorPlayerId: "p1",
    cardId: "drain",
    cardName: "Drain",
  },
];

describe("HistoryScreen", () => {
  it("lists every entry with player names resolved and delta sign shown", () => {
    render(HistoryScreen, { history, players });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText(/Drain/)).toBeInTheDocument();
    expect(screen.getByText(/déclenché par Alice/)).toBeInTheDocument();
  });

  it("shows a placeholder when history is empty", () => {
    render(HistoryScreen, { history: [], players });
    expect(screen.getByText("Aucune modification pour le moment.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- HistoryScreen.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

```svelte
<!-- client/src/screens/HistoryScreen.svelte -->
<script>
  let { history, players } = $props();

  function playerName(id) {
    return players.find((p) => p.id === id)?.name ?? "?";
  }
</script>

<section>
  {#if history.length === 0}
    <p>Aucune modification pour le moment.</p>
  {:else}
    <ul>
      {#each [...history].reverse() as entry (entry.timestamp + entry.playerId + entry.delta)}
        <li>
          <span>{playerName(entry.playerId)}</span>
          <span>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
          <span>{`→ ${entry.resultingScore}`}</span>
          {#if entry.source === "card_effect"}
            <span>{`carte ${entry.cardName} déclenché par ${playerName(entry.actorPlayerId)}`}</span>
          {:else if entry.source === "final_count"}
            <span>{`décompte final — ${entry.cardName}`}</span>
          {:else}
            <span>ajustement manuel</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- HistoryScreen.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/HistoryScreen.svelte client/src/screens/HistoryScreen.test.js
git commit -m "feat(client): history screen visible to all players"
```

---

## Task 20: Final count screen

**Files:**
- Create: `client/src/screens/FinalCountScreen.svelte`
- Test: `client/src/screens/FinalCountScreen.test.js`

**Interfaces:**
- Consumes: `allCards: Card[]` (only those with `endGameCrystals !== null` are relevant), `players: Player[]`, `onAddFinalCrystals: (playerId: string, cardId: string) => void`, `onEndGame: () => void`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- FinalCountScreen.test.js` (inside `client/`)
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

```svelte
<!-- client/src/screens/FinalCountScreen.svelte -->
<script>
  let { allCards, players, onAddFinalCrystals, onEndGame } = $props();

  let crystalCards = $derived(allCards.filter((c) => c.endGameCrystals !== null));
</script>

<section>
  <h2>Cartes de fin de partie</h2>
  <ul>
    {#each crystalCards as card (card.id)}
      <li>{`${card.name} (+${card.endGameCrystals})`}</li>
    {/each}
  </ul>

  {#each players as player (player.id)}
    <div>
      <h3>{player.name} — {player.score}</h3>
      <ul>
        {#each crystalCards as card (card.id)}
          <li>
            <button type="button" onclick={() => onAddFinalCrystals(player.id, card.id)}>
              {`Ajouter ${card.name} (+${card.endGameCrystals}) à ${player.name}`}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/each}

  <button type="button" onclick={onEndGame}>Terminer la partie</button>
</section>
```

The standalone `<ul>` at the top (one `"{name} (+{value})"` entry per eligible card, outside the per-player loop) exists because `getByText("Relic (+5)")` in the test below requires an element whose exact text content is `"Relic (+5)"` — the per-player button's full label (`"Ajouter Relic (+5) à Alice"`) never matches that exactly, only as a substring, so a standalone element carrying just that text is required for the test to find it.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- FinalCountScreen.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/FinalCountScreen.svelte client/src/screens/FinalCountScreen.test.js
git commit -m "feat(client): final count screen for end-of-game crystal cards"
```

---

## Task 21: App shell wiring all screens together

**Files:**
- Modify: `client/src/App.svelte`
- Test: `client/src/App.test.js`

**Interfaces:**
- Consumes: `createGameStore` (Task 15), `JoinScreen` (Task 16), `Dashboard` (Task 17), `CardPicker` (Task 18), `HistoryScreen` (Task 19), `FinalCountScreen` (Task 20)
- Produces: the top-level routed app, switching view by `game.state.phase` (`lobby` → join list + `START_GAME`, `playing` → Dashboard/CardPicker/HistoryScreen nav, `final_count` → `FinalCountScreen`, `ended` → final ranking + `NEW_GAME` with a confirmation prompt); fetches the card database once from `GET /api/cards` on mount; once the local player has joined, sets `--player-color` (their chosen color) as a CSS custom property on the root element so buttons/accents reflect it

- [ ] **Step 1: Add a card list HTTP endpoint to the server**

Modify `server/src/index.js` — add before the `app.get("*", ...)` catch-all:

```js
app.get("/api/cards", (req, res) => {
  res.json([...cards.values()]);
});
```

- [ ] **Step 2: Write the failing test**

```js
// client/src/App.test.js
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
    expect(screen.getByText("Alice — 12")).toBeInTheDocument();
    expect(screen.getByText("Bob — 9")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Nouvelle partie" }));
    expect(confirm).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: "NEW_GAME" });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- App.test.js` (inside `client/`)
Expected: FAIL (`App.svelte` does not yet render `JoinScreen` / the "Nom" label, and has no `data-testid="app-root"` element)

- [ ] **Step 4: Implement**

```svelte
<!-- client/src/App.svelte -->
<script>
  import { onMount } from "svelte";
  import { createGameStore } from "./lib/store.js";
  import JoinScreen from "./screens/JoinScreen.svelte";
  import Dashboard from "./screens/Dashboard.svelte";
  import CardPicker from "./screens/CardPicker.svelte";
  import HistoryScreen from "./screens/HistoryScreen.svelte";
  import FinalCountScreen from "./screens/FinalCountScreen.svelte";

  const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  const game = createGameStore(wsUrl);

  let allCards = $state([]);
  let view = $state("dashboard"); // "dashboard" | "cards" | "history" | "final"

  onMount(async () => {
    const res = await fetch("/api/cards");
    allCards = await res.json();
  });

  let takenColors = $derived($game.state?.players.map((p) => p.color) ?? []);
  let selfPlayer = $derived($game.state?.players.find((p) => p.id === $game.selfPlayerId) ?? null);
  let rootStyle = $derived(selfPlayer ? `--player-color: ${selfPlayer.color};` : "");
</script>

<main data-testid="app-root" style={rootStyle}>
  <h1>Seasons Companion</h1>

  {#if $game.error}
    <p role="alert">{$game.error}</p>
  {/if}

  {#if !$game.state || !selfPlayer}
    <JoinScreen {takenColors} onJoin={(name, color) => game.send({ type: "JOIN_GAME", name, color })} />
  {:else if $game.state.phase === "lobby"}
    <section>
      <h2>Salle d'attente</h2>
      <ul>
        {#each $game.state.players as player (player.id)}
          <li style={`color: ${player.color}`}>{player.name}</li>
        {/each}
      </ul>
      <button
        type="button"
        disabled={$game.state.players.length < 2}
        onclick={() => game.send({ type: "START_GAME" })}
      >
        Démarrer la partie
      </button>
    </section>
  {:else if $game.state.phase === "final_count"}
    <FinalCountScreen
      {allCards}
      players={$game.state.players}
      onAddFinalCrystals={(playerId, cardId) => game.send({ type: "ADD_FINAL_CRYSTALS", playerId, cardId })}
      onEndGame={() => game.send({ type: "END_GAME" })}
    />
  {:else if $game.state.phase === "ended"}
    <section>
      <h2>Partie terminée</h2>
      <ul>
        {#each [...$game.state.players].sort((a, b) => b.score - a.score) as player (player.id)}
          <li style={`color: ${player.color}`}>{`${player.name} — ${player.score}`}</li>
        {/each}
      </ul>
      <button
        type="button"
        onclick={() => {
          if (confirm("Démarrer une nouvelle partie ? Cette action efface la partie actuelle.")) {
            game.send({ type: "NEW_GAME" });
          }
        }}
      >
        Nouvelle partie
      </button>
    </section>
  {:else}
    <nav>
      <button type="button" onclick={() => (view = "dashboard")}>Score</button>
      <button type="button" onclick={() => (view = "cards")}>Cartes</button>
      <button type="button" onclick={() => (view = "history")}>Historique</button>
    </nav>

    {#if view === "dashboard"}
      <Dashboard
        game={$game.state}
        selfPlayerId={$game.selfPlayerId}
        onAdjustScore={(delta) => game.send({ type: "ADJUST_SCORE", playerId: $game.selfPlayerId, delta })}
        onNextTurn={() => game.send({ type: "NEXT_TURN" })}
      />
    {:else if view === "cards"}
      <CardPicker
        {allCards}
        hand={selfPlayer.hand}
        onAddCard={(cardId) => game.send({ type: "ADD_CARD_TO_HAND", playerId: $game.selfPlayerId, cardId })}
        onActivateCard={(cardId) => game.send({ type: "ACTIVATE_CARD", actorPlayerId: $game.selfPlayerId, cardId })}
        onRemoveCard={(instanceId) => game.send({ type: "REMOVE_CARD_FROM_HAND", playerId: $game.selfPlayerId, instanceId })}
      />
    {:else if view === "history"}
      <HistoryScreen history={$game.state.history} players={$game.state.players} />
    {/if}
  {/if}
</main>

<style>
  :global(button) {
    border: 2px solid var(--player-color, #ccc);
  }
  h1 {
    color: var(--player-color, inherit);
  }
</style>
```

`--player-color` defaults to a neutral value everywhere via each rule's own fallback (`var(--player-color, ...)`) until the player has joined and `rootStyle` sets it on `main`; once set, buttons and the title pick up the player's chosen color as their accent.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- App.test.js`
Expected: PASS (join screen, CSS custom property, lobby start-button gating, START_GAME dispatch, and ended-phase ranking/NEW_GAME tests)

- [ ] **Step 6: Run the full client and server test suites**

Run: `npm test` (from repo root)
Expected: all suites PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/App.svelte client/src/App.test.js server/src/index.js
git commit -m "feat(client): wire lobby/playing/final_count/ended phases together, add start/new-game controls, theme UI by player color"
```

---

## Task 22: Termux setup README and manual test checklist

**Files:**
- Create: `README.md`

**Interfaces:**
- None (documentation only)

- [ ] **Step 1: Write `README.md`**

```markdown
# Seasons Companion

Compagnon de score en temps réel pour le jeu de société *Seasons* (2-4 joueurs).

## Installation (hôte, sous Termux)

1. Installer [Termux](https://f-droid.org/packages/com.termux/) depuis F-Droid (pas le Play Store, obsolète).
2. Dans Termux :
   ```bash
   pkg install nodejs git termux-api
   git clone <url-du-repo> seasons-companion
   cd seasons-companion
   npm install
   npm run build
   ```
3. Empêcher Android de tuer le serveur en arrière-plan :
   ```bash
   termux-wake-lock
   ```
4. Démarrer le serveur :
   ```bash
   npm start
   ```
   La console affiche le port (3000 par défaut) et le code de partie à 4 caractères.
5. Connecter tout le monde au même réseau local (WiFi partagé de préférence, sinon activer le partage de connexion du téléphone hôte), puis ouvrir `http://<ip-locale-de-l-hote>:3000` dans le navigateur de chaque téléphone.

## Développement

```bash
npm install                          # à la racine, installe les deux workspaces
npm test                             # lance les tests serveur puis client
npm run build --workspace client     # build de production du client
npm run dev --workspace client       # serveur de dev Vite avec hot-reload (pour itérer sur l'UI)
node server/src/index.js             # lance le serveur (nécessite un build client existant)
```

## Checklist de test manuel avant une soirée jeu

- [ ] Démarrer le serveur, noter le code de partie affiché.
- [ ] Ouvrir l'app dans 2 à 4 onglets de navigateur (ou téléphones), rejoindre avec des noms et couleurs différents.
- [ ] Vérifier qu'une couleur déjà prise est bien désactivée pour les joueurs suivants.
- [ ] Démarrer la partie, vérifier que le joueur actif est correctement mis en avant.
- [ ] Ajuster manuellement le score d'un joueur (+1/-1), vérifier que tous les onglets se mettent à jour.
- [ ] Ajouter une carte à effet "self" à la main d'un joueur, l'activer, vérifier que seul son score change.
- [ ] Ajouter une carte à effet "each_opponent", l'activer, vérifier que tous les autres joueurs perdent/gagnent les points, pas l'activateur.
- [ ] Vérifier que l'écran historique liste bien toutes ces actions, consultable depuis n'importe quel onglet joueur.
- [ ] Fermer un onglet, le rouvrir sur la même URL : vérifier que le joueur retrouve son score et sa main sans avoir à rejoindre.
- [ ] Lancer le décompte final, ajouter des cartes à cristaux à un joueur, terminer la partie, vérifier qu'aucune action de score n'est plus possible ensuite.
- [ ] Arrêter le serveur (Ctrl+C) et le relancer : vérifier que la partie reprend exactement où elle en était (scores, historique, phase).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Termux setup instructions and manual test checklist"
```
