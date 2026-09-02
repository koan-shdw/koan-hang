# KOAN.hang — SPEC v1 (2026-09-02)

Working name **KOAN.hang** (name OPEN, user decides). Repo `C:\Claude\gallery-hang`.
Status: P0 pipeline BUILT and run 2026-09-02 (`level/scan.glb` 2.3 MB, `level/level.draft.json`). No app code. See `docs/SCAN-REPORT.md`.

The brief (user, 2026-09-02): a 3D game-style walk through his LiDAR scan of the gallery.
An inventory of his artworks at true size. Place a work on a wall, walk round, look at it.
An in-game widget sets the top-height snap. Clean the scan up. Browser app. GitHub hosts
the site and the data. Save, load, some exports.

Every claim below is marked **PROVEN** (I ran it) or **OPEN** (untested, or his call).

---

## 1. What it is

Three layers, one screen:

| layer | what | who makes it |
|---|---|---|
| **scan** | his Polycam mesh, cleaned, compressed. Looks like the real place. | `scan/pipeline.py` |
| **clean** | exact flat walls, floors, stairs, openings. Art snaps to these. Walk collides with these. Invisible by default, or shown as a white-box gallery. | pipeline auto-detect + hand-fix in the app |
| **art** | canvases at true cm size, on the clean walls | him, in the app |

Two files drive it: `level.json` (clean layer) and `layouts/<name>.json` (which art where).

---

## 2. Stack and hosting

- **Vite + TypeScript + three.js**, one page, no framework. Same shape as `koan-ansi/web`
  (PROVEN pattern: Pages workflow `.github/workflows/pages.yml`, `base` switch on `CI`).
- **GitHub Pages** on a new public repo `koan-shdw/koan-hang` (name OPEN). Auto-deploys on push.
- **@koan/shared** inclusions proposed (user decides every one, per koan-shared law):
  `styles/koan.css`, `renderer/tokens.ts`, `Dropdown.tsx`, `ContextMenu.tsx`, `confirm.tsx`.
  Not the LoRA shelf, not the bridge. OPEN: koan-shared is `file:../koan-shared`; on GitHub
  CI it must resolve. Either vendor the five files into `web/vendor/koan/` with `drift.mjs`
  watching, or publish koan-shared. Recommend vendor + drift for now.
- **Themes**: the KOAN var contract, DECK default, WINTERMUTE and FUCKUP shipped (same as koan-ansi web).
- **Scan pipeline**: Python 3.12, `trimesh` + `numpy` + `scipy` + `pillow` (PROVEN installed
  and run today), `@gltf-transform/cli` 4.5.0 for Draco + texture resize (PROVEN present via npx).
  Runs on his PC, outputs are committed. Never runs in the browser.

Public repo means the art images are public on the web. OPEN: fine, or private repo
(GitHub Pages on private needs a paid plan).

Repo layout:

```
gallery-hang/
  docs/SPEC.md  docs/SCAN-REPORT.md
  scan/raw/9_2_2026.glb          the Polycam export, untouched
  scan/pipeline.py               raw → cleaned scan.glb + level.json (draft)
  scan/*.py                      the report scripts
  level/level.json               clean layer (hand-fixed in app, committed)
  level/scan.clean.glb           cleaned, full res (12.8 MB, input to compress.ps1)
  level/scan.glb                 cleaned, Draco, 2048 textures (2.3 MB, PROVEN)
  art/index.json                 the inventory
  art/<id>.jpg|png|webp          the images
  layouts/<name>.json            saved hangs
  web/                           the app (Vite)
  .github/workflows/pages.yml
```

---

## 3. Scan pipeline (`scan/pipeline.py`)

Input: `scan/raw/*.glb`. Output: `level/scan.glb`, `level/level.draft.json`, `scan/report.md`.
Steps, in order:

1. **Load**, merge 8 chunks, keep per-chunk textures. PROVEN.
2. **De-rotate** 1.79° so walls align with x/z. Angle measured from the wall-normal histogram.
   PROVEN (`planes.py` found the four room walls axis-aligned after this).
3. **Cut junk**: drop connected pieces under 200 triangles (3,661 pieces, 59 m²), drop faces
   whose texture is near-black (21 m²), drop everything outside a hand-set keep box
   (default: the building box, courtyard included). PROVEN 2026-09-02: 76,015 + 9,216 faces cut, room walls clean (`scan/clean_walls.png`).
4. **Fill holes** smaller than 0.3 m across (the first-floor floor hole). trimesh
   `fill_holes` only closes triangle-sized gaps; bigger holes get a flat patch from the clean
   layer (the clean floor plane shows through). OPEN.
