<!-- client/src/screens/CardPicker.svelte -->
<script>
  let { allCards, hand, onAddCard, onActivateCard, onRemoveCard } = $props();

  function cardName(cardId) {
    return allCards.find((c) => c.id === cardId)?.name ?? cardId;
  }
</script>

<section>
  <h2>Ma main</h2>
  <ul>
    {#each hand as entry (entry.instanceId)}
      <li>
        <span>{cardName(entry.cardId)}</span>
        <button type="button" onclick={() => onActivateCard(entry.cardId)}>{`Activer ${cardName(entry.cardId)}`}</button>
        <button type="button" onclick={() => onRemoveCard(entry.instanceId)}>{`Retirer ${cardName(entry.cardId)}`}</button>
      </li>
    {/each}
  </ul>

  <h2>Toutes les cartes</h2>
  <ul>
    {#each allCards as card (card.id)}
      <li>
        <span>{card.name}</span>
        <button type="button" onclick={() => onAddCard(card.id)}>{`Ajouter ${card.name}`}</button>
      </li>
    {/each}
  </ul>
</section>
