<script>
  let { allCards, hand, onAddCard, onActivateCard, onRemoveCard } = $props();

  function cardName(cardId) {
    return allCards.find((c) => c.id === cardId)?.name ?? cardId;
  }
</script>

<section>
  <h2 class="mb-3 text-lg font-semibold text-slate-800">Ma main</h2>
  <ul class="mb-6 space-y-2">
    {#each hand as entry (entry.instanceId)}
      <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <span class="font-medium">{cardName(entry.cardId)}</span>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={() => onActivateCard(entry.cardId)}
            class="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {`Activer ${cardName(entry.cardId)}`}
          </button>
          <button
            type="button"
            onclick={() => onRemoveCard(entry.instanceId)}
            class="rounded-md bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800 transition hover:bg-rose-200"
          >
            {`Retirer ${cardName(entry.cardId)}`}
          </button>
        </div>
      </li>
    {/each}
  </ul>

  <h2 class="mb-3 text-lg font-semibold text-slate-800">Toutes les cartes</h2>
  <ul class="space-y-2">
    {#each allCards as card (card.id)}
      <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <span class="font-medium">{card.name}</span>
        <button
          type="button"
          onclick={() => onAddCard(card.id)}
          class="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
        >
          {`Ajouter ${card.name}`}
        </button>
      </li>
    {/each}
  </ul>
</section>
