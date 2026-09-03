// KOAN.hang — P2: the clean level built from level.json, walked first person. No scan in the app.
import './styles.css'
import * as THREE from 'three'
import { applyTheme, currentTheme, accentColor } from './themes'
import { loadLevel, buildLevel, updateDoors, floorOf, setWireColor, meshAudit, skyLeakAudit, type Level, applyTextures, worldUVs } from './level'
import { Walker, isTyping } from './walk'
import { Minimap } from './minimap'
import { Shell, chips, el, emptyState, row, type Mode } from './ui'
import { ArtSystem, readImage, type SnapLine } from './art'

const BASE = import.meta.env.BASE_URL
const DATA = `${BASE}data/`
const LOOK_KEY = 'koan-hang-look'
type Look = 'clean' | 'wire' | 'textured'

const HELP = `<h3>KOAN.hang · keys</h3>
<table>
<tr><td>click</td><td>take the mouse (walk)</td></tr>
<tr><td>w a s d</td><td>walk · shift = run</td></tr>
<tr><td>mouse</td><td>look</td></tr>
<tr><td>e</td><td>open or close the door in front of you</td></tr>
<tr><td>m</td><td>plan of this floor · click on it = go there</td></tr>
<tr><td>esc</td><td>give the mouse back · close overlays</td></tr>
<tr><td>?</td><td>this</td></tr>
</table>
<h3>hang mode</h3>
<table>
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
</table>
<div class="dim">level mode arrives later. click anywhere to close.</div>`

applyTheme(currentTheme())

