import { generateId, generateToken, generateJoinCode } from "./ids.js";

export class GameActionError extends Error {}

function requireCard(context, cardId) {
  const card = context.cards?.get(cardId);
  if (!card) throw new GameActionError(`Unknown card: ${cardId}`);
  return card;
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
  if (state.players.length >= 4) {
    throw new GameActionError("La partie est complète (4 joueurs maximum)");
  }
  const player = {
    id: generateId(),
    token: generateToken(),
    name,
    color,
    score: 0,
    hand: [],
    finalCards: [],
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

function addHistoryEntry(state, entry) {
  return {
    ...state,
    history: [...state.history, { timestamp: Date.now(), seq: state.history.length, ...entry }],
  };
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

function startFinalCount(state) {
  assertPhase(state, ["playing"]);
  return {
    state: {
      ...state,
      phase: "final_count",
      players: state.players.map((p) => ({
        ...p,
        finalCards: p.finalCards ?? [],
        finalCountBaseScore: p.score,
        finalCountReady: false,
      })),
    },
  };
}

function setFinalCountReady(state, action) {
  assertPhase(state, ["final_count"]);
  const player = findPlayer(state, action.playerId);
  return {
    state: {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, finalCountReady: !!action.ready } : p)),
    },
  };
}

// The final-count score is always recomputed from scratch (base score at the
// start of final count + the crystal values of every currently-invoked card)
// rather than accumulated via one-off deltas. That's what makes removing a
// wrongly-added card exact instead of drifting: there's no separate "undo"
// delta to get subtly wrong, just a fresh sum over whatever cards remain.
function recomputeFinalScore(player, cards) {
  const base = player.finalCountBaseScore ?? player.score;
  const sum = (player.finalCards ?? []).reduce((total, entry) => {
    const card = cards?.get(entry.cardId);
    return total + (card?.endGameCrystals ?? 0);
  }, 0);
  return Math.max(0, base + sum);
}

function addFinalCard(state, action, context) {
  assertPhase(state, ["final_count"]);
  const card = requireCard(context, action.cardId);
  if (card.endGameCrystals === null || card.endGameCrystals === undefined) {
    throw new GameActionError(`Card ${card.id} has no end-game crystal value`);
  }
  const player = findPlayer(state, action.playerId);
  const finalCards = [...(player.finalCards ?? []), { cardId: card.id, instanceId: generateId() }];
  const resultingScore = recomputeFinalScore({ ...player, finalCards }, context.cards);
  const nextState = {
    ...state,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, finalCards, score: resultingScore, finalCountReady: false } : p,
    ),
  };
  return {
    state: addHistoryEntry(nextState, {
      playerId: player.id,
      delta: card.endGameCrystals,
      resultingScore,
      source: "final_count",
      actorPlayerId: player.id,
      cardId: card.id,
      cardName: card.name,
    }),
  };
}

function removeFinalCard(state, action, context) {
  assertPhase(state, ["final_count"]);
  const player = findPlayer(state, action.playerId);
  const finalCards = player.finalCards ?? [];
  const instance = finalCards.find((c) => c.instanceId === action.instanceId);
  if (!instance) throw new GameActionError(`Unknown final card instance: ${action.instanceId}`);
  const card = requireCard(context, instance.cardId);
  const nextFinalCards = finalCards.filter((c) => c.instanceId !== action.instanceId);
  const resultingScore = recomputeFinalScore({ ...player, finalCards: nextFinalCards }, context.cards);
  const nextState = {
    ...state,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, finalCards: nextFinalCards, score: resultingScore, finalCountReady: false } : p,
    ),
  };
  return {
    state: addHistoryEntry(nextState, {
      playerId: player.id,
      delta: -card.endGameCrystals,
      resultingScore,
      source: "final_count_removal",
      actorPlayerId: player.id,
      cardId: card.id,
      cardName: card.name,
    }),
  };
}

function endGame(state) {
  assertPhase(state, ["final_count"]);
  if (state.players.some((p) => !p.finalCountReady)) {
    throw new GameActionError("Tous les joueurs doivent confirmer avoir terminé leur décompte");
  }
  return { state: { ...state, phase: "ended" } };
}

function newGame() {
  return { state: createInitialState() };
}

export function applyAction(state, action, context = {}) {
  switch (action.type) {
    case "JOIN_GAME":
      return joinGame(state, action);
    case "START_GAME":
      return startGame(state, action);
    case "RECONNECT":
      return reconnect(state, action);
    case "DISCONNECT":
      return disconnect(state, action);
    case "ADJUST_SCORE":
      return adjustScore(state, action);
    case "NEXT_TURN":
      return nextTurn(state, action);
    case "ADD_CARD_TO_HAND":
      return addCardToHand(state, action, context);
    case "REMOVE_CARD_FROM_HAND":
      return removeCardFromHand(state, action);
    case "ACTIVATE_CARD":
      return activateCard(state, action, context);
    case "START_FINAL_COUNT":
      return startFinalCount(state, action);
    case "SET_FINAL_COUNT_READY":
      return setFinalCountReady(state, action);
    case "ADD_FINAL_CARD":
      return addFinalCard(state, action, context);
    case "REMOVE_FINAL_CARD":
      return removeFinalCard(state, action, context);
    case "END_GAME":
      return endGame(state, action);
    case "NEW_GAME":
      return newGame(state, action);
    default:
      throw new GameActionError(`Unknown action type: ${action.type}`);
  }
}

export { findPlayer, assertPhase, applyScoreDelta, addHistoryEntry };
