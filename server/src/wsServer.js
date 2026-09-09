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
