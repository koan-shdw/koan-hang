// The level: level.json v2 types, loading, and the clean geometry built from it at runtime (SPEC v2 s4).
// Walls with openings, window grids, doors (slide / swing / metal) with runtime state, floors, ceilings,
// stairs with treads + nosings + underside, ribs, lights, aircon, slabs. No scan.
import * as THREE from 'three'

export type Facing = '+x' | '-x' | '+z' | '-z'
export type Dir = Facing
export interface DoorSpec { type: 'slide' | 'swing' | 'metal'; open: boolean; toggle: boolean; leaf: boolean; face?: 'steel' | 'glass' | 'mesh'; swingOut?: boolean }
export interface GridSpec { cols: number; bars: number[]; cross: number[] }
export interface Opening { kind: 'door' | 'window'; u: number; w: number; bottom: number; h: number; door?: DoorSpec; grid?: GridSpec; frame?: string }
export interface Wall {
  id: string; name: string; level: string
  a: [number, number]; b: [number, number]
  baseY: number; topY: number; thickness: number; facing: Facing
  openings: Opening[]; noHang: { u: number; w: number }[]
  hang?: boolean; material?: string; note?: string
}
export interface Surface { level: string; name?: string; poly: [number, number][]; material?: string }
export interface Stair {
  id: string; level: string; to: string | null; topBlocked?: number; from: [number, number]; dir: Dir
  width: number; run: number; bottomY: number; topY: number; treads: number; riser: number; tread: number; nosing?: number; material?: string
  sideWall?: { side: Facing; height: number; thickness?: number; material?: string }
}
export interface Blocker { level: string; poly: [number, number][] }
export type LevelObject =
  | { kind: 'ribs'; level: string; dir: Dir; pitch: number; depth: number; width: number }
  | { kind: 'light'; level: string; at: [number, number]; size: [number, number] }
  | { kind: 'aircon'; level: string; at: [number, number]; size: [number, number, number] }
  | { kind: 'slab'; name?: string; box: [[number, number, number], [number, number, number]]; material?: string }
export interface LevelFloor { id: string; name: string; floorY: number; ceilY: number }
export interface Level {
  format: string
  eyeHeight: number
  spawn?: { level: string; x: number; z: number; yawDeg: number }
  levels: LevelFloor[]
  floors: Surface[]
  ceilings: Surface[]
  walls: Wall[]
  stairs: Stair[]
  blockers: Blocker[]
  objects: LevelObject[]
}

export async function loadLevel(url: string): Promise<Level> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`level.json: ${r.status} ${r.statusText}`)
  const lv = (await r.json()) as Level
  if (lv.format !== 'koan-hang-level/2') throw new Error(`level.json: unknown format ${lv.format}`)
  lv.ceilings ??= []; lv.blockers ??= []; lv.objects ??= []
  for (const w of lv.walls) for (const o of w.openings) if (o.kind === 'door' && !o.door) o.door = { type: 'swing', open: true, toggle: false, leaf: false }
  return lv
}

export function floorOf(lv: Level, id: string): LevelFloor {
  const f = lv.levels.find((l) => l.id === id)
  if (!f) throw new Error(`no level ${id}`)
  return f
}