5. **Planes**: horizontal planes → floors and ceilings; vertical planes with |normal| on x or z
   → walls. Bin by position, keep planes over 1 m². PROVEN: found 3 levels and the 5 room
   walls plus 5 courtyard walls with correct positions (SCAN-REPORT tables).
6. **Wall extent**: for each wall plane, raster its faces onto a 5 cm grid on the plane.
   The filled rectangle = the wall. Empty rectangles inside it larger than 60 × 60 cm =
   openings. Opening from floor to under 2.3 m = door; opening off the floor = window. OPEN.
7. **Stairs**: in the stair zone (x −7.1 … −5.9), horizontal strips at regular y steps →
   treads; write them as steps (tread depth, riser height, count). OPEN.
8. **Write `level.draft.json`** in the format of §4. He hand-fixes in the app, saves
   `level/level.json`.
9. **Compress**: decimate to ~150k triangles, textures to 2048², Draco, write `level/scan.glb`.
   gltf-transform commands: `resize --width 2048 --height 2048`, `draco`, `dedup`, `prune`.
   PROVEN 2026-09-02: 2.3 MB, 137k triangles, 4 textures at 2048 (`scan/compress.ps1`).

The pipeline is rerunnable. Rerun never overwrites `level/level.json`, only the draft.

---

## 4. `level.json` — the clean layer

Units: metres in the file, cm in the UI. Y up. Origin = de-rotated scan origin.

```json
{
  "format": "koan-hang-level/1",
  "scan": { "file": "scan.glb", "rotationDeg": -1.79, "offset": [0,0,0] },
  "eyeHeight": 1.60,
  "levels": [
    { "id": "ground", "name": "ground", "floorY": -5.50, "ceilY": -2.42 },
    { "id": "first",  "name": "first",  "floorY": -2.22, "ceilY": 0.84 }
  ],
  "floors": [ { "level": "ground", "poly": [[x,z],...] } ],
  "walls": [
    { "id": "w-north", "name": "north", "level": "both",
      "a": [-7.33, 2.72], "b": [0.21, 2.72], "baseY": -5.50, "topY": 0.84,
      "thickness": 0.15, "facing": "-z",
      "openings": [ { "kind": "door", "u": 1.20, "w": 0.90, "bottom": 0, "h": 2.10 } ],
      "noHang": [ { "u": 0, "w": 0.40 } ] }
  ],
  "stairs": [ { "level": "ground", "from": [x,z], "dir": "+z", "width": 1.0,
                "treads": 18, "tread": 0.27, "riser": 0.182, "bottomY": -5.50 } ],
  "blockers": [ { "poly": [[x,z],...], "baseY": 0, "topY": 0 } ]
}
```

- A wall is a segment `a→b` in plan plus a height range. `facing` = the side art hangs on.
  A double-sided wall is two entries.
- `u` = distance in metres from `a` along the wall. `openings` block hanging and are holes
  for collision (doors) or just holes for hanging (windows).
- `noHang` = keep-out strips (corners, light switches, the stair edge).
- `blockers` = furniture-sized boxes the walker cannot pass (the desk, the stair void).

---

## 5. The app

### 5.1 Shell

Full-screen 3D viewport. Cards float over it, KOAN.live NODE-shell style in floating mode
(canon shell 3, ch. 08): each card has a title bar, drag to move, fold, position remembered.
Cards: **INVENTORY**, **HANG**, **LEVEL**, **FILE**. One top strip: logo, mode chips
(`walk` · `hang` · `level`), theme, `?`. OPEN: shell choice is his call.

### 5.2 Walk (mode `walk`)

- Pointer-lock first person. WASD move, mouse look, Shift run.
  Eye height 160 cm (`eyeHeight`, editable in LEVEL card).
- Collision against the clean layer only: walls, blockers, floors, stairs. Never the scan mesh.
  Capsule radius 25 cm. Stairs = walkable ramp with step snapping.
- Gravity: stand on the level's floor. Walk up the stair, arrive on the first floor.
- `M` = plan view: top-down map of the current level, walls drawn, art as rectangles, click
  = teleport. Minimap corner, 120 px, always on (law 1: you always know where you are).
- Esc leaves pointer lock (law: Esc backs out one layer).

### 5.3 Render

- Scan layer: unlit, textures as baked. Draco decoded in a worker.
- Clean layer: three looks, chip in LEVEL card: `hidden` (default; scan shows, clean only
  snaps and collides), `white box` (scan hidden, matte white walls, grey floor), `both`
  (clean layer as 1 px wireframe over the scan, for fixing).
