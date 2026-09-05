<script lang="ts">
  // The HTML layer (REMAKE.md §2): top strip, cards, HUD, maps, help, toasts, debug. Svelte 5. Talks to the world only through the bus.
  import { onMount } from 'svelte'
  import { bus, type Mode } from '../bus'
  import { ui } from './state.svelte'
  import { PRESET_THEMES, applyTheme, currentTheme, accentColor } from './themes'
  import Chips from './Chips.svelte'
  import LevelCard from './LevelCard.svelte'
  import InventoryCard from './InventoryCard.svelte'
  import HangCard from './HangCard.svelte'
  import FileCard from './FileCard.svelte'
  import Debug from './Debug.svelte'

  let { base, onviewport }: { base: string; onviewport: (el: HTMLElement) => void } = $props()
  let viewport: HTMLElement
  let small: HTMLCanvasElement, big: HTMLCanvasElement
  let inventory = $state<InventoryCard>()
  let theme = $state(currentTheme())
  const themes = Object.keys(PRESET_THEMES).map((n) => ({ id: n, label: n.toLowerCase(), tip: `theme ${n.toLowerCase()} · click = apply` }))
  const modes: { id: Mode; label: string; tip: string; disabled?: string }[] = [
    { id: 'walk', label: 'walk', tip: 'walk the room · click = take mouse, wasd = move' },
    { id: 'hang', label: 'hang', tip: 'hold a work, walk, look at a wall, click' },
    { id: 'level', label: 'level', tip: 'fix walls, doors, stairs', disabled: 'arrives in P5' },
  ]
  const readout = $derived(ui.walk ? `${ui.walk.levelName} · x ${ui.walk.x.toFixed(2)} z ${ui.walk.z.toFixed(2)}${ui.walk.onStair ? ' · stair' : ''}` : '')
  const pickTheme = (v: string) => { applyTheme(v); theme = v; bus.emit('accent', { css: accentColor() }) }
  onMount(() => {
    const off = bus.on('world_ready', () => bus.emit('mount_maps', { small, big }))   // the world listens once it exists
    onviewport(viewport)
    return off
  })
  const mapClick = (e: MouseEvent) => { const r = big.getBoundingClientRect(); bus.emit('map_click', { px: e.clientX - r.left, py: e.clientY - r.top }) }
</script>

<div class="viewport" bind:this={viewport} ondragover={(e) => e.preventDefault()} ondrop={(e) => inventory?.dropFiles(e)} role="presentation">
  {#if ui.failed}
    <div class="loading"><div>KOAN.hang</div><div class="txt">level.json failed: {ui.failed}</div></div>
  {:else if !ui.room}
    <div class="loading"><div>KOAN.hang</div><div class="txt">loading level…</div></div>
  {/if}
  {#if ui.loader.active}
    <div class="loadbar" title={ui.loader.text}><i style="width:{ui.loader.total ? Math.round(100 * ui.loader.done / ui.loader.total) : 0}%"></i><span>{ui.loader.text}</span></div>
  {/if}
  <div class="hint" hidden={ui.hud.hint !== 'walk'}>click to walk<small>w a s d · shift run · e door · m plan · esc lets go</small></div>
  <div class="hint" hidden={ui.hud.hint !== 'hang'}>click to hang<small>click a thumbnail, or 1-9 · then look at a wall, click<br>tab picks a hung work · delete takes it down · e takes it in hand<br>arrows nudge · , . swap · q puts it down · h hands · esc twice = walk</small></div>
  <div class="crosshair" hidden={!ui.hud.cross}></div>
  <div class="doortip" hidden={!ui.hud.doorTip}>{ui.hud.doorTip}</div>
  <div class="hangtip" hidden={!ui.hud.hangTip}>{ui.hud.hangTip}</div>
  {#if ui.anchors['work']?.visible}<div class="worklabel" style="left:{ui.anchors['work'].x}px; top:{ui.anchors['work'].y}px">{ui.anchors['work'].text}</div>{/if}
</div>

<div class="top">
  <div class="logo">KOAN<b>.hang</b></div>
  <span class="tag">hang real art in a real room</span>
  <Chips options={modes} value={ui.mode} onpick={(m) => bus.emit('set_mode', { mode: m })} />
  <span class="readout"><b>{readout}</b></span>
  <span class="spacer"></span>
  <Chips options={themes} value={theme} onpick={pickTheme} />
  <button class="chip" title="keys and gestures · click = show" onclick={() => (ui.helpShown = !ui.helpShown)}>?</button>
</div>

<div class="cards">
  {#if ui.room}
    <LevelCard />
    <InventoryCard {base} bind:this={inventory} />
    <HangCard />
    <FileCard />
  {/if}
</div>

<canvas class="minimap" bind:this={small}></canvas>
<canvas class="bigmap" bind:this={big} hidden={!ui.mapShown} onclick={mapClick}></canvas>

<div class="toasts">
  {#each ui.toasts as t (t.id)}<div class="toast {t.kind}">{t.msg}</div>{/each}
</div>

<div class="help" hidden={!ui.helpShown} onclick={() => (ui.helpShown = false)} role="presentation">
  <h3>KOAN.hang · keys</h3>
  <table>
    <tbody>
      <tr><td>click</td><td>take the mouse (walk)</td></tr>
      <tr><td>w a s d</td><td>walk · shift = run</td></tr>
      <tr><td>mouse</td><td>look</td></tr>
      <tr><td>e</td><td>open or close the door in front of you</td></tr>
      <tr><td>m</td><td>plan of this floor · click on it = go there</td></tr>
      <tr><td>esc</td><td>give the mouse back · close overlays</td></tr>
      <tr><td>?</td><td>this</td></tr>
      <tr><td>`</td><td>debug panel</td></tr>
    </tbody>
  </table>
  <h3>hang mode</h3>
  <table>
    <tbody>
      <tr><td>click a thumbnail</td><td>hold that work · it sits in your hands until a wall takes it</td></tr>
      <tr><td>scroll · , . · [ ]</td><td>swap what you hold · 1-9 and 0 pick by place</td></tr>
      <tr><td>click</td><td>hang it where you look · or take the work you look at (within 3 m)</td></tr>
      <tr><td>tab</td><td>select the next hung work (it glows) · delete, arrows, e act on it</td></tr>
      <tr><td>e</td><td>take the selected or looked-at work into your hands</td></tr>
      <tr><td>q</td><td>put the held work down (back to the library)</td></tr>
      <tr><td>h</td><td>hands view on / off</td></tr>
      <tr><td>arrows</td><td>nudge 1 cm · shift = 10 cm</td></tr>
      <tr><td>delete</td><td>take it off the wall</td></tr>
      <tr><td>ctrl z · ctrl shift z</td><td>undo · redo</td></tr>
      <tr><td>esc</td><td>mouse back · esc again = back to walk</td></tr>
    </tbody>
  </table>
  <div class="dim">level mode arrives later. click anywhere to close.</div>
</div>

{#if ui.debugShown}<Debug />{/if}
