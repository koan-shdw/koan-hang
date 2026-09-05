// bitmap worker (REMAKE.md §3): an image URL or data URL → ImageBitmap, decoded off the main thread, transferred back.
// The main thread only uploads. Messenger's bitmapworker, ours.
export interface BitmapJob { id: number; src: string }
export interface BitmapDone { id: number; bitmap?: ImageBitmap; error?: string }

self.onmessage = async (e: MessageEvent<BitmapJob>) => {
  const { id, src } = e.data
  try {
    const r = await fetch(src)
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    const blob = await r.blob()
    // flipY here so the texture needs no flip on upload (three cannot flip an ImageBitmap on the GPU path)
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    const msg: BitmapDone = { id, bitmap }
    ;(self as unknown as Worker).postMessage(msg, [bitmap])
  } catch (err) {
    const msg: BitmapDone = { id, error: (err as Error).message }
    ;(self as unknown as Worker).postMessage(msg)
  }
}
