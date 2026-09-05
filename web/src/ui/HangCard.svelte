<script lang="ts">
  // HANG: the widget (gate 1, unchanged): snap line, height, gap, guide, snap all
  import Card from './Card.svelte'
  import Chips from './Chips.svelte'
  import Row from './Row.svelte'
  import { bus } from '../bus'
  import { ui } from './state.svelte'
  import type { SnapLine, Guides, SculptLook } from '../world/art/art'
  const textures = ['none', 'concrete', 'plaster', 'plywood', 'steel', 'corten', 'slate', 'checker'].map((n) => ({ id: n, label: n, tip: n === 'none' ? 'the tint alone' : `the ${n} tile on the sculpture` }))
  const snaps: { id: SnapLine; label: string; tip: string }[] = [
    { id: 'top', label: 'top', tip: 'the top edge sits on the line' }, { id: 'centre', label: 'centre', tip: 'the centre sits on the line' },
    { id: 'bottom', label: 'bottom', tip: 'the bottom edge sits on the line' }, { id: 'free', label: 'free', tip: 'hang it where the crosshair is' },
  ]
  const g = $derived(ui.art?.layout.guides ?? null)
  const held = $derived(ui.art && ui.art.held ? ui.art.library.find((a) => a.id === ui.art?.held) ?? null : null)
  const height = $derived(g && g.snap !== 'free' ? g[g.snap] : 0)
  const setHeight = (v: number) => { if (!g || g.snap === 'free') return; const patch: Partial<Guides> = {}; patch[g.snap] = v; bus.emit('set_guides', { patch }) }
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)
  const focus = $derived(ui.art?.focus ?? null)
  const focusArt = $derived(focus ? ui.art?.library.find((a) => a.id === focus.art) ?? null : null)
  const look = $derived(focus?.look ?? null)
  const sculpt = (patch: Partial<SculptLook>) => bus.emit('set_sculpt', { patch })
  const plinthPatch = (k: 'w' | 'd' | 'h', v: number) => { if (!look?.plinth) return; sculpt({ plinth: { ...look.plinth, [k]: v } }) }
  const ride = $derived(ui.anchors['hang-widget']?.visible ? { x: ui.anchors['hang-widget'].x, y: ui.anchors['hang-widget'].y } : null)
</script>

<Card id="hang" title="hang" x={12} y={52} anchor="right" at={ride} status={ui.art ? `${ui.art.layout.items.length} on walls` : ''}>
  <div class="note">{held ? `holding ${held.title} · ${held.w} × ${held.h} cm` : 'holding nothing · click a thumbnail'}</div>
  {#if focus && look && focusArt}
    <div class="legend">sculpture · {focusArt.title}{focus.placed ? '' : ' · held'}</div>
    <Row label="colour" tip="tints the sculpture"><input type="color" value={look.colour} oninput={(e) => sculpt({ colour: (e.currentTarget as HTMLInputElement).value })} /></Row>
    <div class="legend">texture</div>
    <Chips options={textures} value={look.texture?.name ?? 'none'} onpick={(n) => sculpt({ texture: n === 'none' ? null : { name: n, cm: look.texture?.cm ?? 60 } })} />
    {#if look.texture}
      <Row label="tile cm" tip="how big one tile is on the sculpture"><input type="number" min="5" max="400" step="1" value={look.texture.cm} onchange={(e) => sculpt({ texture: { name: look.texture!.name, cm: num(e) } })} /></Row>
    {/if}
    <Row label="plinth" tip="a box under the sculpture · off = it stands on the floor"><input type="checkbox" checked={!!look.plinth} onchange={(e) => sculpt({ plinth: (e.currentTarget as HTMLInputElement).checked ? { w: 40, d: 40, h: 100, colour: '#f4f4f0' } : null })} /></Row>
    {#if look.plinth}
      <div class="row plinth">
        <label for="pw">w</label><input id="pw" type="number" min="5" max="400" value={look.plinth.w} onchange={(e) => plinthPatch('w', num(e))} />
        <label for="pd">d</label><input id="pd" type="number" min="5" max="400" value={look.plinth.d} onchange={(e) => plinthPatch('d', num(e))} />
        <label for="ph">h</label><input id="ph" type="number" min="1" max="300" value={look.plinth.h} onchange={(e) => plinthPatch('h', num(e))} />
      </div>
      <Row label="plinth colour"><input type="color" value={look.plinth.colour} oninput={(e) => sculpt({ plinth: { ...look.plinth!, colour: (e.currentTarget as HTMLInputElement).value } })} /></Row>
    {/if}
    <div class="chips"><button class="chip" title="turn it 15° · r" onclick={() => bus.emit('rotate', { deg: 15 })}>turn</button><button class="chip" title="turn it back 15° · shift r" onclick={() => bus.emit('rotate', { deg: -15 })}>turn back</button></div>
  {/if}
  <div class="legend">snap line</div>
  {#if g}
    <Chips options={snaps} value={g.snap} onpick={(v) => bus.emit('set_guides', { patch: { snap: v } })} />
    <Row label="height cm" tip="the line, in cm above this floor">
      <input type="number" min="0" max="400" step="1" value={height} disabled={g.snap === 'free'} onchange={(e) => setHeight(num(e))} />
    </Row>
    <input type="range" min="0" max="400" step="1" value={height} disabled={g.snap === 'free'} oninput={(e) => setHeight(num(e))} />
    <Row label="gap cm" tip="edge-to-edge snap distance between neighbours">
      <input type="number" min="0" max="200" step="1" value={g.gap} onchange={(e) => bus.emit('set_guides', { patch: { gap: num(e) } })} />
    </Row>
    <Row label="show guide"><input type="checkbox" checked={g.show} onchange={(e) => bus.emit('set_guides', { patch: { show: (e.currentTarget as HTMLInputElement).checked } })} /></Row>
    <div class="chips">
      <button class="chip" onclick={() => bus.emit('snap_all', { wall: 'looked' })}>snap all on this wall</button>
      <button class="chip" onclick={() => bus.emit('snap_all', { wall: 'all' })}>snap all</button>
    </div>
  {/if}
</Card>