async function main(): Promise<void> {
  const shell = new Shell(document.getElementById('app')!)
  shell.logo()

  // ---- renderer -------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  shell.viewport.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfd9f2) // plain sky until the street backdrop lands (P3)
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200)
  scene.add(camera)   // the held work rides on the camera
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8078, 0.55))
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.2); sun.position.set(6, 10, -4); scene.add(sun)
  const resize = () => {
    const w = shell.viewport.clientWidth, h = shell.viewport.clientHeight
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize); resize()

  // ---- level ------------------------------------------------------------------
  const loading = el('div', 'loading')
  const ltxt = el('div', 'txt', 'loading level…')
  loading.append(el('div', undefined, 'KOAN.hang'), ltxt); shell.viewport.appendChild(loading)
  let level: Level
  try {
    level = await loadLevel(`${DATA}level/level.json`)
  } catch (e) {
    ltxt.textContent = `level.json failed: ${(e as Error).message}`; shell.toast('level.json failed to load', 'bad', 8000); return
  }
  const built = buildLevel(level)
  worldUVs(built.group)
  scene.add(built.group, built.wire)
  setWireColor(built.wire, accentColor())
  loading.remove()
  // sky: an equirectangular panorama from the repo (textures/sky-tokyo.jpg) when present, else the flat fallback colour
  if (level.sky?.fallback) scene.background = new THREE.Color(level.sky.fallback)
  if (level.fog) scene.fog = new THREE.Fog(new THREE.Color(level.fog.color), level.fog.near, level.fog.far)   // the smokey void
  if (level.sky?.file) {
    new THREE.TextureLoader().load(`${DATA}textures/${level.sky.file}`, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace
      scene.background = tex
    }, undefined, () => { /* no panorama yet: keep the flat sky */ })
  }

  let look: Look = 'textured'   // highest quality is the default; clean and wire are the dials
  try { const saved = localStorage.getItem(LOOK_KEY); if (saved === 'clean' || saved === 'wire' || saved === 'textured') look = saved } catch { /* private */ }   // an old saved value ('both') fell through and showed flat: only the three known looks count
  const applyLook = () => {
    built.wire.visible = look === 'wire'
    applyTextures(look === 'textured', DATA, renderer.capabilities.getMaxAnisotropy())
    try { localStorage.setItem(LOOK_KEY, look) } catch { /* private */ }
  }
  applyLook()

  // ---- walk ---------------------------------------------------------------------
  const walker = new Walker(level, camera, renderer.domElement)
  walker.doors = built.doors
  const art = new ArtSystem(level, scene, walker, camera, DATA)
  const hint = el('div', 'hint'); hint.innerHTML = 'click to walk<small>w a s d · shift run · e door · m plan · esc lets go</small>'
  const cross = el('div', 'crosshair'); cross.hidden = true
  const doorTip = el('div', 'doortip'); doorTip.hidden = true
  const hangTip = el('div', 'hangtip'); hangTip.hidden = true
  shell.viewport.append(hint, cross, doorTip, hangTip)

  // ---- minimap ------------------------------------------------------------------
  const small = el('canvas', 'minimap'); const big = el('canvas', 'bigmap'); big.hidden = true
  shell.root.append(small, big)
  const minimap = new Minimap(level, small, big)
  big.addEventListener('click', (e) => {
    const r = big.getBoundingClientRect()
    const hit = minimap.hit(e.clientX - r.left, e.clientY - r.top, walker.state)
    if (hit) { walker.teleport(walker.state.level, hit[0], hit[1]); big.hidden = true; shell.toast(`moved to ${floorOf(level, walker.state.level).name} floor`) }
    else shell.toast('not a floor there', 'warn')
  })

  // ---- top strip -----------------------------------------------------------------
  const modes = chips<Mode>([
    { id: 'walk', label: 'walk', tip: 'walk the room · click = take mouse, wasd = move' },
    { id: 'hang', label: 'hang', tip: 'hold a work, walk, look at a wall, click' },
    { id: 'level', label: 'level', tip: 'fix walls, doors, stairs', disabled: 'arrives in P5' },
  ], 'walk', (m) => { mode = m; modes.set(m); art.mode = m; if (m !== 'hang') art.hold(null); shell.toast(m === 'hang' ? 'hang: click a thumbnail, look at a wall, click' : 'walk') })
  let mode: Mode = 'walk'
  shell.top.appendChild(modes.root)
  const readout = el('span', 'readout'); shell.top.appendChild(readout)
  shell.spacer()
  shell.themePicker(() => setWireColor(built.wire, accentColor()))
  shell.helpButton(HELP)

  // ---- cards ---------------------------------------------------------------------
  const levelCard = shell.card('level', 'level', { x: 12, y: 52 })
  const lookChips = chips<Look>([
    { id: 'clean', label: 'clean', tip: 'the rebuilt level, plain materials' },
    { id: 'wire', label: 'wire', tip: 'clean level with its edges drawn' },
    { id: 'textured', label: 'textured', tip: 'the scan\'s own surfaces, baked and tiled' },
  ], look, (v) => { look = v; lookChips.set(v); applyLook() })
  levelCard.body.append(el('div', 'legend', 'look'), lookChips.root)
  const eye = el('input'); eye.type = 'number'; eye.min = '100'; eye.max = '220'; eye.step = '1'; eye.value = String(Math.round(level.eyeHeight * 100))
  eye.addEventListener('change', () => { const v = Number(eye.value); if (v >= 100 && v <= 220) { level.eyeHeight = v / 100; shell.toast(`eye height ${v} cm`) } })
  levelCard.body.append(row('eye height cm', eye, 'camera height above the floor · 160 = average eye'))
  const where = el('div', 'note', ''); levelCard.body.append(where)
  levelCard.body.append(el('div', 'note', `${level.walls.filter((w) => w.hang !== false).length} hang walls · ${level.stairs.length} stairs · ${built.doors.length} doors · ${level.levels.length} floors`))

  // ---- INVENTORY: drop images, type h w d, click = hold ---------------------------------------
  const inv = shell.card('inventory', 'inventory', { x: 12, y: 280 })
  const drop = el('div', 'drop'); drop.innerHTML = 'drop images here<small>or click · then type h w d in cm</small>'
  const pick = el('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.multiple = true; pick.hidden = true
  drop.addEventListener('click', () => pick.click())
  const grid = el('div', 'thumbs')
  const pending = el('div', 'pending')
  inv.body.append(drop, pick, pending, grid)
  const addForm = async (f: File) => {
    let img: { data: string; w: number; h: number }
    try { img = await readImage(f) } catch { shell.toast(`${f.name}: not an image`, 'warn'); return }
    const rowEl = el('div', 'addrow')
    const th = el('img', 'thumb') as HTMLImageElement; th.src = img.data
    const title = el('input'); title.type = 'text'; title.value = f.name.replace(/\.[a-z0-9]+$/i, ''); title.placeholder = 'title'
    const hI = el('input'); hI.type = 'number'; hI.placeholder = 'h cm'; hI.value = '90'
    const wI = el('input'); wI.type = 'number'; wI.placeholder = 'w cm'; wI.value = String(Math.round(90 * img.w / img.h))
    const dI = el('input'); dI.type = 'number'; dI.placeholder = 'd cm'; dI.value = '4'
    hI.addEventListener('input', () => { wI.value = String(Math.round(Number(hI.value) * img.w / img.h)) })
    const edge = el('select'); for (const o of ['wrap', 'white']) { const op = el('option', undefined, o); op.value = o; edge.appendChild(op) }
    const ok = el('button', 'chip', 'add'); const no = el('button', 'chip', '×')
    const commit = async () => {
      const h = Number(hI.value), w = Number(wI.value), d = Number(dI.value)
      if (!(h > 0 && w > 0 && d >= 0)) { shell.toast('h w d in cm, please', 'warn'); return }
      const a = await art.addLocal({ title: title.value || f.name, data: img.data, h, w, d, edge: edge.value })
      rowEl.remove(); shell.toast(`${a.title} · ${a.w} × ${a.h} × ${a.d} cm in the library`)
    }
    ok.addEventListener('click', () => void commit()); no.addEventListener('click', () => rowEl.remove())
    for (const i of [title, hI, wI, dI]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') void commit() })
    const fields = el('div', 'fields'); fields.append(title, hI, wI, dI, edge, ok, no)
    rowEl.append(th, fields); pending.appendChild(rowEl); title.focus()
  }
  const takeFiles = (files: FileList | null) => { if (files) for (const f of Array.from(files)) void addForm(f) }
  pick.addEventListener('change', () => { takeFiles(pick.files); pick.value = '' })
  for (const target of [drop, shell.viewport]) {
    target.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over') })
    target.addEventListener('dragleave', () => drop.classList.remove('over'))
    target.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('over')
      const fs = e.dataTransfer?.files ?? null
      const jsons = fs ? Array.from(fs).filter((f) => f.name.endsWith('.json')) : []
      if (jsons.length) { void loadLayoutFile(jsons[0]); return }
      takeFiles(fs)
    })
  }
  const drawGrid = () => {
    grid.innerHTML = ''
    if (!art.library.length) { grid.appendChild(emptyState('no art yet', 'drop images above, type h w d in cm, click one to hold it')); return }
    art.library.forEach((a, i) => {
      const t = el('div', 'thumbwrap' + (art.held?.id === a.id ? ' held' : '')); t.title = `${a.title} · click = hold · ${i + 1}`
      const im = el('img', 'thumb') as HTMLImageElement; im.src = a.data ?? `${DATA}art/${a.file}`
      const cap = el('div', 'cap'); cap.innerHTML = `${a.title}<small>${a.w} × ${a.h} × ${a.d}${art.placedCount(a.id) ? ` · <b>on wall ×${art.placedCount(a.id)}</b>` : ''}</small>`
      const rm = el('button', 'x', '×'); rm.title = 'remove from the library (and the walls)'
      rm.addEventListener('click', (e) => { e.stopPropagation(); if (confirm(`remove ${a.title} from the library?`)) void art.removeLocal(a.id) })
      t.append(im, cap); if (a.data) t.appendChild(rm)
      t.addEventListener('click', () => { if (mode !== 'hang') { mode = 'hang'; modes.set('hang'); art.mode = 'hang' } art.hold(art.held?.id === a.id ? null : a); shell.toast(art.held ? `holding ${a.title} · look at a wall, click` : 'put down') })
      grid.appendChild(t)
    })
  }
  // ---- HANG: the widget ---------------------------------------------------------------------
  const hang = shell.card('hang', 'hang', { x: 12, y: 52, anchor: 'right' })
  const holding = el('div', 'note', 'holding nothing')
  const snapChips = chips<SnapLine>([
    { id: 'top', label: 'top', tip: 'the top edge sits on the line' }, { id: 'centre', label: 'centre', tip: 'the centre sits on the line' },
    { id: 'bottom', label: 'bottom', tip: 'the bottom edge sits on the line' }, { id: 'free', label: 'free', tip: 'hang it where the crosshair is' },
  ], art.layout.guides.snap, (v) => { art.setGuides({ snap: v }); syncHang() })
  const height = el('input'); height.type = 'number'; height.min = '0'; height.max = '400'; height.step = '1'
  const slider = el('input'); slider.type = 'range'; slider.min = '0'; slider.max = '400'; slider.step = '1'
  const setHeight = (v: number) => { const g = art.layout.guides; if (g.snap === 'free') return; art.setGuides({ [g.snap]: v } as Partial<typeof g>); syncHang() }
  height.addEventListener('change', () => setHeight(Number(height.value))); slider.addEventListener('input', () => setHeight(Number(slider.value)))
  const gapI = el('input'); gapI.type = 'number'; gapI.min = '0'; gapI.max = '200'; gapI.step = '1'
  gapI.addEventListener('change', () => { art.setGuides({ gap: Number(gapI.value) }); syncHang() })
  const guideT = el('input'); guideT.type = 'checkbox'
  guideT.addEventListener('change', () => { art.setGuides({ show: guideT.checked }) })
  const snapWall = el('button', 'chip', 'snap all on this wall'); snapWall.addEventListener('click', () => { const h = art.hitWall(); if (!h) { shell.toast('look at a wall first', 'warn'); return } shell.toast(`${art.snapAll(h.wall.id)} snapped`) })
  const snapAllB = el('button', 'chip', 'snap all'); snapAllB.addEventListener('click', () => shell.toast(`${art.snapAll()} snapped`))
  const applyRow = el('div', 'chips'); applyRow.append(snapWall, snapAllB)
  const wallNote = el('div', 'note', '')
  hang.body.append(holding, el('div', 'legend', 'snap line'), snapChips.root, row('height cm', height, 'the line, in cm above this floor'), slider, row('gap cm', gapI, 'edge-to-edge snap distance between neighbours'), row('show guide', guideT), applyRow, wallNote)
  const syncHang = () => {
    const g = art.layout.guides; snapChips.set(g.snap)
    const v = g.snap === 'free' ? 0 : g[g.snap]; height.value = String(v); slider.value = String(v); height.disabled = slider.disabled = g.snap === 'free'
    gapI.value = String(g.gap); guideT.checked = g.show
    holding.textContent = art.held ? `holding ${art.held.title} · ${art.held.w} × ${art.held.h} cm` : 'holding nothing · click a thumbnail'
    hang.setStatus(`${art.layout.items.length} on walls`)
  }
  // ---- FILE: layouts ------------------------------------------------------------------------
  const file = shell.card('file', 'file', { x: 12, y: 300, anchor: 'right' })
  const nameI = el('input'); nameI.type = 'text'; nameI.placeholder = 'layout name'
  nameI.addEventListener('change', () => { art.layout.name = nameI.value || 'draft'; art.autosave(); syncFile() })
  const saveB = el('button', 'chip', 'save file'); saveB.title = 'download this layout as a .json (send it, drop it back here)'
  saveB.addEventListener('click', () => {
    const f = art.exportFile(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([f.json], { type: 'application/json' })); a.download = f.name; a.click()
    shell.toast(f.skipped.length ? `saved · ${f.skipped.length} image(s) too big to travel: ${f.skipped.join(', ')}` : `saved ${f.name}`, f.skipped.length ? 'warn' : 'ok')
  })
  const loadI = el('input'); loadI.type = 'file'; loadI.accept = '.json'; loadI.hidden = true
  const loadB = el('button', 'chip', 'load file'); loadB.addEventListener('click', () => loadI.click())
  const loadLayoutFile = async (f: File) => {
    const text = await f.text()
    if (art.layout.items.length && !confirm(`replace the draft (${art.layout.items.length} works) with ${f.name}? undoable`)) return
    try { const r = await art.importFile(text); shell.toast(`loaded ${f.name} · ${r.works} works · ${r.art} new images`); syncAll() } catch (e) { shell.toast((e as Error).message, 'bad') }
  }
  loadI.addEventListener('change', () => { if (loadI.files?.[0]) void loadLayoutFile(loadI.files[0]); loadI.value = '' })
  const clearB = el('button', 'chip', 'clear'); clearB.addEventListener('click', () => { if (confirm('take every work off the walls? undoable')) art.clearDraft() })
  const fileRow = el('div', 'chips'); fileRow.append(saveB, loadB, clearB)
  const fileNote = el('div', 'note', '')
  file.body.append(row('name', nameI), fileRow, loadI, fileNote)
  const syncFile = () => { nameI.value = art.layout.name; fileNote.textContent = `draft autosaved in this browser · ${art.layout.items.length} works · save file to send it`; file.setStatus('draft') }
  const syncAll = () => { drawGrid(); syncHang(); syncFile() }
  art.onChange = syncAll
  await art.load()
  syncAll()
  walker.onChange = () => art.onLevelChange()

  // ---- keys ------------------------------------------------------------------------
  const toggleDoor = () => {
    const d = walker.nearestDoor()
    if (!d) return
    if (!d.opening.door?.toggle) { shell.toast('this door does not open', 'warn'); return }
    d.open = !d.open
  }
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return
    if (mode === 'hang') {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); shell.toast((e.shiftKey ? art.doRedo() : art.doUndo()) ? (e.shiftKey ? 'redo' : 'undo') : 'nothing to undo', 'ok'); return }
      if (e.code === 'BracketLeft' || e.code === 'Comma') { art.swap(-1); return }
      if (e.code === 'BracketRight' || e.code === 'Period') { art.swap(1); return }
      if (/^Digit[0-9]$/.test(e.code)) { const n = Number(e.code.slice(5)); const a = art.library[n === 0 ? 9 : n - 1]; if (a) art.hold(a); return }
      if (e.code === 'Tab') { e.preventDefault(); const p = art.selectNext(); shell.toast(p ? `selected ${art.library.find((x) => x.id === p.art)?.title ?? 'work'} · delete, arrows, e` : 'nothing selected'); return }
      if (e.code === 'KeyH') { art.hands = !art.hands; shell.toast(art.hands ? 'hands view on' : 'hands view off'); return }
      if (e.code === 'KeyQ') { art.hold(null); return }
      if (e.code === 'Delete' || e.code === 'Backspace') { if (art.remove()) shell.toast('taken down'); return }
      if (e.code.startsWith('Arrow')) { const st = e.shiftKey ? 10 : 1; const du = e.code === 'ArrowLeft' ? -st : e.code === 'ArrowRight' ? st : 0; const dy = e.code === 'ArrowUp' ? st : e.code === 'ArrowDown' ? -st : 0; if (art.nudge(du, dy)) e.preventDefault(); return }
      if (e.code === 'KeyE') { if (art.pickup()) { shell.toast(`holding ${art.held?.title}`); return } }
    }
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') { big.hidden = !big.hidden; if (!big.hidden) walker.release() }
    else if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') toggleDoor()
    else if (e.code === 'Escape') {
      if (!big.hidden) big.hidden = true
      else if (!shell.hideHelp()) {
        if (walker.state.locked) walker.release()
        else if (mode === 'hang') { mode = 'walk'; modes.set('walk'); art.mode = 'walk'; art.hold(null); art.selected = null; shell.toast('walk') }
      }
    }
    else if (e.key === '?') shell.toggleHelp(HELP)
  })

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (mode !== 'hang' || !walker.state.locked || e.button !== 0) return
    const r = art.place()
    if (r === 'placed') shell.toast(`hung ${art.held?.title}`)
    else if (r === 'refused') shell.toast(art.preview.why || 'look at a hang wall', 'warn')
    else if (r === 'picked') shell.toast(`holding ${art.held?.title}`)
  })
  renderer.domElement.addEventListener('wheel', (e) => { if (mode === 'hang' && walker.state.locked) { art.swap(e.deltaY > 0 ? 1 : -1); e.preventDefault() } }, { passive: false })

  // ---- loop --------------------------------------------------------------------------
  const clock = new THREE.Clock()
  let last = ''
  const tick = () => {
    const dt = Math.min(0.05, clock.getDelta())
    walker.update(dt)
    updateDoors(built.doors, dt)
    art.update()
    if (mode === 'hang' && walker.state.locked) {
      const pv = art.preview
      const look = !art.held ? art.lookedAt() : null
      const sel = art.selected ? art.layout.items.find((p) => p.id === art.selected) : null
      const txt = art.held ? (pv.hit ? (pv.ok ? `click · hang ${art.held.title} here` : `can't hang here · ${pv.why}`) : `holding ${art.held.title} · look at a hang wall`) : sel ? `selected · e take · delete · arrows nudge · tab next` : (look ? 'click or e · take it · delete · arrows nudge' : 'click a thumbnail, scroll, or tab to select a hung work')
      if (hangTip.textContent !== txt) hangTip.textContent = txt
      hangTip.hidden = false
    } else hangTip.hidden = true
    hint.hidden = walker.state.locked; cross.hidden = !walker.state.locked
    const near = walker.state.locked ? walker.nearestDoor() : null
    doorTip.hidden = !near
    if (near) doorTip.textContent = near.opening.door?.toggle ? (near.open ? 'e · close door' : 'e · open door') : 'door · closed'
    const s = walker.state
    const txt = `${floorOf(level, s.level).name} · x ${s.x.toFixed(2)} z ${s.z.toFixed(2)}${s.onStair ? ' · stair' : ''}`
    if (txt !== last) { readout.innerHTML = `<b>${txt}</b>`; where.textContent = txt; last = txt }
    minimap.draw(s)
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
  }
  tick()
  shell.toast(`level built · ${level.walls.length} walls · click to walk`)

  // debug handle + shot(): renders and posts a JPEG to the dev server (docs/sheet)
  const shot = async (name: string): Promise<string> => {
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/jpeg', 0.92)
    const r = await fetch(`${BASE}__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url })
    return r.text()
  }
  // plan(name, x0, z0, x1, z1): straight-down orthographic render at 1 px = 1 cm, posted like shot(); overlays the scan ortho
  const plan = async (name: string, x0 = -0.5, z0 = -4.6, x1 = 8.0, z1 = 5.2, maxY = -2.5, ppm = 100): Promise<string> => {
    const w = Math.round((x1 - x0) * ppm), h = Math.round((z1 - z0) * ppm)
    const cam = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 0.1, 50)   // top = -z0 so +z runs down the image like the scan ortho
    cam.position.set(0, maxY, 0); cam.up.set(0, 0, -1); cam.lookAt(0, -100, 0)
    cam.near = 0.1; cam.far = maxY + 100; cam.updateProjectionMatrix()
    const keep = renderer.getSize(new THREE.Vector2())
    renderer.setSize(w, h, false); renderer.render(scene, cam)
    const url = renderer.domElement.toDataURL('image/png')
    renderer.setSize(keep.x, keep.y, false); resize()
    const r = await fetch(`${BASE}__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url })
    return r.text()
  }
  const view = (lvl: string, x: number, z: number, yawDeg: number, pitchDeg = 0): void => {
    walker.teleport(lvl, x, z); walker.state.yaw = THREE.MathUtils.degToRad(yawDeg); walker.state.pitch = THREE.MathUtils.degToRad(pitchDeg); walker.update(0.016)
  }
  ;(window as unknown as { koanHang: unknown }).koanHang = { walker, level, scene, renderer, camera, shot, plan, view, THREE, built, toggleDoor, art, setMode: (m: Mode) => { mode = m; modes.set(m); art.mode = m }, meshAudit: () => meshAudit(level, built.group), skyLeakAudit: () => skyLeakAudit(level, built.group, built.doors) }
}

main().catch((e) => { console.error(e); alert(`KOAN.hang failed: ${(e as Error).message}`) })