// ---- plan helpers ---------------------------------------------------------------
export function wallLength(w: Wall): number { return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) }
export function wallDir(w: Wall): [number, number] {
  const L = wallLength(w) || 1
  return [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L]
}
export function facingNormal(f: Facing): [number, number] {
  switch (f) {
    case '+x': return [1, 0]
    case '-x': return [-1, 0]
    case '+z': return [0, 1]
    case '-z': return [0, -1]
  }
}
export function pointInPoly(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
export function stairRect(s: Stair): { x0: number; x1: number; z0: number; z1: number } {
  const [fx, fz] = s.from, hw = s.width / 2
  switch (s.dir) {
    case '+z': return { x0: fx - hw, x1: fx + hw, z0: fz, z1: fz + s.run }
    case '-z': return { x0: fx - hw, x1: fx + hw, z0: fz - s.run, z1: fz }
    case '+x': return { x0: fx, x1: fx + s.run, z0: fz - hw, z1: fz + hw }
    case '-x': return { x0: fx - s.run, x1: fx, z0: fz - hw, z1: fz + hw }
  }
}
export function stairProgress(s: Stair, x: number, z: number): number {
  const [fx, fz] = s.from
  switch (s.dir) {
    case '+z': return (z - fz) / s.run
    case '-z': return (fz - z) / s.run
    case '+x': return (x - fx) / s.run
    case '-x': return (fx - x) / s.run
  }
}
export function inRect(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, pad = 0): boolean {
  return x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad
}
/** world point of a wall position u (along), y, and offset d in front of the face */
export function wallPoint(w: Wall, u: number, y: number, d = 0): THREE.Vector3 {
  const [dx, dz] = wallDir(w), [nx, nz] = facingNormal(w.facing)
  return new THREE.Vector3(w.a[0] + dx * u + nx * d, y, w.a[1] + dz * u + nz * d)
}

// ---- materials (P2: plain tints; P3 swaps these for baked textures by name) -----------
const PALETTE: Record<string, { color: number; rough?: number; metal?: number; opacity?: number; emissive?: number }> = {
  'wall-white': { color: 0xf2f2ee, rough: 0.95 },
  'wall-blue': { color: 0x8d9ab5, rough: 0.9 },
  'concrete-polished': { color: 0xb8b3a8, rough: 0.6 },
  'concrete-bare': { color: 0xa9a6a0, rough: 0.95 },
  'stone-tiles': { color: 0x9c9a94, rough: 0.95 },
  'corrugated-ceiling': { color: 0xd9d7d2, rough: 0.7, metal: 0.2 },
  'corrugated': { color: 0xc9c8c4, rough: 0.6, metal: 0.4 },
  'concrete': { color: 0xa0a0a0, rough: 0.95 },
  'render': { color: 0xb5aaa0, rough: 0.95 },
  'stair-wood': { color: 0xc49a5a, rough: 0.7 },
  'stair-nosing': { color: 0x8f9296, rough: 0.5, metal: 0.6 },
  'steel-grey': { color: 0x6e7076, rough: 0.5, metal: 0.6 },
  'steel-black': { color: 0x1c1c1e, rough: 0.5, metal: 0.5 },
  'glass': { color: 0xa8c8e8, rough: 0.1, metal: 0.1, opacity: 0.18 },
  'door-slide': { color: 0xe8e8e4, rough: 0.8 },
  'door-metal': { color: 0x8a8c8f, rough: 0.5, metal: 0.5 },
  'light': { color: 0xffffff, emissive: 0xfff2d8 },
  'aircon': { color: 0xf4f4f2, rough: 0.6, emissive: 0x3a3a38 },
  'rib': { color: 0xc8c6c0, rough: 0.6, metal: 0.3 },
}
const cache = new Map<string, THREE.MeshStandardMaterial>()
export function mat(name: string): THREE.MeshStandardMaterial {
  let m = cache.get(name)
  if (m) return m
  const p = PALETTE[name] ?? PALETTE['wall-white']
  m = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.rough ?? 0.9, metalness: p.metal ?? 0, side: THREE.DoubleSide })
  if (p.opacity !== undefined) { m.transparent = true; m.opacity = p.opacity; m.depthWrite = false }
  if (p.emissive !== undefined) { m.emissive = new THREE.Color(p.emissive); m.emissiveIntensity = 1.4 }
  cache.set(name, m)
  return m
}

