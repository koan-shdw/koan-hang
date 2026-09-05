<script lang="ts">
  // INVENTORY: drop images, type h w d, click = hold (gate 1, unchanged)
  import Card from './Card.svelte'
  import { bus } from '../bus'
  import { ui } from './state.svelte'
  let { base }: { base: string } = $props()
  interface Pending { key: number; name: string; data: string; iw: number; ih: number; title: string; h: number; w: number; d: number; edge: string }
  let pending = $state<Pending[]>([])
  let over = $state(false)
  let pick: HTMLInputElement
  let seq = 0
  const readImage = (f: File): Promise<{ data: string; w: number; h: number }> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => { const img = new Image(); img.onload = () => res({ data: r.result as string, w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => rej(new Error('not an image')); img.src = r.result as string }
    r.onerror = () => rej(r.error); r.readAsDataURL(f)
  })
  const addForm = async (f: File) => {
    let img: { data: string; w: number; h: number }
    try { img = await readImage(f) } catch { bus.toast(`${f.name}: not an image`, 'warn'); return }
    pending.push({ key: seq++, name: f.name, data: img.data, iw: img.w, ih: img.h, title: f.name.replace(/\.[a-z0-9]+$/i, ''), h: 90, w: Math.round(90 * img.w / img.h), d: 4, edge: 'wrap' })
  }
  const takeFiles = (files: FileList | null) => { if (files) for (const f of Array.from(files)) void addForm(f) }
  const commit = (p: Pending) => {
    const h = Number(p.h), w = Number(p.w), d = Number(p.d)
    if (!(h > 0 && w > 0 && d >= 0)) { bus.toast('h w d in cm, please', 'warn'); return }
    bus.emit('add_local', { item: { title: p.title || p.name, data: p.data, h, w, d, edge: p.edge } })
    pending = pending.filter((x) => x.key !== p.key)
  }
  const drop = (e: DragEvent) => {
    e.preventDefault(); over = false
    const fs = e.dataTransfer?.files ?? null
    const jsons = fs ? Array.from(fs).filter((f) => f.name.endsWith('.json')) : []
    if (jsons.length) { void jsons[0].text().then((text) => bus.emit('import_file', { text, name: jsons[0].name })); return }
    takeFiles(fs)
  }
  export function dropFiles(e: DragEvent): void { drop(e) }
  const hold = (id: string) => bus.emit('hold', { id })
  const remove = (id: string, title: string) => { if (confirm(`remove ${title} from the library?`)) bus.emit('remove_local', { id }) }
</script>

<Card id="inventory" title="inventory" x={12} y={392}>
  <div class="drop" class:over role="button" tabindex="0" onclick={() => pick.click()} onkeydown={(e) => { if (e.key === 'Enter') pick.click() }}
    ondragover={(e) => { e.preventDefault(); over = true }} ondragleave={() => (over = false)} ondrop={drop}>
    drop images here<small>or click · then type h w d in cm</small>
  </div>
  <input type="file" accept="image/*" multiple hidden bind:this={pick} onchange={() => { takeFiles(pick.files); pick.value = '' }} />
  <div class="pending">
    {#each pending as p (p.key)}
      <div class="addrow">
        <img class="thumb" src={p.data} alt={p.name} />
        <div class="fields">
          <input type="text" placeholder="title" bind:value={p.title} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <input type="number" placeholder="h cm" bind:value={p.h} oninput={() => { p.w = Math.round(Number(p.h) * p.iw / p.ih) }} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <input type="number" placeholder="w cm" bind:value={p.w} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <input type="number" placeholder="d cm" bind:value={p.d} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <select bind:value={p.edge}><option value="wrap">wrap</option><option value="white">white</option></select>
          <button class="chip" onclick={() => commit(p)}>add</button>
          <button class="chip" onclick={() => (pending = pending.filter((x) => x.key !== p.key))}>×</button>
        </div>
      </div>
    {/each}
  </div>
  <div class="thumbs">
    {#if !ui.art || !ui.art.library.length}
      <div class="empty" style="grid-column: 1 / -1"><div class="empty-title">no art yet</div><div class="empty-text">drop images above, type h w d in cm, click one to hold it</div></div>
    {:else}
      {#each ui.art.library as a, i (a.id)}
        <div class="thumbwrap" class:held={ui.art.held === a.id} title="{a.title} · click = hold · {i + 1}" role="button" tabindex="0" onclick={() => hold(a.id)} onkeydown={(e) => { if (e.key === 'Enter') hold(a.id) }}>
          <img class="thumb" src={a.data ?? `${base}data/art/${a.file}`} alt={a.title} />
          <div class="cap">{a.title}<small>{a.w} × {a.h} × {a.d}{#if ui.art.placed[a.id]} · <b>on wall ×{ui.art.placed[a.id]}</b>{/if}</small></div>
          {#if a.data}<button class="x" title="remove from the library (and the walls)" onclick={(e) => { e.stopPropagation(); remove(a.id, a.title) }}>×</button>{/if}
        </div>
      {/each}
    {/if}
  </div>
</Card>
