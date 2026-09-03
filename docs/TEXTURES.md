# P3 Textures: spec

Owner, 2026-09-03: "textures generated or expanded from the scan, on my ComfyUI". Decisions 2026-09-03 late: bake from the
scan first, then ComfyUI cleans and extends; ALL surfaces; 2k per surface. This spec goes in before any code (his rule).

## What the scan gives

`scan/raw/9_2_2026.glb`: 8 primitives, 4 materials, 4 JPEG atlases (3 x 4096², 1 x 4096x3712), UVs on every vertex.
Extracted to `scan/tex/atlas0..3.jpg`. Texel density about 2 px per cm on the big surfaces, so the bake is taken at
2 px/cm and ComfyUI carries it to 2048².

## The surfaces (his list, 2026-09-03)

| # | surface | material name in the palette | where it is | source | tile (m) |
|---|---|---|---|---|---|
| 1 | white walls | `wall-white` | every wall face, three floors and the stair hall | scan bake | 2.0 |
| 2 | gallery floor | `concrete-bare` | the three floors | scan bake | 2.0 |
| 3 | ceiling ribs + the ceiling between | `rib`, `corrugated-ceiling` | every ceiling | scan bake | 1.0 |
| 4 | stair | `checker` treads, `plywood` risers, `stringer-blue` plates | both flights | scan bake | 0.5 / 1.0 / 1.0 |
| 5 | doors | `door-metal` steel leaves, `door-slide` sliders | front, street, the two hallway sliders, the upper door | scan bake | 1.0 |
| 6 | window frames | `steel-black`, `steel-grey` | every grid | scan bake (small) | 0.5 |
| 7 | counter | `plywood` | by the front glass | scan bake | 1.0 |
| 8 | track, spots, aircon, junction box | `steel-black`, `aircon`, `junction-box` | ceilings, the g-south wall | ComfyUI from reference | 0.5 |
| 9 | yard paving | `slate`, `red-tile`, `concrete` (gap lines) | the three patches | scan bake | 1.0 |
| 10 | apron and paths | `concrete-path` | the yard aprons | scan bake | 2.0 |
| 11 | dirt strip | `dirt` | along the yard | scan bake | 1.0 |
| 12 | red intro wall | `corten` | c-5 | scan bake | 1.0 |
| 13 | hedge | | | dropped by him | |
| 14 | bridge | `render` | the first-floor bridge | scan bake, partial | 2.0 |
| 15 | back grid frosted panes | `glass-frosted` | the back grid below 1.74 | scan bake | 1.0 |
| 16 | glass | `glass` | | stays a material, no map | |

Materials not in the palette yet (`dirt`, `junction-box` map) get added with the map.

## Pipeline

### A. Bake: `python scan/bake.py` -> `scan/bake/<material>.png` + `<material>.mask.png`

- For every surface in the table: walk its faces at 2 px/cm; for each texel, cast a ray from 15 cm in front of the face
  along the face's inward normal into the scan mesh (trimesh); take the hit's UV, read the atlas colour.
- No hit within 30 cm = hole, written black in the image and 0 in the mask.
- One image per material, stitched from every face that carries it, largest face first, faces laid side by side with
  a 4 px gutter. `scan/bake/index.json`: which face went where, in metres.
- Also the per-material coverage %, in the report. Under 40 % coverage = ComfyUI works from reference, not from the bake.

### B. ComfyUI: `python textures/clean.py` -> `textures/<material>.jpg` (2048², seamless)

- Raw API on 127.0.0.1:8188 (his box; comfyui-mcp available; outputs to Desktop\AI OUTPUTS; see memory).
- Workflow `textures/workflows/clean-tile.json`, one per material call: inpaint the mask holes, remove the scan's
  baked-in lighting (flat-light pass), make it tileable (offset + inpaint the seam), upscale to 2048.
- Reference-only materials (row 8, and any bake under 40 %): text + a crop of the scan as the reference image.
- Every output checked by `textures/check.py`: 2048², tileable (left/right and top/bottom edge difference under a
  threshold), mean colour within 15 % of the bake's mean (no colour drift).

### C. App

- `PALETTE[name].map = '<material>.jpg'` and `metresPerTile`. `mat()` loads the map from `data/textures/` once, sRGB,
  repeat wrapping, anisotropy 8, when the look is `textured`; the colour stays as a tint (white for baked maps).
- World-space UVs: every wall box, slab, floor, ceiling, tread, riser, cell gets its `uv` attribute rewritten from world
  position per face (u along the face's long axis, v up or along, divided by `metresPerTile`), so one texture tiles in
  metres across every surface with no seams at piece boundaries. Extrusions (floors, ceilings, stair bodies) the same,
  per face normal (the three axes).
- The `textured` look button (already in the LEVEL panel, disabled 'arrives in P3') switches maps on and off; `clean`
  stays the flat look. Wire unchanged.
- Loading: maps load after the level is walkable; no map blocks the walk. Missing file = flat colour + a console line,
  never a crash.

### D. Audit, stage 8 (`docs/AUDIT.md` grows)

- every material in the table has its map file, 2048², tileable (check.py output in `docs/audit/textures.txt`)
- scale: the paving cells read at their measured size; the rib pitch matches the scan (one measured feature per
  material where one exists, listed in `scan/bake/index.json`)
- bake matches the scan: for each material a sheet `docs/sheet/tex-<material>.jpg` = scan crop | bake | final tile,
  looked at by hand, one line each in the report
- app: every map loads (no 404 in the network log), frame rate on the textured look within 20 % of clean
- the owner's photos, when they arrive in `docs/ref/`, become the reference for colour and grain

## Order and gates

1. `bake.py` + coverage report + the `tex-*` sheets (bake column only). He looks. GO.
2. ComfyUI workflow, one material end to end (the floor), sheet. He looks. GO.
3. All materials through the workflow, check.py, sheets. He looks. GO.
4. App wiring, textured look on, walk shots inside and out. He looks. GO. Push.

## Open

- Scan coverage of the second and third floor and the stair hall: unknown until the bake runs. Rows with weak coverage
  go to ComfyUI-from-reference; the report says which.
- His photos into `docs/ref/` would settle colour. Not blocking.
- ComfyUI reachable right now: to check at step 2.
