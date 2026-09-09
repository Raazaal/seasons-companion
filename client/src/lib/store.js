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
        // A successful state update means whatever caused a prior error is
        // no longer blocking — otherwise the error banner is permanent
        // once the first error occurs, even for transient errors.
        error.set(null);
      } else if (message.type === "JOINED") {
        selfPlayerId.set(message.playerId);
      } else if (message.type === "ERROR") {
        error.set(message.message);
      }
    },
  });

  return { state, selfPlayerId, error, send: conn.send };
}
