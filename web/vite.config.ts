import { defineConfig, type Plugin } from 'vite'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, createReadStream } from 'node:fs'
import { join, resolve, extname } from 'node:path'

// The repo's data folders (level/, art/, layouts/) are served under /data/ in dev
// and copied into dist/data/ at build. scan.clean.glb (the 12 MB compress input) is skipped.
const ROOT = resolve(__dirname, '..')
const DATA_DIRS = ['level', 'art', 'layouts']
const SKIP = new Set(['scan.clean.glb', 'make_level.py'])
const MIME: Record<string, string> = { '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

function copyDir(src: string, dst: string): void {
  if (!existsSync(src)) return
  mkdirSync(dst, { recursive: true })
  for (const f of readdirSync(src)) {
    if (SKIP.has(f)) continue
    const s = join(src, f), d = join(dst, f)
    if (statSync(s).isDirectory()) copyDir(s, d)
    else copyFileSync(s, d)
  }
}

function dataDirs(): Plugin {
  let outDir = 'dist'
  return {
    name: 'koan-data-dirs',
    configResolved(c) { outDir = c.build.outDir },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const m = url.match(/^\/data\/([a-z]+)\/(.+)$/)
        if (!m || !DATA_DIRS.includes(m[1]) || m[2].includes('..')) return next()
        const file = join(ROOT, m[1], decodeURIComponent(m[2]))
        if (!existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; res.end('not found'); return }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
        res.setHeader('Content-Length', String(statSync(file).size))
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      for (const d of DATA_DIRS) copyDir(join(ROOT, d), join(resolve(__dirname, outDir), 'data', d))
    },
  }
}

export default defineConfig({
  // served at koan-shdw.github.io/koan-hang/ in production (CI is set on Actions)
  base: process.env.CI ? '/koan-hang/' : '/',
  server: { port: 5374, strictPort: true },
  plugins: [dataDirs()],
})
