<script>
  let { allCards, players, selfPlayerId, onAddFinalCrystals, onEndGame } = $props();

  let crystalCards = $derived(allCards.filter((c) => c.endGameCrystals !== null));

  function signed(amount) {
    return amount > 0 ? `+${amount}` : `${amount}`;
  }
</script>

<section>
  <h2 class="mb-3 text-lg font-semibold text-slate-800">Scores</h2>
  <ul class="mb-6 space-y-2">
    {#each players as player (player.id)}
      <li class="rounded-lg bg-slate-50 px-3 py-2 font-medium" style={`color: ${player.color}`}>
        {`${player.name} — ${player.score}`}
      </li>
    {/each}
  </ul>

  <h2 class="mb-3 text-lg font-semibold text-slate-800">Mes cartes de fin de partie</h2>
  <ul class="mb-6 flex flex-wrap gap-2">
    {#each crystalCards as card (card.id)}
      <li>
        <button
          type="button"
          onclick={() => onAddFinalCrystals(selfPlayerId, card.id)}
          class="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
        >
          {`Ajouter ${card.name} (${signed(card.endGameCrystals)})`}
        </button>
      </li>
    {/each}
  </ul>

  <button
    type="button"
    onclick={onEndGame}
    class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700"
  >
    Terminer la partie
  </button>
</section>
