// The loader (REMAKE.md §3): fetch → worker decode → GPU upload. Every asset goes through it.
// One queue, priorities (room first, then art, then sky, then yard), a `loader` event for the HUD bar.
// KTX2 through three's KTX2Loader (its own worker pool + basis wasm), images through bitmap.worker.ts, meshes through Draco.
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { bus } from '../bus'
import type { BitmapDone, BitmapJob } from './workers/bitmap.worker'

export type Priority = 'room' | 'art' | 'sky' | 'yard'
const ORDER: Record<Priority, number> = { room: 0, art: 1, sky: 2, yard: 3 }

interface Job { prio: number; seq: number; run: () => Promise<void> }

export class Loader {
  readonly ktx2: KTX2Loader
  readonly draco: DRACOLoader
  private workers: Worker[] = []
  private idle: Worker[] = []
  private pendingBitmaps = new Map<number, { res: (b: ImageBitmap) => void; rej: (e: Error) => void }>()
  private bitmapSeq = 0
  private queue: Job[] = []
  private running = 0
  private seq = 0
  private done = 0; private total = 0
  private text = ''
  static LANES = 4

  constructor(readonly base: string, renderer: THREE.WebGLRenderer) {
    this.ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer)
    this.draco = new DRACOLoader().setDecoderPath(`${base}draco/`)
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) >> 1))
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./workers/bitmap.worker.ts', import.meta.url), { type: 'module', name: `bitmap-${i}` })
      w.onmessage = (e: MessageEvent<BitmapDone>) => {
        const p = this.pendingBitmaps.get(e.data.id); this.pendingBitmaps.delete(e.data.id)
        this.idle.push(w)
        if (!p) return
        if (e.data.bitmap) p.res(e.data.bitmap); else p.rej(new Error(e.data.error ?? 'decode failed'))
      }
      this.workers.push(w); this.idle.push(w)
    }
  }

  /** the queue: `prio` orders, LANES run at once, the HUD bar follows */
  private enqueue<T>(prio: Priority, text: string, fn: () => Promise<T>): Promise<T> {
    this.total++
    return new Promise<T>((res, rej) => {
      this.queue.push({ prio: ORDER[prio], seq: this.seq++, run: async () => { this.text = text; this.report(); try { res(await fn()) } catch (e) { rej(e as Error) } } })
      this.queue.sort((a, b) => a.prio - b.prio || a.seq - b.seq)
      this.pump()
    })
  }
  private pump(): void {
    while (this.running < Loader.LANES && this.queue.length) {
      const j = this.queue.shift()!; this.running++
      void j.run().finally(() => { this.running--; this.done++; this.report(); this.pump() })
    }
  }
  private report(): void {
    const active = this.running > 0 || this.queue.length > 0
    bus.emit('loader', { active, done: this.done, total: this.total, text: active ? this.text : '' })
    if (!active) { this.done = 0; this.total = 0 }
  }

  /** a KTX2 texture, GPU-compressed, mips baked in. `srgb` for colour maps */
  texture(url: string, prio: Priority, opts: { srgb?: boolean; repeat?: boolean; anisotropy?: number } = {}): Promise<THREE.CompressedTexture> {
    return this.enqueue(prio, url.split('/').pop() ?? url, () => new Promise<THREE.CompressedTexture>((res, rej) => {
      this.ktx2.load(url, (t) => {
        if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
        if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
        if (opts.anisotropy) t.anisotropy = opts.anisotropy
        t.needsUpdate = true; res(t)
      }, undefined, (e) => rej(e instanceof Error ? e : new Error(`ktx2 failed: ${url}`)))
    }))
  }

  /** any browser image (jpg, png, data URL) decoded in a worker → a Texture ready to upload. flipY already done in the worker */
  image(src: string, prio: Priority, opts: { srgb?: boolean; repeat?: boolean; anisotropy?: number } = {}): Promise<THREE.Texture> {
    const label = src.startsWith('data:') ? 'image' : (src.split('/').pop() ?? src)
    return this.enqueue(prio, label, async () => {
      const bmp = await this.bitmap(src)
      const t = new THREE.Texture(bmp)
      t.flipY = false
      if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
      if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
      if (opts.anisotropy) t.anisotropy = opts.anisotropy
      t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter
      t.needsUpdate = true
      return t
    })
  }

  private bitmap(src: string): Promise<ImageBitmap> {
    return new Promise((res, rej) => {
      const id = this.bitmapSeq++
      this.pendingBitmaps.set(id, { res, rej })
      const send = () => {
        const w = this.idle.pop()
        if (!w) { setTimeout(send, 8); return }
        const job: BitmapJob = { id, src }; w.postMessage(job)
      }
      send()
    })
  }

  dispose(): void { for (const w of this.workers) w.terminate(); this.ktx2.dispose(); this.draco.dispose() }
}
