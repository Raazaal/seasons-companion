<!-- client/src/screens/FinalCountScreen.svelte -->
<script>
  let { allCards, players, onAddFinalCrystals, onEndGame } = $props();

  let crystalCards = $derived(allCards.filter((c) => c.endGameCrystals !== null));
</script>

<section>
  <h2>Cartes de fin de partie</h2>
  <ul>
    {#each crystalCards as card (card.id)}
      <li>{`${card.name} (+${card.endGameCrystals})`}</li>
    {/each}
  </ul>

  {#each players as player (player.id)}
    <div>
      <h3>{player.name} — {player.score}</h3>
      <ul>
        {#each crystalCards as card (card.id)}
          <li>
            <button type="button" onclick={() => onAddFinalCrystals(player.id, card.id)}>
              {`Ajouter ${card.name} (+${card.endGameCrystals}) à ${player.name}`}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/each}

  <button type="button" onclick={onEndGame}>Terminer la partie</button>
</section>
