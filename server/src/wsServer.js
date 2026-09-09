import { WebSocketServer } from "ws";
import { applyAction } from "./gameState.js";
import { saveState } from "./persistence.js";

// The broadcast STATE payload must never leak a player's private
// reconnection token to other clients — only the JOINED/reconnect-ack
// message sent directly to that player's own socket may carry it.
function toBroadcastState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, token: undefined })),
  };
}

export function createWsServer(httpServer, { cards, statePath, initialState }) {
  let state = initialState;
  const wss = new WebSocketServer({ server: httpServer });
  const clientPlayerIds = new Map();

  function broadcastState() {
    const payload = JSON.stringify({ type: "STATE", state: toBroadcastState(state) });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  }

  wss.on("connection", (ws) => {
    // Send the current state to the newly-connected socket right away, so a
    // client that hasn't sent any message yet (e.g. still on the join
    // screen) already sees an accurate view of the game (taken colors,
    // current phase, join code) instead of staying stuck on `null` state
    // until someone else's action triggers a broadcast.
    ws.send(JSON.stringify({ type: "STATE", state: toBroadcastState(state) }));

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
