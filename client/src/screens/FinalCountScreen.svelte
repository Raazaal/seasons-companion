<script>
  let { allCards, players, onAddFinalCrystals, onEndGame } = $props();

  let crystalCards = $derived(allCards.filter((c) => c.endGameCrystals !== null));

  function signed(amount) {
    return amount > 0 ? `+${amount}` : `${amount}`;
  }
</script>

<section>
  <h2 class="mb-3 text-lg font-semibold text-slate-800">Cartes de fin de partie</h2>
  <ul class="mb-6 space-y-1">
    {#each crystalCards as card (card.id)}
      <li class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {`${card.name} (${signed(card.endGameCrystals)})`}
      </li>
    {/each}
  </ul>

  <div class="mb-6 space-y-5">
    {#each players as player (player.id)}
      <div class="rounded-xl border border-slate-200 p-4">
        <h3 class="mb-3 font-semibold" style={`color: ${player.color}`}>{player.name} — {player.score}</h3>
        <ul class="flex flex-wrap gap-2">
          {#each crystalCards as card (card.id)}
            <li>
              <button
                type="button"
                onclick={() => onAddFinalCrystals(player.id, card.id)}
                class="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                {`Ajouter ${card.name} (${signed(card.endGameCrystals)}) à ${player.name}`}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>

  <button
    type="button"
    onclick={onEndGame}
    class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700"
  >
    Terminer la partie
  </button>
</section>
