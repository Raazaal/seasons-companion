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