// ---- geometry -------------------------------------------------------------------------
function polyShape(poly: [number, number][]): THREE.BufferGeometry {
  const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ShapeGeometry(sh)
  g.rotateX(Math.PI / 2) // (x, y) -> (x, 0, y): shape y becomes world z, no mirror
  return g
}
function bbox(poly: [number, number][]): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
  return { x0, x1, z0, z1 }
}
/** a box of size (alongWall, height, depth) placed on a wall at u (centre), y (centre), d (centre offset from the face, + = into the room) */
function wallBox(w: Wall, len: number, h: number, depth: number, u: number, y: number, d: number, material: string): THREE.Mesh {
  const [dx, dz] = wallDir(w)
  const g = new THREE.BoxGeometry(len, h, depth)
  const m = new THREE.Mesh(g, mat(material))
  m.rotation.y = Math.atan2(-dz, dx)
  const p = wallPoint(w, u, y, d); m.position.copy(p)
  return m
}

export interface DoorRuntime {
  id: string; wall: Wall; opening: Opening; open: boolean; t: number // t: 0 closed .. 1 open
  pivot: THREE.Object3D; type: DoorSpec['type']; slideDir: 1 | -1
}

export interface Built { group: THREE.Group; wire: THREE.Group; doors: DoorRuntime[]; lights: THREE.PointLight[] }

