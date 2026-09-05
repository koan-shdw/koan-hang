<script lang="ts">
  // INVENTORY: drop images, type h w d, click = hold (gate 1, unchanged)
  import Card from './Card.svelte'
  import { bus } from '../bus'
  import { ui } from './state.svelte'
  let { base }: { base: string } = $props()
  interface Pending { key: number; name: string; data: string; iw: number; ih: number; title: string; h: number; w: number; d: number; edge: string; kind: 'painting' | 'sculpture'; mw?: number; mh?: number; md?: number; probing?: boolean }
  let pending = $state<Pending[]>([])
  let over = $state(false)
  let pick: HTMLInputElement
  let seq = 0
  const readImage = (f: File): Promise<{ data: string; w: number; h: number }> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => { const img = new Image(); img.onload = () => res({ data: r.result as string, w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => rej(new Error('not an image')); img.src = r.result as string }
    r.onerror = () => rej(r.error); r.readAsDataURL(f)
  })
  const readData = (f: File): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(f) })
  bus.on('model_probed', ({ key, w, h, d, error }) => {
    const p = pending.find((x) => x.key === key); if (!p) return
    if (error || !h) { bus.toast(`${p.name}: not a model I can read`, 'warn'); pending = pending.filter((x) => x.key !== key); return }
    p.probing = false; p.mw = w; p.mh = h; p.md = d; p.h = h; p.w = w; p.d = d
  })
  const addModel = async (f: File) => {
    const data = await readData(f)
    const key = seq++
    pending.push({ key, name: f.name, data, iw: 1, ih: 1, title: f.name.replace(/\.[a-z0-9]+$/i, ''), h: 0, w: 0, d: 0, edge: 'wrap', kind: 'sculpture', probing: true })
    bus.emit('probe_model', { data, key })
  }
  const addForm = async (f: File) => {
    if (/\.glb$/i.test(f.name)) { void addModel(f); return }
    let img: { data: string; w: number; h: number }
    try { img = await readImage(f) } catch { bus.toast(`${f.name}: not an image`, 'warn'); return }
    pending.push({ key: seq++, name: f.name, data: img.data, iw: img.w, ih: img.h, title: f.name.replace(/\.[a-z0-9]+$/i, ''), h: 90, w: Math.round(90 * img.w / img.h), d: 4, edge: 'wrap', kind: 'painting' })
  }
  const takeFiles = (files: FileList | null) => { if (files) for (const f of Array.from(files)) void addForm(f) }
  const commit = (p: Pending) => {
    const h = Number(p.h), w = Number(p.w), d = Number(p.d)
    if (!(h > 0 && w > 0 && d >= 0)) { bus.toast('h w d in cm, please', 'warn'); return }
    bus.emit('add_local', { item: { title: p.title || p.name, data: p.data, h, w, d, edge: p.edge, kind: p.kind } })
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
    drop images or .glb here<small>or click · then type h w d in cm</small>
  </div>
  <input type="file" accept="image/*,.glb" multiple hidden bind:this={pick} onchange={() => { takeFiles(pick.files); pick.value = '' }} />
  <div class="pending">
    {#each pending as p (p.key)}
      <div class="addrow">
        {#if p.kind === 'sculpture'}<div class="thumb model">{p.probing ? '…' : `${p.mw} × ${p.mh} × ${p.md}`}</div>{:else}<img class="thumb" src={p.data} alt={p.name} />{/if}
        <div class="fields">
          <input type="text" placeholder="title" bind:value={p.title} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <input type="number" placeholder="h cm" bind:value={p.h} oninput={() => { if (p.kind === 'sculpture' && p.mh) { p.w = Math.round(Number(p.h) * p.mw! / p.mh); p.d = Math.round(Number(p.h) * p.md! / p.mh) } else p.w = Math.round(Number(p.h) * p.iw / p.ih) }} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <input type="number" placeholder="w cm" bind:value={p.w} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          <input type="number" placeholder="d cm" bind:value={p.d} onkeydown={(e) => { if (e.key === 'Enter') commit(p) }} />
          {#if p.kind === 'painting'}<select bind:value={p.edge}><option value="wrap">wrap</option><option value="white">white</option></select>{/if}
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
          {#if a.kind === 'sculpture'}{#if a.thumb}<img class="thumb" src={a.thumb} alt={a.title} />{:else}<div class="thumb model">…</div>{/if}{:else}<img class="thumb" src={a.data ?? `${base}data/art/${a.file}`} alt={a.title} />{/if}
          <div class="cap">{a.title}<small>{a.w} × {a.h} × {a.d}{#if ui.art.placed[a.id]} · <b>{a.kind === 'sculpture' ? 'on floor' : 'on wall'} ×{ui.art.placed[a.id]}</b>{/if}</small></div>
          {#if a.data || (a.kind === 'sculpture' && a.model?.startsWith('data:'))}<button class="x" title="remove from the library (and the walls)" onclick={(e) => { e.stopPropagation(); remove(a.id, a.title) }}>×</button>{/if}
        </div>
      {/each}
    {/if}
  </div>
</Card>
