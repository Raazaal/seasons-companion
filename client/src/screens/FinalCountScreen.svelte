<script>
  let { allCards, players, selfPlayerId, onAddFinalCard, onRemoveFinalCard, onEndGame } = $props();

  let crystalCards = $derived(allCards.filter((c) => c.endGameCrystals !== null));
  let selfPlayer = $derived(players.find((p) => p.id === selfPlayerId));
  let invokedCards = $derived(selfPlayer?.finalCards ?? []);

  function cardName(cardId) {
    return allCards.find((c) => c.id === cardId)?.name ?? cardId;
  }

  function cardCrystals(cardId) {
    return allCards.find((c) => c.id === cardId)?.endGameCrystals ?? 0;
  }

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

  <h2 class="mb-3 text-lg font-semibold text-slate-800">Cartes invoquées</h2>
  {#if invokedCards.length === 0}
    <p class="mb-6 rounded-lg bg-slate-50 px-3 py-4 text-center text-slate-500">Aucune carte invoquée pour le moment.</p>
  {:else}
    <ul class="mb-6 space-y-2">
      {#each invokedCards as entry (entry.instanceId)}
        <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span class="font-medium">{`${cardName(entry.cardId)} (${signed(cardCrystals(entry.cardId))})`}</span>
          <button
            type="button"
            onclick={() => onRemoveFinalCard(entry.instanceId)}
            class="rounded-md bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800 transition hover:bg-rose-200"
          >
            {`Retirer ${cardName(entry.cardId)}`}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 class="mb-3 text-lg font-semibold text-slate-800">Cartes de fin de partie</h2>
  <ul class="mb-6 flex flex-wrap gap-2">
    {#each crystalCards as card (card.id)}
      <li>
        <button
          type="button"
          onclick={() => onAddFinalCard(card.id)}
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