export function buildLevel(lv: Level): Built {
  const group = new THREE.Group(); group.name = 'level'
  const wire = new THREE.Group(); wire.name = 'level-wire'
  const wireMat = new THREE.LineBasicMaterial({ color: 0x00ff9f, transparent: true, opacity: 0.6 })
  const doors: DoorRuntime[] = []
  const lights: THREE.PointLight[] = []
  const addWire = (g: THREE.BufferGeometry, m: THREE.Mesh) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), wireMat); l.position.copy(m.position); l.rotation.copy(m.rotation); wire.add(l) }

  // walls: columns between openings, boxes below/above each opening
  for (const w of lv.walls) {
    const L = wallLength(w), H = w.topY - w.baseY, t = w.thickness
    const material = w.material ?? 'wall-white'
    const cuts = [0, L]
    for (const o of w.openings) cuts.push(Math.max(0, o.u), Math.min(L, o.u + o.w))
    cuts.sort((p, q) => p - q)
    for (let i = 0; i + 1 < cuts.length; i++) {
      const u0 = cuts[i], u1 = cuts[i + 1]
      if (u1 - u0 < 1e-4) continue
      const um = (u0 + u1) / 2
      const o = w.openings.find((op) => um > op.u && um < op.u + op.w)
      const spans: [number, number][] = o
        ? ([[0, o.bottom], [o.bottom + o.h, H]] as [number, number][]).filter(([a, b]) => b - a > 1e-3)
        : [[0, H]]
      for (const [y0, y1] of spans) {
        const m = wallBox(w, u1 - u0, y1 - y0, t, um, w.baseY + (y0 + y1) / 2, -t / 2, material)
        m.userData.wall = w.id; group.add(m); addWire(m.geometry, m)
      }
    }
    // openings: window grids, door frames + leaves
    for (const o of w.openings) {
      const uc = o.u + o.w / 2, yc = w.baseY + o.bottom + o.h / 2
      if (o.kind === 'window') {
        const frame = o.frame ?? 'steel-grey', bar = 0.05, deep = 0.08
        // outer frame
        group.add(wallBox(w, o.w, bar, deep, uc, w.baseY + o.bottom + bar / 2, -t / 2, frame))
        group.add(wallBox(w, o.w, bar, deep, uc, w.baseY + o.bottom + o.h - bar / 2, -t / 2, frame))
        group.add(wallBox(w, bar, o.h, deep, o.u + bar / 2, yc, -t / 2, frame))
        group.add(wallBox(w, bar, o.h, deep, o.u + o.w - bar / 2, yc, -t / 2, frame))
        const g = o.grid ?? { cols: 1, bars: [], cross: [] }
        for (let c = 1; c < g.cols; c++) group.add(wallBox(w, bar, o.h, deep, o.u + (o.w * c) / g.cols, yc, -t / 2, frame))
        for (const hb of g.bars) if (hb > o.bottom && hb < o.bottom + o.h) group.add(wallBox(w, o.w, bar, deep, uc, w.baseY + hb, -t / 2, frame))
        // cross bars: an X in the listed columns, from the first bar (or bottom) to the top
        const cw = o.w / g.cols
        const lowest = g.bars.length ? Math.max(o.bottom, Math.min(...g.bars.filter((b) => b > o.bottom))) : o.bottom
        for (const c of g.cross) {
          const cu = o.u + cw * (c + 0.5), h = o.bottom + o.h - lowest, yy = w.baseY + lowest + h / 2
          const len = Math.hypot(cw, h), ang = Math.atan2(h, cw)
          for (const sgn of [1, -1]) {
            const m = wallBox(w, len, 0.03, 0.03, cu, yy, -t / 2 + 0.06, frame)
            m.rotateZ(sgn * ang); group.add(m)
          }
        }
        // glass
        group.add(wallBox(w, o.w - bar, o.h - bar, 0.01, uc, yc, -t / 2, 'glass'))
      } else if (o.door) {
        const frame = o.door.type === 'metal' ? 'steel-grey' : w.material === 'wall-blue' || w.level === 'ground' ? 'steel-grey' : 'steel-black'
        const jamb = 0.05
        group.add(wallBox(w, jamb, o.h, t + 0.04, o.u + jamb / 2, yc, -t / 2, frame))
        group.add(wallBox(w, jamb, o.h, t + 0.04, o.u + o.w - jamb / 2, yc, -t / 2, frame))
        group.add(wallBox(w, o.w, jamb, t + 0.04, uc, w.baseY + o.bottom + o.h - jamb / 2, -t / 2, frame))
        if (o.door.leaf) {
          const pivot = new THREE.Object3D()
          const leafW = o.w - jamb * 2, leafH = o.h - jamb
          let leaf: THREE.Mesh
          if (o.door.type === 'slide') {
            // leaf sits just in front of the wall face and slides along it, away from the nearer wall end
            leaf = wallBox(w, leafW, leafH, 0.04, uc, w.baseY + o.bottom + leafH / 2, 0.05, 'door-slide')
            pivot.add(leaf)
          } else if (o.door.type === 'swing') {
            // hinge at the u side; leaf rotates about the hinge into the room (glass door: frame + glass)
            const hinge = wallPoint(w, o.u + jamb, w.baseY + o.bottom, 0)
            pivot.position.copy(hinge)
            const [dx, dz] = wallDir(w)
            pivot.rotation.y = Math.atan2(-dz, dx)
            if (o.door.face === 'glass') {
              const fr = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.04), mat('steel-grey')); fr.position.set(leafW / 2, leafH / 2, 0)
              const gl = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.16, leafH - 0.16, 0.01), mat('glass')); gl.position.set(leafW / 2, leafH / 2, 0)
              pivot.add(fr, gl); leaf = fr
            } else {
              leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.05), mat('door-metal')); leaf.position.set(leafW / 2, leafH / 2, 0)
              const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10), mat('steel-grey')); handle.rotation.z = Math.PI / 2; handle.position.set(leafW - 0.1, 1.0, 0.05)
              pivot.add(leaf, handle)
            }
          } else {
            leaf = wallBox(w, leafW, leafH, 0.05, uc, w.baseY + o.bottom + leafH / 2, -t / 2, 'door-metal')
            pivot.add(leaf)
            if (o.door.face === 'mesh') pivot.add(wallBox(w, 0.18, leafH * 0.55, 0.06, uc, w.baseY + o.bottom + leafH * 0.55, -t / 2, 'steel-black')) // mesh window strip
          }
          group.add(pivot)
          const slideDir: 1 | -1 = o.u + o.w / 2 < L / 2 ? 1 : -1
          doors.push({ id: `${w.id}:${o.u.toFixed(2)}`, wall: w, opening: o, open: o.door.open, t: o.door.open ? 1 : 0, pivot, type: o.door.type, slideDir })
        }
      }
    }
  }
  // floors + ceilings
  for (const f of lv.floors) {
    const g = polyShape(f.poly); g.translate(0, floorOf(lv, f.level).floorY, 0)
    const m = new THREE.Mesh(g, mat(f.material ?? 'concrete-bare')); group.add(m); addWire(g, m)
  }
  for (const c of lv.ceilings) {
    const g = polyShape(c.poly); g.translate(0, floorOf(lv, c.level).ceilY, 0)
    group.add(new THREE.Mesh(g, mat(c.material ?? 'corrugated-ceiling')))
  }
  // stairs: treads with nosing, risers, a sloped underside slab
  for (const s of lv.stairs) {
    const r = stairRect(s), n = s.treads, rise = s.topY - s.bottomY, along = s.dir === '+z' || s.dir === '-z'
    const stepRun = s.run / (n + 1), riser = rise / (n + 1), nos = s.nosing ?? 0.02
    const width = along ? r.x1 - r.x0 : r.z1 - r.z0
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2
    const sgn = s.dir === '+z' || s.dir === '+x' ? 1 : -1
    const start = along ? (sgn > 0 ? r.z0 : r.z1) : (sgn > 0 ? r.x0 : r.x1)
    for (let i = 0; i < n; i++) {
      const topY = s.bottomY + riser * (i + 1)
      const a0 = start + sgn * stepRun * i, a1 = start + sgn * stepRun * (i + 1)
      const tread = new THREE.BoxGeometry(along ? width : stepRun + nos, 0.05, along ? stepRun + nos : width)
      const nosing = new THREE.BoxGeometry(along ? width : 0.06, 0.02, along ? 0.06 : width)
      const rz = new THREE.BoxGeometry(along ? width : 0.03, riser, along ? 0.03 : riser)
      const mid = (a0 + a1) / 2 - sgn * nos / 2
      const tm = new THREE.Mesh(tread, mat(s.material ?? 'stair-wood'))
      const nm = new THREE.Mesh(nosing, mat('stair-nosing'))
      const rm = new THREE.Mesh(rz, mat(s.material ?? 'stair-wood'))
      if (along) { tm.position.set(cx, topY - 0.025, mid); nm.position.set(cx, topY + 0.005, a1 + sgn * nos - sgn * 0.03); rm.position.set(cx, topY - riser / 2, a0) }
      else { tm.position.set(mid, topY - 0.025, cz); nm.position.set(a1 + sgn * nos - sgn * 0.03, topY + 0.005, cz); rm.position.set(a0, topY - riser / 2, cz) }
      group.add(tm, nm, rm)
    }
    // underside slab
    const len = Math.hypot(s.run, rise), ang = Math.atan2(rise, s.run)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(along ? width : len, 0.3, along ? len : width), mat('concrete'))
    slab.position.set(cx, s.bottomY + rise / 2 - 0.15, cz) // top face on the tread line: the steps sit in it, no gaps
    if (along) slab.rotation.x = -sgn * ang; else slab.rotation.z = sgn * ang
    group.add(slab)
    // side wall (stringer wall): a sloped slab standing on the flight's edge, its top a set height above the tread line
    if (s.sideWall) {
      const sw = s.sideWall, th = sw.thickness ?? 0.15
      const wallH = sw.height + 0.3
      const wm = new THREE.Mesh(new THREE.BoxGeometry(along ? th : len, wallH, along ? len : th), mat(sw.material ?? 'wall-blue'))
      // stands just outside the flight's edge, its top a set height above the tread line
      const off = { '+x': [r.x1 + th / 2, cz], '-x': [r.x0 - th / 2, cz], '+z': [cx, r.z1 + th / 2], '-z': [cx, r.z0 - th / 2] }[sw.side]
      wm.position.set(off[0], s.bottomY + rise / 2 + wallH / 2 - 0.3, off[1])
      if (along) wm.rotation.x = -sgn * ang; else wm.rotation.z = sgn * ang
      group.add(wm)
    }
  }
  // objects
  for (const o of lv.objects) {
    if (o.kind === 'ribs') {
      const cy = floorOf(lv, o.level).ceilY
      for (const c of lv.ceilings) {
        if (c.level !== o.level) continue
        const b = bbox(c.poly), alongX = o.dir === '+x' || o.dir === '-x'
        const span = alongX ? b.z1 - b.z0 : b.x1 - b.x0
        const count = Math.floor(span / o.pitch)
        const g = new THREE.BoxGeometry(alongX ? b.x1 - b.x0 : o.width, o.depth, alongX ? o.width : b.z1 - b.z0)
        const im = new THREE.InstancedMesh(g, mat('rib'), count)
        const M = new THREE.Matrix4()
        for (let i = 0; i < count; i++) {
          const p = (i + 0.5) * o.pitch
          M.makeTranslation(alongX ? (b.x0 + b.x1) / 2 : b.x0 + p, cy - o.depth / 2, alongX ? b.z0 + p : (b.z0 + b.z1) / 2)
          im.setMatrixAt(i, M)
        }
        group.add(im)
      }
    } else if (o.kind === 'light') {
      const cy = floorOf(lv, o.level).ceilY
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.size[0], 0.06, o.size[1]), mat('light'))
      m.position.set(o.at[0], cy - 0.09, o.at[1]); group.add(m)
      const pl = new THREE.PointLight(0xfff0d0, 14, 9, 2); pl.position.set(o.at[0], cy - 0.25, o.at[1]); group.add(pl); lights.push(pl)
    } else if (o.kind === 'aircon') {
      const cy = floorOf(lv, o.level).ceilY
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.size[0], o.size[1], o.size[2]), mat('aircon'))
      m.position.set(o.at[0], cy - o.size[1] / 2, o.at[1]); group.add(m)
    } else if (o.kind === 'slab') {
      const [p0, p1] = o.box
      const m = new THREE.Mesh(new THREE.BoxGeometry(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), mat(o.material ?? 'concrete'))
      m.position.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); group.add(m)
    }
  }
  return { group, wire, doors, lights }
}

