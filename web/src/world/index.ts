// The world (REMAKE.md §2): three.js only, never touches the DOM it did not make (the canvas). Talks to the UI through the bus.
// Boot: renderer → loader → room → walk → art → keys → loop. Every rule and key from gate 1 (c830ca4) is here unchanged.
import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { bus, type Mode, type Look } from '../bus'
import { Renderer } from './renderer'
import { Loader } from './loader'
import { loadLevel, buildLevel, updateDoors, floorOf, setWireColor, meshAudit, skyLeakAudit, applyTextures, worldUVs, type Level } from './room/level'
import { Walker, isTyping } from './walk'
import { Minimap } from './minimap'
import { ArtSystem } from './art/art'
import { Anchors } from './anchors'
import { Looks } from './looks'

// three-mesh-bvh: the room's static geometry gets a BVH; raycasts against it are the accelerated kind
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

const LOOK_KEY = 'koan-hang-look'

export interface WorldHandle { renderer: Renderer; level: Level; art: ArtSystem; walker: Walker; dispose: () => void }

export async function startWorld(container: HTMLElement, base: string): Promise<WorldHandle | null> {
  const DATA = `${base}data/`
  const renderer = new Renderer(container)
  const { scene, camera } = renderer
  const loader = new Loader(base, renderer.gl)
  scene.background = new THREE.Color(0xbfd9f2)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8078, 0.55))
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.2); sun.position.set(6, 10, -4); scene.add(sun)

  // ---- room ---------------------------------------------------------------------------------------
  let level: Level
  try { level = await loadLevel(`${DATA}level/level.json`) } catch (e) { bus.emit('world_failed', { message: (e as Error).message }); return null }
  const built = buildLevel(level)
  worldUVs(built.group)
  scene.add(built.group, built.wire)
  if (level.sky?.fallback) scene.background = new THREE.Color(level.sky.fallback)
  if (level.fog) scene.fog = new THREE.Fog(new THREE.Color(level.fog.color), level.fog.near, level.fog.far)
  if (level.sky?.file) {
    loader.image(`${DATA}textures/${level.sky.file}`, 'sky').then((tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; looks.setFlatBackground(tex) }).catch(() => { /* no panorama yet */ })
  }
  // tiles: KTX2 first (textures/ktx2/<name>.ktx2, GPU-compressed, mips baked), the jpg through the bitmap worker when a ktx2 is missing
  const aniso = renderer.gl.capabilities.getMaxAnisotropy()
  const tile = (file: string): Promise<THREE.Texture> => {
    const name = file.replace(/\.[a-z0-9]+$/i, '')
    return loader.texture(`${DATA}textures/ktx2/${name}.ktx2`, 'room', { repeat: true, anisotropy: aniso })
      .catch(() => loader.image(`${DATA}textures/${file}`, 'room', { repeat: true, anisotropy: aniso }))
  }
  let look: Look = 'textured'
  try { const saved = localStorage.getItem(LOOK_KEY); if (saved === 'clean' || saved === 'wire' || saved === 'textured') look = saved } catch { /* private */ }
  const applyLook = () => {
    built.wire.visible = look === 'wire'
    applyTextures(look === 'textured', tile)
    try { localStorage.setItem(LOOK_KEY, look) } catch { /* private */ }
    bus.emit('look', { look })
  }
  applyLook()

  const looks = new Looks(renderer, built.group, new THREE.Color(level.fog?.color ?? level.sky?.fallback ?? 0x232325), DATA)

  // the room's BVH: one static mesh of every wall and floor, for occlusion queries (a work behind a wall is not looked at)
  built.group.updateMatrixWorld(true)
  const chunks: Float32Array[] = []; let total = 0
  built.group.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || !m.visible) return
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    const pos = g.getAttribute('position'); if (!pos) return
    const arr = new Float32Array(pos.count * 3); const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z }
    chunks.push(arr); total += arr.length
    if (g !== m.geometry) g.dispose()
  })
  const merged = new Float32Array(total); let off = 0
  for (const c of chunks) { merged.set(c, off); off += c.length }
  const roomGeo = new THREE.BufferGeometry(); roomGeo.setAttribute('position', new THREE.BufferAttribute(merged, 3))
  const roomBVH = new MeshBVH(roomGeo)
  const bvhRay = new THREE.Ray()
  const occluder = (origin: THREE.Vector3, dir: THREE.Vector3, far: number): number | null => {
    bvhRay.origin.copy(origin); bvhRay.direction.copy(dir)
    const hit = roomBVH.raycastFirst(bvhRay, THREE.DoubleSide, 0, far)
    return hit ? hit.distance : null
  }

  // ---- walk, art -------------------------------------------------------------------------------------
  const walker = new Walker(level, camera, renderer.gl.domElement)
  walker.doors = built.doors
  const art = new ArtSystem(level, scene, walker, camera, DATA, loader)
  art.occluder = occluder
  const anchors = new Anchors()
  let mode: Mode = 'walk'
  const nameOf = (id: string): string => art.library.find((x) => x.id === id)?.title ?? 'work'
  const setMode = (m: Mode) => { mode = m; art.mode = m; if (m !== 'hang') { art.hold(null); art.selected = null } bus.emit('mode', { mode }) }

  const artSnapshot = () => {
    const placed: Record<string, number> = {}
    for (const p of art.layout.items) placed[p.art] = (placed[p.art] ?? 0) + 1
    bus.emit('art_state', { library: art.library, held: art.held?.id ?? null, layout: art.layout, selected: art.selected, placed, hands: art.hands })
  }
  art.onChange = artSnapshot
  await art.load()
  artSnapshot()
  walker.onChange = () => art.onLevelChange()

  bus.emit('world_ready', { hangWalls: level.walls.filter((w) => w.hang !== false).length, stairs: level.stairs.length, doors: built.doors.length, floors: level.levels.length, eyeCm: Math.round(level.eyeHeight * 100), walls: level.walls.length })
  bus.emit('mode', { mode })

  // ---- minimap: the UI hands over two canvases -------------------------------------------------------
  let minimap: Minimap | null = null
  let bigShown = false
  const showMap = (show: boolean) => { bigShown = show; bus.emit('map_show', { show }); if (show) walker.release() }

  // ---- bus: ui → world ---------------------------------------------------------------------------------
  const offs: (() => void)[] = []
  offs.push(
    bus.on('set_mode', ({ mode: m }) => { setMode(m); bus.toast(m === 'hang' ? 'hang: click a thumbnail, look at a wall, click' : m) }),
    bus.on('set_look', ({ look: l }) => { look = l; applyLook() }),
    bus.on('set_eye', ({ cm }) => { if (cm >= 100 && cm <= 220) { level.eyeHeight = cm / 100; bus.toast(`eye height ${cm} cm`) } }),
    bus.on('accent', ({ css }) => setWireColor(built.wire, css)),
    bus.on('hold', ({ id }) => {
      const a = id ? art.library.find((x) => x.id === id) ?? null : null
      if (a && mode !== 'hang') setMode('hang')
      art.hold(a && art.held?.id === a.id ? null : a)
      bus.toast(art.held ? `holding ${art.held.title} · look at a wall, click` : 'put down')
    }),
    bus.on('add_local', ({ item }) => { void art.addLocal(item).then((a) => bus.toast(`${a.title} · ${a.w} × ${a.h} × ${a.d} cm in the library`)) }),
    bus.on('remove_local', ({ id }) => { void art.removeLocal(id) }),
    bus.on('set_guides', ({ patch }) => art.setGuides(patch)),
    bus.on('snap_all', ({ wall }) => {
      if (wall === 'looked') { const h = art.hitWall(); if (!h) { bus.toast('look at a wall first', 'warn'); return } bus.toast(`${art.snapAll(h.wall.id)} snapped`) }
      else bus.toast(`${art.snapAll()} snapped`)
    }),
    bus.on('set_name', ({ name }) => { art.layout.name = name || 'draft'; art.autosave(); artSnapshot() }),
    bus.on('export_file', () => { const f = art.exportFile(); bus.emit('file_ready', f) }),
    bus.on('import_file', ({ text, name }) => { void art.importFile(text).then((r) => bus.toast(`loaded ${name} · ${r.works} works · ${r.art} new images`)).catch((e) => bus.toast((e as Error).message, 'bad')) }),
    bus.on('clear_draft', () => art.clearDraft()),
    bus.on('mount_maps', ({ small, big }) => { minimap = new Minimap(level, small, big) }),
    bus.on('map_click', ({ px, py }) => {
      const hit = minimap?.hit(px, py, walker.state)
      if (hit) { walker.teleport(walker.state.level, hit[0], hit[1]); showMap(false); bus.toast(`moved to ${floorOf(level, walker.state.level).name} floor`) }
      else bus.toast('not a floor there', 'warn')
    }),
    bus.on('map_toggle', () => showMap(!bigShown)),
  )

  // ---- keys (gate 1, unchanged) ---------------------------------------------------------------------------
  const toggleDoor = () => {
    const d = walker.nearestDoor(); if (!d) return
    if (!d.opening.door?.toggle) { bus.toast('this door does not open', 'warn'); return }
    d.open = !d.open
  }
  const onKey = (e: KeyboardEvent) => {
    if (isTyping(e)) return
    if (mode === 'hang') {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); bus.toast((e.shiftKey ? art.doRedo() : art.doUndo()) ? (e.shiftKey ? 'redo' : 'undo') : 'nothing to undo'); return }
      if (e.code === 'BracketLeft' || e.code === 'Comma') { art.swap(-1); return }
      if (e.code === 'BracketRight' || e.code === 'Period') { art.swap(1); return }
      if (/^Digit[0-9]$/.test(e.code)) { const n = Number(e.code.slice(5)); const a = art.library[n === 0 ? 9 : n - 1]; if (a) art.hold(a); return }
      if (e.code === 'Tab') { e.preventDefault(); const p = art.selectNext(); artSnapshot(); bus.toast(p ? `selected ${nameOf(p.art)} · delete, arrows, e` : 'nothing selected'); return }
      if (e.code === 'KeyH') { art.hands = !art.hands; artSnapshot(); bus.toast(art.hands ? 'hands view on' : 'hands view off'); return }
      if (e.code === 'KeyQ') { art.hold(null); return }
      if (e.code === 'Delete' || e.code === 'Backspace') { const t = art.target(); if (t && art.remove()) bus.toast(`${nameOf(t.art)} taken down · ctrl z brings it back`); else bus.toast('look at a hung work, or tab to select one', 'warn'); return }
      if (e.code.startsWith('Arrow')) { const st = e.shiftKey ? 10 : 1; const du = e.code === 'ArrowLeft' ? -st : e.code === 'ArrowRight' ? st : 0; const dy = e.code === 'ArrowUp' ? st : e.code === 'ArrowDown' ? -st : 0; if (art.nudge(du, dy)) e.preventDefault(); return }
      if (e.code === 'KeyE') { if (art.pickup()) { bus.toast(`${art.held?.title} in your hands · look at a wall, click · q puts it back`); return } }
    }
    if (e.code === 'KeyM') showMap(!bigShown)
    else if (e.code === 'KeyE') toggleDoor()
    else if (e.code === 'Escape') {
      if (bigShown) { showMap(false); return }
      bus.emit('overlays_close', {})
      if (walker.state.locked) walker.release()
      else if (mode === 'hang') { setMode('walk'); bus.toast('walk') }
    }
    else if (e.key === '?') bus.emit('help_toggle', {})
    else if (e.code === 'Backquote') bus.emit('debug_toggle', {})
  }
  window.addEventListener('keydown', onKey)
  const onDown = (e: MouseEvent) => {
    if (mode !== 'hang' || !walker.state.locked || e.button !== 0) return
    const r = art.place()
    if (r === 'placed') bus.toast(`hung ${art.held?.title} · ctrl z undoes · look at it and press delete to take it down`)
    else if (r === 'refused') bus.toast(art.preview.why || 'look at a hang wall', 'warn')
    else if (r === 'picked') bus.toast(`${art.held?.title} in your hands · look at a wall, click · q puts it back`)
  }
  const onWheel = (e: WheelEvent) => { if (mode === 'hang' && walker.state.locked) { art.swap(e.deltaY > 0 ? 1 : -1); e.preventDefault() } }
  renderer.gl.domElement.addEventListener('mousedown', onDown)
  renderer.gl.domElement.addEventListener('wheel', onWheel, { passive: false })

  // ---- loop --------------------------------------------------------------------------------------------------
  let lastWalk = '', lastHud = ''
  let elapsed = 0
  renderer.start((dt) => {
    elapsed += dt; looks.update(elapsed)
    walker.update(dt)
    updateDoors(built.doors, dt)
    art.update()
    const s = walker.state
    const locked = s.locked
    let hangTip: string | null = null
    if (mode === 'hang' && locked) {
      const pv = art.preview
      const lookAt = !art.held ? art.lookedAt() : null
      const sel = art.selected ? art.layout.items.find((p) => p.id === art.selected) : null
      hangTip = art.held ? (pv.hit ? (pv.ok ? `click hangs ${art.held.title} here · q puts it down` : `can't hang here · ${pv.why}`) : `${art.held.title} in your hands · look at a hang wall · q puts it down`) : sel ? `${nameOf(sel.art)} selected · delete takes it down · e takes it in hand · arrows nudge · tab next` : (lookAt ? `looking at ${nameOf(lookAt.art)} · delete takes it down · click or e takes it in hand · arrows nudge` : 'click a thumbnail or press 1-9 to hold a work · tab selects a hung work')
    }
    const near = locked ? walker.nearestDoor() : null
    const doorTip = near ? (near.opening.door?.toggle ? (near.open ? 'e · close door' : 'e · open door') : 'door · closed') : null
    const hudKey = `${locked}|${mode}|${hangTip}|${doorTip}`
    if (hudKey !== lastHud) { lastHud = hudKey; bus.emit('hud', { hint: locked ? null : mode === 'hang' ? 'hang' : 'walk', cross: locked, doorTip, hangTip }) }
    const walkKey = `${s.level}|${s.x.toFixed(2)}|${s.z.toFixed(2)}|${s.onStair}|${locked}`
    if (walkKey !== lastWalk) { lastWalk = walkKey; bus.emit('walk_state', { level: s.level, levelName: floorOf(level, s.level).name, x: s.x, z: s.z, onStair: !!s.onStair, locked }) }
    minimap?.draw(s)
    // R3 anchors: the HANG widget rides the wall where the held work will go; a looked-at work gets its title
    const hangOn = mode === 'hang' && locked
    anchors.set('hang-widget', hangOn && art.preview.hit ? art.preview.hit.point : null)
    const lookedNow = hangOn && !art.held ? art.lookedAt() : null
    if (lookedNow) { const a = art.library.find((x) => x.id === lookedNow.art); const pf = floorOf(level, lookedNow.level).floorY; const w = level.walls.find((x) => x.id === lookedNow.wall); if (a && w) { const [dx, dz] = [w.b[0] - w.a[0], w.b[1] - w.a[1]]; const L = Math.hypot(dx, dz) || 1; const uc = lookedNow.u + a.w / 200; anchors.set('work', new THREE.Vector3(w.a[0] + dx / L * uc, pf + lookedNow.topY + 0.08, w.a[1] + dz / L * uc), `${a.title} · ${a.w} × ${a.h} cm`) } }
    else anchors.set('work', null)
    const sz = renderer.size; anchors.publish(camera, sz.x, sz.y)
  })
  bus.toast(`level built · ${level.walls.length} walls · click to walk`)

  // ---- debug handle + shot(): renders and posts a JPEG to the dev server (docs/sheet) --------------------------------
  const shot = async (name: string): Promise<string> => {
    renderer.renderOnce()
    const url = renderer.gl.domElement.toDataURL('image/jpeg', 0.92)
    const r = await fetch(`${base}__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url })
    return r.text()
  }
  const plan = async (name: string, x0 = -0.5, z0 = -4.6, x1 = 8.0, z1 = 5.2, maxY = -2.5, ppm = 100): Promise<string> => {
    const w = Math.round((x1 - x0) * ppm), h = Math.round((z1 - z0) * ppm)
    const cam = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 0.1, 50)
    cam.position.set(0, maxY, 0); cam.up.set(0, 0, -1); cam.lookAt(0, -100, 0)
    cam.near = 0.1; cam.far = maxY + 100; cam.updateProjectionMatrix()
    const keep = renderer.size
    renderer.gl.setSize(w, h, false); renderer.gl.render(scene, cam)
    const url = renderer.gl.domElement.toDataURL('image/png')
    renderer.gl.setSize(keep.x, keep.y, false); renderer.resize()
    const r = await fetch(`${base}__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url })
    return r.text()
  }
  const view = (lvl: string, x: number, z: number, yawDeg: number, pitchDeg = 0): void => {
    walker.teleport(lvl, x, z); walker.state.yaw = THREE.MathUtils.degToRad(yawDeg); walker.state.pitch = THREE.MathUtils.degToRad(pitchDeg); walker.update(0.016)
  }
  ;(window as unknown as { koanHang: unknown }).koanHang = {
    walker, level, scene, renderer: renderer.gl, composer: renderer.composer, camera, shot, plan, view, THREE, built, toggleDoor, art, loader, bus, roomBVH,
    setMode, meshAudit: () => meshAudit(level, built.group), skyLeakAudit: () => skyLeakAudit(level, built.group, built.doors),
    quality: (q: 'full' | 'balanced' | 'low') => renderer.setQuality(q), getQuality: () => renderer.quality, smaa: renderer.smaa, looks,
  }

  const dispose = () => {
    for (const off of offs) off()
    window.removeEventListener('keydown', onKey)
    renderer.gl.domElement.removeEventListener('mousedown', onDown); renderer.gl.domElement.removeEventListener('wheel', onWheel)
    renderer.active = false; loader.dispose(); renderer.gl.dispose()
  }
  return { renderer, level, art, walker, dispose }
}
