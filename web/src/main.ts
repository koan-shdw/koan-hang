// KOAN.hang — the site's entry: mount the room into #app through the embed API. Nothing else lives here (REMAKE.md §2).
import { start } from './embed'

const h = start({ cnt: document.getElementById('app')! })
h.ready.then((w) => { if (!w) console.error('KOAN.hang: the world did not start') }).catch((e) => { console.error(e); alert(`KOAN.hang failed: ${(e as Error).message}`) })