/** animate door leaves toward their open state; slide = translate along the wall, swing = rotate about the hinge */
export function updateDoors(doors: DoorRuntime[], dt: number): void {
  for (const d of doors) {
    const target = d.open ? 1 : 0
    if (Math.abs(d.t - target) < 1e-3) { d.t = target } else d.t += Math.sign(target - d.t) * Math.min(Math.abs(target - d.t), dt / 0.6)
    const ease = d.t * d.t * (3 - 2 * d.t)
    if (d.type === 'slide') {
      const [dx, dz] = wallDir(d.wall)
      const s = d.slideDir * (d.opening.w - 0.06) * ease
      d.pivot.position.set(dx * s, 0, dz * s)
    } else if (d.type === 'swing') {
      const [dx, dz] = wallDir(d.wall), [nx, nz] = facingNormal(d.wall.facing)
      const base = Math.atan2(-dz, dx)
      // rotating the leaf by +90 deg about y sends its free end along (dz, -dx); pick the sign that points into the room, or out
      const dot = dz * nx - dx * nz
      const sign = (d.opening.door?.swingOut ? -1 : 1) * (dot > 0 ? 1 : -1)
      d.pivot.rotation.y = base + sign * (Math.PI / 2) * ease
    }
  }
}

export function doorCentre(d: DoorRuntime): THREE.Vector3 {
  return wallPoint(d.wall, d.opening.u + d.opening.w / 2, d.wall.baseY + 1, 0)
}

export function setWireColor(wire: THREE.Group, css: string): void {
  wire.traverse((o) => {
    const m = (o as THREE.LineSegments).material as THREE.LineBasicMaterial | undefined
    if (m && m.isLineBasicMaterial) m.color.set(css)
  })
}
