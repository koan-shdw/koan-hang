// The clean layer: level.json types, loading, and the three.js meshes built from it (SPEC s4).
import * as THREE from 'three'

export type Facing = '+x' | '-x' | '+z' | '-z'
export type Dir = Facing
export interface Opening { kind: 'door' | 'window'; u: number; w: number; bottom: number; h: number }
export interface Wall {
  id: string; name: string; level: string
  a: [number, number]; b: [number, number]
  baseY: number; topY: number; thickness: number; facing: Facing
  openings: Opening[]; noHang: { u: number; w: number }[]
  hang?: boolean; note?: string
}
export interface FloorPoly { level: string; name?: string; poly: [number, number][] }
export interface Stair {
  id: string; level: string; to: string; from: [number, number]; dir: Dir
  width: number; run: number; bottomY: number; topY: number; treads: number; riser: number; tread: number
}
export interface Blocker { level: string; poly: [number, number][]; baseY?: number; topY?: number }
export interface Patch { level: string; name?: string; poly: [number, number][]; note?: string }
export interface LevelFloor { id: string; name: string; floorY: number; ceilY: number }
export interface Level {
  format: string
  scan: { file: string; rotationDeg: number; rotationApplied?: boolean; offset: [number, number, number] }
  eyeHeight: number
  spawn?: { level: string; x: number; z: number; yawDeg: number }
  levels: LevelFloor[]
  floors: FloorPoly[]
  walls: Wall[]
  stairs: Stair[]
  blockers: Blocker[]
  patches?: Patch[]
}

export async function loadLevel(url: string): Promise<Level> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`level.json: ${r.status} ${r.statusText}`)
  const lv = (await r.json()) as Level
  if (lv.format !== 'koan-hang-level/1') throw new Error(`level.json: unknown format ${lv.format}`)
  lv.patches ??= []
  lv.blockers ??= []
  return lv
}

export function floorOf(lv: Level, id: string): LevelFloor {
  const f = lv.levels.find((l) => l.id === id)
  if (!f) throw new Error(`no level ${id}`)
  return f
}

// ---- geometry helpers --------------------------------------------------------
export function wallLength(w: Wall): number {
  return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
}
/** unit vector a->b in plan */
export function wallDir(w: Wall): [number, number] {
  const L = wallLength(w) || 1
  return [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L]
}
/** outward normal toward the room (the side art hangs on) */
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
/** stair footprint as axis-aligned rect + progress 0..1 along it */
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

// ---- meshes -------------------------------------------------------------------
export interface CleanMeshes { solid: THREE.Group; wire: THREE.Group; patches: THREE.Group }

const WALL_MAT = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
const FLOOR_MAT = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 1, metalness: 0, side: THREE.DoubleSide })
const STAIR_MAT = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 1, metalness: 0 })
const PATCH_MAT = new THREE.MeshBasicMaterial({ color: 0x9a9691, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })

function polyShape(poly: [number, number][]): THREE.ShapeGeometry {
  // shape in (x, z) drawn on the XZ plane: build in XY then rotate
  const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ShapeGeometry(sh)
  g.rotateX(Math.PI / 2) // XY -> XZ (y = -shape.y); flip so z keeps sign
  g.scale(1, 1, -1)
  return g
}

