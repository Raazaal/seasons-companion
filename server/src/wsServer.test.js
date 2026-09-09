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

// Connects a client and registers both the "open" and first-"message"
// listeners synchronously, before either can possibly fire. The server now
// sends an initial STATE message as soon as the connection is accepted
// (see wsServer.js), and on a loopback connection that message can arrive
// in the very same synchronous flush as the "open" event itself — so
// waiting for "open" first and only *then* calling nextMessage() can lose
// that first message forever (no listener was attached yet when it fired).
// Registering both listeners up front, before any `await`, avoids the race.
function connectClient(url) {
  const ws = new WebSocket(url);
  const opened = new Promise((resolve) => ws.once("open", resolve));
  const initialState = nextMessage(ws);
  return { ws, opened, initialState };
}

// Closing a socket whose player is still valid in the current game state
// triggers the server's "close" handler, which asynchronously calls
// applyAction(DISCONNECT) and then saveState — writing into this test's temp
// dir. If the test function returns before that settles, afterEach's
// rmSync(dir) can race the in-flight saveState (mkdir/writeFile/rename),
// producing a spurious "ENOENT ... rename" logged from a later test's run.
// Waiting here lets the close handler's work finish before cleanup runs.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

describe("createWsServer", () => {
  it("sends the current STATE to a newly-connected client before it sends anything", async () => {
    const { ws, opened, initialState: initialStatePromise } = connectClient(baseUrl);
    await opened;

    const initialState = await initialStatePromise;
    expect(initialState.type).toBe("STATE");
    expect(initialState.state.phase).toBe("lobby");
    expect(initialState.state.players).toEqual([]);

    ws.close();
    await settle();
  });

  it("responds to JOIN_GAME with JOINED then broadcasts STATE", async () => {
    const { ws, opened, initialState: initialStatePromise } = connectClient(baseUrl);
    await opened;
    await initialStatePromise; // initial STATE sent immediately on connect

    const joinedPromise = nextMessage(ws);
    ws.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    const joined = await joinedPromise;
    expect(joined.type).toBe("JOINED");
    expect(joined.token).toEqual(expect.any(String));

    const state = await nextMessage(ws);
    expect(state.type).toBe("STATE");
    expect(state.state.players).toHaveLength(1);

    ws.close();
    await settle();
  });

  it("sends an ERROR only to the client whose action was invalid", async () => {
    const { ws, opened, initialState: initialStatePromise } = connectClient(baseUrl);
    await opened;
    await initialStatePromise; // initial STATE sent immediately on connect

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
    await settle();
  });

  it("broadcasts state to a second client after a first client's action", async () => {
    const client1 = connectClient(baseUrl);
    await client1.opened;
    await client1.initialState; // initial STATE sent immediately on connect
    const ws1 = client1.ws;
    ws1.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    await nextMessage(ws1); // JOINED
    await nextMessage(ws1); // STATE — ws1's own join messages are now fully drained

    const client2 = connectClient(baseUrl);
    await client2.opened;
    await client2.initialState; // initial STATE sent immediately on connect
    const ws2 = client2.ws;

    // Register on ws1 before triggering ws2's join: ws1 has no pending
    // messages at this point, so this listener deterministically captures
    // the broadcast caused by ws2 joining (no race with ws1's own messages).
    const ws1BroadcastPromise = nextMessage(ws1);
    ws2.send(JSON.stringify({ type: "JOIN_GAME", name: "Bob", color: "blue" }));

    const ws1Broadcast = await ws1BroadcastPromise;
    expect(ws1Broadcast.type).toBe("STATE");
    expect(ws1Broadcast.state.players).toHaveLength(2);

    // Close one socket at a time, each followed by settle(): both sockets
    // hold a still-valid player, so each close triggers an async
    // DISCONNECT + saveState against this test's file. persistence.js now
    // writes each save through a per-call unique "<path>.<uuid>.tmp" name
    // and serializes concurrent saves for the same path behind a per-path
    // write queue (see the 4459e2e concurrency hotfix), so overlapping
    // saves for the same statePath no longer race on rename. Closing
    // sequentially here is just to keep each close's broadcast easy to
    // reason about in the test, not to work around a real race.
    ws1.close();
    await settle();
    ws2.close();
    await settle();
  });

  it("strips player tokens from the broadcast STATE payload", async () => {
    const client1 = connectClient(baseUrl);
    await client1.opened;
    await client1.initialState; // initial STATE sent immediately on connect
    const ws1 = client1.ws;

    const joined1Promise = nextMessage(ws1);
    ws1.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    const joined1 = await joined1Promise;
    expect(joined1.type).toBe("JOINED");
    expect(joined1.token).toEqual(expect.any(String)); // delivered once, directly, to its owner
    await nextMessage(ws1); // STATE broadcast after Alice's own join

    const client2 = connectClient(baseUrl);
    await client2.opened;
    await client2.initialState; // initial STATE sent immediately on connect
    const ws2 = client2.ws;

    const broadcastPromise = nextMessage(ws1);
    ws2.send(JSON.stringify({ type: "JOIN_GAME", name: "Bob", color: "blue" }));
    const broadcast = await broadcastPromise;

    expect(broadcast.type).toBe("STATE");
    expect(broadcast.state.players).toHaveLength(2);
    for (const player of broadcast.state.players) {
      expect(player.token).toBeUndefined();
    }

    ws1.close();
    await settle();
    ws2.close();
    await settle();
  });

  it("does not crash when a client disconnects after NEW_GAME removed its player", async () => {
    const { ws, opened, initialState: initialStatePromise } = connectClient(baseUrl);
    await opened;
    await initialStatePromise; // initial STATE sent immediately on connect
    ws.send(JSON.stringify({ type: "JOIN_GAME", name: "Alice", color: "red" }));
    await nextMessage(ws); // JOINED
    await nextMessage(ws); // STATE

    ws.send(JSON.stringify({ type: "NEW_GAME" }));
    await nextMessage(ws); // STATE reflecting the reset (fresh lobby, no players)

    ws.close();
    await settle();
    // No assertion beyond "the process is still alive" — this test fails
    // only if the close handler throws and crashes the test runner.
  });
});