- Art: box mesh at true size, image on the front (sRGB, mipmapped, anisotropy 8), edge
  finish per §5.4. Lit: hemisphere + one soft directional. Art casts a soft contact shadow
  on the wall (a baked gradient quad behind it, no shadow maps).
- Highest quality is the default (product law). Quality chip `full` · `light` only if a phone
  cannot hold 60 fps. `light` = scan at half texture res. OPEN whether needed at all.

### 5.4 Inventory (INVENTORY card)

Source: `art/index.json`.

```json
{ "format": "koan-hang-art/1",
  "items": [ { "id": "tengu-01", "title": "Tengu", "file": "tengu-01.jpg",
               "w": 120, "h": 90, "d": 3.8, "edge": "wrap",
               "year": 2025, "medium": "acrylic on canvas", "notes": "" } ] }
```

Sizes in cm: `w` width, `h` height, `d` canvas depth (the edge). `edge`: `wrap` (image
stretched over the edge, gallery-wrap), `white`, or a hex colour. Default `wrap`. OPEN.

Card: search field, grid of thumbnails with title and `120 × 90` under each. Sort: title,
size, recent. Placed works show a small `on wall` chip; unplaced float (law 9 amendment,
FloatPick behaviour when the room is empty). Drag a thumbnail into the viewport, or click it
= it becomes the held work.

Adding art: drop image files on the card. A row opens under the thumbnail: title, w, h, d,
edge. Enter commits. This writes `art/index.json` and the image via the save path (§7).
Without a token it downloads a zip with the new files and the updated index for him to drop
into the repo (law 10: the card says exactly that).

### 5.5 Hang (mode `hang`)

- Held work follows the cursor. Raycast against clean walls only. On a wall it shows at true
  size, ghosted 60%, snapped. Over an opening or a `noHang` strip: red tint, click does nothing,
  tooltip says why (law 7).
- Click = place. Placed work = selected. Drag = slide along the wall. Snaps apply live.
- Arrow keys nudge 1 cm, Shift+arrows 10 cm, `[` `]` move to the previous/next wall,
  `Delete` removes, `Ctrl+D` duplicates, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo (law 15).
- Right-click on a placed work: `remove` · `duplicate` · `flip to facing wall` · `centre on
  wall` · `swap with…` · `open in inventory` (law 14).
- Right-click on a wall: `centre all on this wall` · `space evenly` · `clear wall`.
- Every placement writes the layout (autosave, law 12).

### 5.6 The HANG widget (his ask: top-height snap)

The card, top to bottom:

| row | control |
|---|---|
| snap line | three chips `top` · `centre` · `bottom`, one active |
| height | number field in cm + slider 0 … ceiling, readout paired (ch. 03 slider rule). Default: top 200, centre 150, bottom 100 |
| apply | `snap all on wall` · `snap all` buttons |
| gap | number field cm, default 10; `space evenly` uses it |
| show guide | toggle, on by default |

- The active snap line is drawn on every wall at that height, dashed, accent colour, in `hang`
  mode (law 1). Held and dragged works snap their top / centre / bottom to it.
- Change the height: the line moves; works already snapped to it move with it (they carry
  `snap: "top"`). Works placed free carry `snap: null` and stay put.
- Gap snap: while sliding, a work snaps its edge to `gap` cm from a neighbour on the same
  wall, and to the wall's centre. Ghost tick marks show where it will land.
- Wall-height display: the wall's clear height in cm sits on the widget when a wall is under
  the cursor.

### 5.7 Level fix (mode `level`)

For the parts auto-detection gets wrong. Clean layer draws as wireframe over the scan.

- Click a wall = select. Handles at `a` and `b` drag along the plan. Fields: base, top,
  thickness, facing. `Delete` removes. `＋ wall` = click two points on the floor.
- On a selected wall: `＋ opening` = drag a rectangle on the wall face. Fields: kind
  (`door` / `window`), u, w, bottom, h. `＋ no-hang` = drag a strip.
- `＋ blocker` = drag a box on the floor, set height.
- Stairs: fields only (from, dir, width, treads, tread, riser). OPEN if a drag handle is needed.
- Floor hole: `＋ patch` = drag a rectangle on the floor plane. Written as a floor poly; the
  render draws it in the floor's average colour.
- Saves `level/level.json` via the save path. Undo/redo.

---

## 6. `layouts/<name>.json`

