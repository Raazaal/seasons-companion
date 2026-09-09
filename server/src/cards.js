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
