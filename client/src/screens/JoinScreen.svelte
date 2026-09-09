<script>
  import ColorPicker from "../components/ColorPicker.svelte";

  let { takenColors = [], onJoin } = $props();
  let name = $state("");
  let color = $state(null);

  function submit() {
    if (name.trim().length > 0 && color) {
      onJoin(name.trim(), color);
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); submit(); }}>
  <label for="player-name">Nom</label>
  <input id="player-name" bind:value={name} />

  <ColorPicker {takenColors} selected={color} onSelect={(c) => (color = c)} />

  <button type="submit" disabled={name.trim().length === 0 || !color}>Rejoindre</button>
</form>
