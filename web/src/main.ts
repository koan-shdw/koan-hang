// KOAN.hang — P1 walk. Loads level.json + scan.glb, walks the clean layer, minimap, themes.
import './styles.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { applyTheme, currentTheme, accentColor } from './themes'
import { loadLevel, buildCleanMeshes, floorOf, setWireColor, type Level } from './level'
import { Walker, isTyping } from './walk'
import { Minimap } from './minimap'
import { Shell, chips, el, emptyState, row, type CleanLook, type Mode } from './ui'

const BASE = import.meta.env.BASE_URL
const DATA = `${BASE}data/`
const LOOK_KEY = 'koan-hang-look'

const HELP = `<h3>KOAN.hang · keys</h3>
<table>
<tr><td>click</td><td>take the mouse (walk)</td></tr>
<tr><td>w a s d</td><td>walk · shift = run</td></tr>
<tr><td>mouse</td><td>look</td></tr>
<tr><td>m</td><td>plan of this floor · click on it = go there</td></tr>
<tr><td>esc</td><td>give the mouse back · close overlays</td></tr>
<tr><td>?</td><td>this</td></tr>
</table>
<div class="dim">hang and level modes arrive in P2 and P3. click anywhere to close.</div>`

applyTheme(currentTheme())

async function main(): Promise<void> {
  const shell = new Shell(document.getElementById('app')!)
  shell.logo()

  // ---- renderer -------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  shell.viewport.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0d0c)
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777066, 1.1))
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(3, 8, 2); scene.add(sun)
  const resize = () => {
    const w = shell.viewport.clientWidth, h = shell.viewport.clientHeight
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize); resize()

  // ---- loading (law 16: honest) ------------------------------------------------
  const loading = el('div', 'loading')
  const ltxt = el('div', 'txt', 'loading level…'); const bar = el('div', 'bar'); const fill = el('i'); bar.appendChild(fill)
  loading.append(el('div', undefined, 'KOAN.hang'), bar, ltxt); shell.viewport.appendChild(loading)

  let level: Level
  try {
    level = await loadLevel(`${DATA}level/level.json`)
  } catch (e) {
    ltxt.textContent = `level.json failed: ${(e as Error).message}`; shell.toast('level.json failed to load', 'bad', 8000); return
  }

  const draco = new DRACOLoader(); draco.setDecoderPath(`${BASE}draco/`)
  const gltf = new GLTFLoader(); gltf.setDRACOLoader(draco)
  let scanRoot: THREE.Group | null = null
  try {
    const g = await gltf.loadAsync(`${DATA}level/${level.scan.file}`, (ev) => {
      const mb = (ev.loaded / 1e6).toFixed(1)
      if (ev.total) { fill.style.width = `${(ev.loaded / ev.total) * 100}%`; ltxt.textContent = `scan ${mb} / ${(ev.total / 1e6).toFixed(1)} MB` }
      else ltxt.textContent = `scan ${mb} MB…`
    })
    scanRoot = g.scene
    scanRoot.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      const map = src.map ?? null
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()) }
      m.material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }) // baked light: unlit
      m.frustumCulled = true
    })
    scene.add(scanRoot)
  } catch (e) {
    shell.toast(`scan failed to load: ${(e as Error).message}`, 'bad', 8000)
  }
  loading.remove()

  // ---- clean layer -------------------------------------------------------------
  const clean = buildCleanMeshes(level)
  scene.add(clean.solid, clean.wire, clean.patches)
  setWireColor(clean.wire, accentColor())
  let look: CleanLook = 'hidden'
  try { look = (localStorage.getItem(LOOK_KEY) as CleanLook) || 'hidden' } catch { /* private */ }
  const applyLook = () => {
    clean.solid.visible = look === 'whitebox'
    clean.wire.visible = look === 'both'
    clean.patches.visible = look !== 'whitebox'
    if (scanRoot) scanRoot.visible = look !== 'whitebox'
    try { localStorage.setItem(LOOK_KEY, look) } catch { /* private */ }
  }
  applyLook()

  // ---- walk ---------------------------------------------------------------------
  const walker = new Walker(level, camera, renderer.domElement)
  const hint = el('div', 'hint'); hint.innerHTML = 'click to walk<small>w a s d · shift run · m plan · esc lets go</small>'
  const cross = el('div', 'crosshair'); cross.hidden = true
  shell.viewport.append(hint, cross)

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
    { id: 'hang', label: 'hang', tip: 'place art on walls', disabled: 'arrives in P2' },
    { id: 'level', label: 'level', tip: 'fix walls, doors, stairs', disabled: 'arrives in P3' },
  ], 'walk', () => { /* only walk in P1 */ })
  shell.top.appendChild(modes.root)
  const readout = el('span', 'readout'); shell.top.appendChild(readout)
  shell.spacer()
  shell.themePicker(() => setWireColor(clean.wire, accentColor()))
  shell.helpButton(HELP)

  // ---- cards ---------------------------------------------------------------------
  const levelCard = shell.card('level', 'level', { x: 12, y: 52 })
  const lookChips = chips<CleanLook>([
    { id: 'hidden', label: 'hidden', tip: 'clean layer hidden · scan shows · art snaps and walls collide anyway' },
    { id: 'whitebox', label: 'white box', tip: 'scan hidden · clean walls, floors, stairs as a white gallery' },
    { id: 'both', label: 'both', tip: 'clean layer as wireframe over the scan · for fixing' },
  ], look, (v) => { look = v; lookChips.set(v); applyLook() })
  levelCard.body.append(el('div', 'legend', 'clean layer'), lookChips.root)
  const eye = el('input'); eye.type = 'number'; eye.min = '100'; eye.max = '220'; eye.step = '1'; eye.value = String(Math.round(level.eyeHeight * 100))
  eye.addEventListener('change', () => { const v = Number(eye.value); if (v >= 100 && v <= 220) { level.eyeHeight = v / 100; shell.toast(`eye height ${v} cm`) } })
  levelCard.body.append(row('eye height cm', eye, 'camera height above the floor · 160 = average eye'))
  const where = el('div', 'note', ''); levelCard.body.append(where)
  const wallsNote = el('div', 'note', `${level.walls.filter((w) => w.hang !== false).length} hang walls · ${level.stairs.length} stair · ${level.levels.length} floors`)
  levelCard.body.append(wallsNote)

  const inv = shell.card('inventory', 'inventory', { x: 12, y: 260 })
  inv.body.append(emptyState('no art yet', 'P2 brings the inventory: drop images here, set cm sizes, hang them.'))
  const hang = shell.card('hang', 'hang', { x: 12, y: 52, anchor: 'right' })
  hang.body.append(emptyState('nothing to snap', 'P2 brings the hang widget: top / centre / bottom line, height in cm, gap.'))
  const file = shell.card('file', 'file', { x: 12, y: 200, anchor: 'right' })
  file.body.append(emptyState('no layouts', 'P2 brings save and load. P3 brings exports and the repo save.'))
  // debug handle + shot(): renders and posts a JPEG to the dev server (object sheet)
  const shot = async (name: string): Promise<string> => {
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/jpeg', 0.92)
    const r = await fetch(`${BASE}__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url })
    return r.text()
  }
  const view = (lvl: string, x: number, z: number, yawDeg: number, pitchDeg = 0): void => {
    walker.teleport(lvl, x, z); walker.state.yaw = THREE.MathUtils.degToRad(yawDeg); walker.state.pitch = THREE.MathUtils.degToRad(pitchDeg); walker.update(0.016)
  }
  ;(window as unknown as { koanHang: unknown }).koanHang = { walker, level, scene, renderer, camera, shot, view }

  // ---- keys ------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') { big.hidden = !big.hidden; if (!big.hidden) walker.release() }
    else if (e.code === 'Escape') { if (!big.hidden) big.hidden = true; else if (!shell.hideHelp()) walker.release() }
    else if (e.key === '?') shell.toggleHelp(HELP)
  })

  // ---- loop --------------------------------------------------------------------------
  const clock = new THREE.Clock()
  let last = ''
  const tick = () => {
    const dt = Math.min(0.05, clock.getDelta())
    walker.update(dt)
    hint.hidden = walker.state.locked; cross.hidden = !walker.state.locked
    const s = walker.state
    const txt = `${floorOf(level, s.level).name} · x ${s.x.toFixed(2)} z ${s.z.toFixed(2)}${s.onStair ? ' · stair' : ''}`
    if (txt !== last) { readout.innerHTML = `<b>${txt}</b>`; where.textContent = txt; last = txt }
    minimap.draw(s)
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
  }
  tick()
  shell.toast(`${level.walls.length} walls loaded · click to walk`)
}

main().catch((e) => { console.error(e); alert(`KOAN.hang failed: ${(e as Error).message}`) })
