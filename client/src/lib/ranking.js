// Standard "competition ranking": tied scores share the same rank, and the
// next distinct score's rank skips ahead by the number of ties (1, 1, 3, 4)
// instead of compressing them (1, 1, 2, 3).
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  let rank = 0;
  let previousScore = null;
  return sorted.map((player, index) => {
    if (previousScore === null || player.score !== previousScore) {
      rank = index + 1;
      previousScore = player.score;
    }
    return { ...player, rank };
  });
}

export function ordinal(rank) {
  return rank === 1 ? "1er" : `${rank}ème`;
}
