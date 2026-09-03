// KOAN.hang — P2: the clean level built from level.json, walked first person. No scan in the app.
import './styles.css'
import * as THREE from 'three'
import { applyTheme, currentTheme, accentColor } from './themes'
import { loadLevel, buildLevel, updateDoors, floorOf, setWireColor, meshAudit, skyLeakAudit, type Level } from './level'
import { Walker, isTyping } from './walk'
import { Minimap } from './minimap'
import { Shell, chips, el, emptyState, row, type Mode } from './ui'

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
<div class="dim">hang and level modes arrive later. click anywhere to close.</div>`

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

  let look: Look = 'clean'
  try { look = (localStorage.getItem(LOOK_KEY) as Look) || 'clean' } catch { /* private */ }
  if (look === 'textured') look = 'clean'
  const applyLook = () => {
    built.wire.visible = look === 'wire'
    try { localStorage.setItem(LOOK_KEY, look) } catch { /* private */ }
  }
  applyLook()

  // ---- walk ---------------------------------------------------------------------
  const walker = new Walker(level, camera, renderer.domElement)
  walker.doors = built.doors
  const hint = el('div', 'hint'); hint.innerHTML = 'click to walk<small>w a s d · shift run · e door · m plan · esc lets go</small>'
  const cross = el('div', 'crosshair'); cross.hidden = true
  const doorTip = el('div', 'doortip'); doorTip.hidden = true
  shell.viewport.append(hint, cross, doorTip)

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
    { id: 'hang', label: 'hang', tip: 'place art on walls', disabled: 'arrives in P4' },
    { id: 'level', label: 'level', tip: 'fix walls, doors, stairs', disabled: 'arrives in P5' },
  ], 'walk', () => { /* only walk for now */ })
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
    { id: 'textured', label: 'textured', tip: 'baked textures from the scan', disabled: 'arrives in P3' },
  ], look, (v) => { look = v; lookChips.set(v); applyLook() })
  levelCard.body.append(el('div', 'legend', 'look'), lookChips.root)
  const eye = el('input'); eye.type = 'number'; eye.min = '100'; eye.max = '220'; eye.step = '1'; eye.value = String(Math.round(level.eyeHeight * 100))
  eye.addEventListener('change', () => { const v = Number(eye.value); if (v >= 100 && v <= 220) { level.eyeHeight = v / 100; shell.toast(`eye height ${v} cm`) } })
  levelCard.body.append(row('eye height cm', eye, 'camera height above the floor · 160 = average eye'))
  const where = el('div', 'note', ''); levelCard.body.append(where)
  levelCard.body.append(el('div', 'note', `${level.walls.filter((w) => w.hang !== false).length} hang walls · ${level.stairs.length} stairs · ${built.doors.length} doors · ${level.levels.length} floors`))

  const inv = shell.card('inventory', 'inventory', { x: 12, y: 280 })
  inv.body.append(emptyState('no art yet', 'P4 brings the inventory: drop images here, set cm sizes, hang them.'))
  const hang = shell.card('hang', 'hang', { x: 12, y: 52, anchor: 'right' })
  hang.body.append(emptyState('nothing to snap', 'P4 brings the hang widget: top / centre / bottom line, height in cm, gap.'))
  const file = shell.card('file', 'file', { x: 12, y: 200, anchor: 'right' })
  file.body.append(emptyState('no layouts', 'P4 brings save and load. P5 brings exports and the repo save.'))

  // ---- keys ------------------------------------------------------------------------
  const toggleDoor = () => {
    const d = walker.nearestDoor()
    if (!d) return
    if (!d.opening.door?.toggle) { shell.toast('this door does not open', 'warn'); return }
    d.open = !d.open
  }
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') { big.hidden = !big.hidden; if (!big.hidden) walker.release() }
    else if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') toggleDoor()
    else if (e.code === 'Escape') { if (!big.hidden) big.hidden = true; else if (!shell.hideHelp()) walker.release() }
    else if (e.key === '?') shell.toggleHelp(HELP)
  })

  // ---- loop --------------------------------------------------------------------------
  const clock = new THREE.Clock()
  let last = ''
  const tick = () => {
    const dt = Math.min(0.05, clock.getDelta())
    walker.update(dt)
    updateDoors(built.doors, dt)
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
  ;(window as unknown as { koanHang: unknown }).koanHang = { walker, level, scene, renderer, camera, shot, plan, view, THREE, built, toggleDoor, meshAudit: () => meshAudit(level, built.group), skyLeakAudit: () => skyLeakAudit(level, built.group, built.doors) }
}

main().catch((e) => { console.error(e); alert(`KOAN.hang failed: ${(e as Error).message}`) })
