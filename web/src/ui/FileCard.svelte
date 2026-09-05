<script lang="ts">
  // FILE: layouts (gate 1, unchanged): name, save file, load file, clear
  import Card from './Card.svelte'
  import Row from './Row.svelte'
  import { bus } from '../bus'
  import { ui } from './state.svelte'
  let loadI: HTMLInputElement
  const count = $derived(ui.art?.layout.items.length ?? 0)
  bus.on('file_ready', (f) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([f.json], { type: 'application/json' })); a.download = f.name; a.click()
    bus.toast(f.skipped.length ? `saved · ${f.skipped.length} image(s) too big to travel: ${f.skipped.join(', ')}` : `saved ${f.name}`, f.skipped.length ? 'warn' : 'ok')
  })
  const load = async (f: File) => {
    const text = await f.text()
    if (count && !confirm(`replace the draft (${count} works) with ${f.name}? undoable`)) return
    bus.emit('import_file', { text, name: f.name })
  }
</script>

<Card id="file" title="file" x={12} y={300} anchor="right" status="draft">
  <Row label="name"><input type="text" placeholder="layout name" value={ui.art?.layout.name ?? 'draft'} onchange={(e) => bus.emit('set_name', { name: (e.currentTarget as HTMLInputElement).value })} /></Row>
  <div class="chips">
    <button class="chip" title="download this layout as a .json (send it, drop it back here)" onclick={() => bus.emit('export_file', {})}>save file</button>
    <button class="chip" onclick={() => loadI.click()}>load file</button>
    <button class="chip" onclick={() => { if (confirm('take every work off the walls? undoable')) bus.emit('clear_draft', {}) }}>clear</button>
  </div>
  <input type="file" accept=".json" hidden bind:this={loadI} onchange={() => { if (loadI.files?.[0]) void load(loadI.files[0]); loadI.value = '' }} />
  <div class="note">draft autosaved in this browser · {count} works · save file to send it</div>
</Card>
