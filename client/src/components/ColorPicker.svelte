<script>
  // `value` is the CSS color stored on the player and used to render it
  // everywhere (score list, history, player highlight); `label` is the
  // French name shown to players and used as the button's accessible name.
  const COLOR_PALETTE = [
    { value: "purple", label: "Violet" },
    { value: "lightgreen", label: "Vert clair" },
    { value: "gray", label: "Gris" },
    { value: "orange", label: "Orange" },
  ];

  let { takenColors = [], selected = null, onSelect } = $props();
</script>

<div class="color-picker flex gap-2">
  {#each COLOR_PALETTE as { value, label }}
    <button
      type="button"
      aria-label={label}
      class:selected={selected === value}
      disabled={takenColors.includes(value)}
      onclick={() => onSelect(value)}
      style={`background-color: ${value};`}
      class="h-10 w-10 rounded-full ring-offset-2 transition disabled:cursor-not-allowed disabled:opacity-30"
    ></button>
  {/each}
</div>

<style>
  button.selected {
    box-shadow: 0 0 0 3px white, 0 0 0 5px var(--color-slate-900, #0f172a);
  }
</style>