```json
{ "format": "koan-hang-layout/1", "name": "sept show", "level": "level.json",
  "guides": { "snap": "top", "top": 200, "centre": 150, "bottom": 100, "gap": 10 },
  "items": [ { "art": "tengu-01", "wall": "w-north", "u": 1.42, "topY": 2.00,
               "snap": "top", "flip": false } ],
  "camera": { "level": "first", "pos": [x,y,z], "yaw": 0, "pitch": 0 } }
```

`u` = metres from wall start to the work's left edge. `topY` = metres above that level's floor.

---

## 7. Save / load

Three paths. The FILE card shows which one is live (law 1).

| path | who | how |
|---|---|---|
| **browser** | always | autosave to localStorage on every change. Survives reload. Shown as `draft`. |
| **file** | anyone | `save file` downloads `<name>.json`. Drop a `.json` on the viewport or FILE card = load. |
| **github** | him | paste a fine-grained token (contents: write, this repo only) once, stored in localStorage. `save to repo` commits `layouts/<name>.json` (or `level/level.json`, `art/*`) through the GitHub contents API. The commit message is the action. Pages redeploys in ~1 min. |

Load: FILE card lists `layouts/*.json` from the repo (fetched from the site itself) plus the
local draft. `?layout=<name>` in the URL opens one. That is the share link.

Conflicts: the repo copy is truth. Loading a repo layout replaces the draft after a confirm
with counts ("replace draft, 14 works — undoable").

---

## 8. Exports (FILE card)

| export | what |
|---|---|
| **screenshot** | PNG of the viewport, UI hidden, 2× pixel ratio. `P` key. |
| **hang list** | CSV + printable HTML: work, wall, level, left edge cm, top cm, centre cm, size. For the real install day. |
| **room GLB** | scan layer + art boxes, three.js GLTFExporter. Opens in any viewer. |
| **plan PNG** | top-down plan per level, walls and art rectangles, labelled. |
| **flythrough** | a video. He drops camera keyframes while walking (`K` = add keyframe here, list in the FILE card, drag to reorder, seconds per leg). The camera flies a smooth curve through them. Render off-screen at 1080p or 4K, 30 or 60 fps, UI hidden, art lit, encoded in-browser to WebM (MediaRecorder) with an MP4 option through a WASM encoder (OPEN which one; mp4-muxer + WebCodecs is the candidate). Progress bar is honest (law 16): frames done / frames total. Also `play` in-app without recording. Phase P3. |

User added flythrough 2026-09-02.

---

## 9. UI grammar

KOAN.design 00 + 01 apply: one var contract, mono chrome, radius 4/6/8, spacing 2…16, 1 px
rest / 2 px emphasis, lowercase buttons, tooltips on everything (gesture + consequence +
shortcut), disabled = dim + reason, right-click everywhere, undo everywhere, one EmptyState.
House Dropdown from @koan/shared for any select. Copy the sibling: cards copy KOAN.live's
floating card chrome; the inventory grid copies vi-dancer's Library thumbnails.

---

## 10. Build plan

| phase | delivers | proof |
|---|---|---|
| **P0 pipeline** | `pipeline.py` steps 1–5, 9. `level.draft.json` with floors + walls. `scan.glb` under 6 MB. | file sizes, plane table matches SCAN-REPORT |
| **P1 walk** | app shell, load scan + level, walk mode, stairs, minimap, themes, Pages live | he walks the gallery in his browser |
| **P2 hang** | inventory, hang mode, HANG widget, autosave, file save/load, undo | he hangs a show |
| **P3 fix + share** | level mode, openings/stairs/blockers/patch, GitHub token save, exports incl. flythrough | he fixes the doors, saves to repo, prints the hang list |
| **P4 auto-detect** | pipeline steps 6–7 (openings, stairs) | reduces P3 hand work; OPEN if worth it |

Each phase = one GO. Each ends with his run in his browser. Nothing is "done" until he says so.

---

## 11. Decisions (user, 2026-09-02)

1. Name: **KOAN.hang**. Decided.
2. Courtyard: **keep**, scan-only, no hanging. Decided.
3. Repo: **public**. Art images are public on the web. Decided.
4. Shell: **floating cards** over the viewport. Decided.
5. Edge default: **wrap** (image stretched over the canvas edge). Decided.
6. Room measurements: **trust the scan**. Decided.
7. Exports: all four kept, plus **flythrough** (§8). Decided.

Still OPEN:
- koan-shared: vendor five files, or publish the package (recommend vendor + drift).
- The first-floor floor hole: he marks it in `level` mode, or tells me where.
