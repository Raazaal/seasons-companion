<script>
  import ColorPicker from "../components/ColorPicker.svelte";

  let { takenColors = [], joinCode = null, onJoin } = $props();
  let name = $state("");
  let color = $state(null);

  function submit() {
    if (name.trim().length > 0 && color) {
      onJoin(name.trim(), color);
    }
  }
</script>

{#if joinCode}
  <p class="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-center font-medium tracking-wide text-slate-700">
    {`Code de partie : ${joinCode}`}
  </p>
{/if}

<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
  <div>
    <label for="player-name" class="mb-1 block text-sm font-medium text-slate-700">Nom</label>
    <input
      id="player-name"
      bind:value={name}
      class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </div>

  <ColorPicker {takenColors} selected={color} onSelect={(c) => (color = c)} />

  <button
    type="submit"
    disabled={name.trim().length === 0 || !color}
    class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
  >
    Rejoindre
  </button>
</form>