/** wall as a set of boxes: the wall minus its openings (door/window rectangles) */
function wallBoxes(w: Wall): THREE.BufferGeometry[] {
  const L = wallLength(w), H = w.topY - w.baseY
  const [dx, dz] = wallDir(w), [nx, nz] = facingNormal(w.facing)
  const t = w.thickness
  const out: THREE.BufferGeometry[] = []
  // slice the wall in u into columns: gaps are openings; each column becomes 1..2 boxes (below/above the opening)
  const cuts = [0, L]
  for (const o of w.openings) cuts.push(Math.max(0, o.u), Math.min(L, o.u + o.w))
  cuts.sort((p, q) => p - q)
  for (let i = 0; i + 1 < cuts.length; i++) {
    const u0 = cuts[i], u1 = cuts[i + 1]
    if (u1 - u0 < 1e-4) continue
    const um = (u0 + u1) / 2
    const o = w.openings.find((op) => um > op.u && um < op.u + op.w)
    const spans: [number, number][] = o
      ? [[0, o.bottom], [o.bottom + o.h, H]].filter(([a, b]) => b - a > 1e-3) as [number, number][]
      : [[0, H]]
    for (const [y0, y1] of spans) {
      const g = new THREE.BoxGeometry(u1 - u0, y1 - y0, t)
      // place: centre along wall at um, centre in y, pushed half a thickness behind the face
      const cx = w.a[0] + dx * um - nx * (t / 2), cz = w.a[1] + dz * um - nz * (t / 2)
      // BoxGeometry local x = width axis; rotate about y so local x follows (dx,dz)
      const rot = new THREE.Matrix4().makeRotationY(Math.atan2(-dz, dx))
      rot.setPosition(cx, w.baseY + (y0 + y1) / 2, cz)
      g.applyMatrix4(rot)
      out.push(g)
    }
  }
  return out
}

export function buildCleanMeshes(lv: Level): CleanMeshes {
  const solid = new THREE.Group(), wire = new THREE.Group(), patches = new THREE.Group()
  solid.name = 'clean-solid'; wire.name = 'clean-wire'; patches.name = 'clean-patches'
  const wireMat = new THREE.LineBasicMaterial({ color: 0x00ff9f, transparent: true, opacity: 0.6 })
  for (const w of lv.walls) {
    for (const g of wallBoxes(w)) {
      const m = new THREE.Mesh(g, WALL_MAT); m.userData.wall = w.id; solid.add(m)
      wire.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), wireMat))
    }
  }
  for (const f of lv.floors) {
    const y = floorOf(lv, f.level).floorY
    const g = polyShape(f.poly); g.translate(0, y, 0)
    solid.add(new THREE.Mesh(g, FLOOR_MAT))
    wire.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), wireMat))
  }
  for (const p of lv.patches ?? []) {
    const y = floorOf(lv, p.level).floorY - 0.01
    const g = polyShape(p.poly); g.translate(0, y, 0)
    patches.add(new THREE.Mesh(g, PATCH_MAT))
  }
  for (const s of lv.stairs) {
    const r = stairRect(s), n = s.treads
    for (let i = 0; i < n; i++) {
      const p0 = i / n, p1 = (i + 1) / n
      const y0 = s.bottomY, y1 = s.bottomY + (s.topY - s.bottomY) * p1
      let g: THREE.BoxGeometry
      if (s.dir === '+z' || s.dir === '-z') {
        g = new THREE.BoxGeometry(r.x1 - r.x0, y1 - y0, s.run / n)
        const z = s.dir === '+z' ? r.z0 + s.run * (p0 + p1) / 2 : r.z1 - s.run * (p0 + p1) / 2
        g.translate((r.x0 + r.x1) / 2, (y0 + y1) / 2, z)
      } else {
        g = new THREE.BoxGeometry(s.run / n, y1 - y0, r.z1 - r.z0)
        const x = s.dir === '+x' ? r.x0 + s.run * (p0 + p1) / 2 : r.x1 - s.run * (p0 + p1) / 2
        g.translate(x, (y0 + y1) / 2, (r.z0 + r.z1) / 2)
      }
      solid.add(new THREE.Mesh(g, STAIR_MAT))
      wire.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), wireMat))
    }
  }
  return { solid, wire, patches }
}

export function setWireColor(wire: THREE.Group, css: string): void {
  wire.traverse((o) => {
    const m = (o as THREE.LineSegments).material as THREE.LineBasicMaterial | undefined
    if (m && m.isLineBasicMaterial) m.color.set(css)
  })
}
