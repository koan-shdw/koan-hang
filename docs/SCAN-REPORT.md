# SCAN REPORT — Polycam LiDAR, 2026-09-02

Source: `scan/raw/9_2_2026.glb` (16.2 MB, Polycam free GLTF export). Numbers below come from
`scan/scan_report.py`, `scan/planes.py`, `scan/plan_views.py` (run 2026-09-02). Units: metres.
Y is up. Pictures: `scan/plan_ground.png`, `scan/plan_first.png`, `scan/walls_ground.png`,
`scan/walls_first.png`, `scan/elev_xy.png`, `scan/elev_zy.png`.

## Mesh

| fact | value |
|---|---|
| chunks | 8 meshes, each with its own 4096×4096 (two 4096×3712) texture |
| triangles / vertices | 428,675 / 264,591 |
| bounding box | 16.5 × 7.5 × 9.9 m (x × y × z) |
| surface area | 538 m² |
| connected pieces | 4,103 |
| pieces under 200 triangles | 3,661 pieces, 76,015 triangles, 59 m² — floating junk |
| near-black texture | 21 m² — the black patches |
| walls off the main grid | 30 m² (mostly courtyard + noise) |
| building rotation | walls sit 1.79° off the x/z axes |

## Levels (horizontal planes, after de-rotation)

| level | y | area | extent |
|---|---|---|---|
| ground floor | −5.50 | 66 m² | x −7.7 … 6.6, z −3.0 … 3.7 (room + courtyard) |
| first floor slab | −2.22 | 54 m² | x −6.9 … 5.7, z −2.4 … 2.6 |
| first floor ceiling | 0.84 | 20 m² | x −7.0 … 0.3, z −2.5 … 2.8 |

Floor-to-floor 3.28 m. First-floor ceiling height 3.06 m. Slab thickness not measured (OPEN).

## Walls (vertical planes, after de-rotation)

Main room, both floors:

| wall | position | area | extent |
|---|---|---|---|
| west (ground) | x = −5.89 | 21 m² | z −2.9 … 2.4, full height |
| west (first) | x = −7.07 | 5 m² | z −2.9 … 0.8 — first floor is 1.2 m wider, it sits over the stair |
| east | x = 0.30 | 13 m² | z −2.6 … 3.2, both floors |
| south | z = −2.43 | 45 m² | x −6.9 … 0.6, both floors |
| north | z = 2.72 | 45 m² | x −7.3 … 0.2, both floors |

Room size: ground 6.2 × 5.15 m, first 7.4 × 5.15 m. Stair: along the west side, x −7.1 … −5.9,
z −1.5 … 0.8, treads visible in `walls_ground.png` as parallel lines.

Courtyard (east, ground level only):

| wall | position | area | extent |
|---|---|---|---|
| x = 4.49 | 11 m² | z −4.5 … −0.3, y −5.6 … −2.35 |
| x = 6.83 | 16 m² | z 0.3 … 5.0, y −5.5 … −0.55 |
| z = 3.62 | 7 m² | x −0.2 … 5.5, low |
| z = 4.26 | 9 m² | x −0.6 … 3.7, y −3.9 … −0.8 (neighbour wall, floating) |
| z = −0.42 | 4 m² | x −6.6 … 7.6, y −5.5 … −1.1 (mixed, includes noise) |

The courtyard is partial: no roof, walls broken, a floating strip at z ≈ 4.2 and a black
blob at z ≈ −4.8 are captured through glass.

## What is wrong with the scan (seen)

1. 3,661 floating fragments (blue and black smears in the Polycam view).
2. Black patches: 21 m² of faces textured black (ceiling of first floor, one lump east).
3. A small hole in the first floor slab (user report; exact spot to be marked in the app — OPEN).
4. Walls are wavy: the north wall drifts ±5 cm across its length. Snapping art to the raw
   mesh would tilt it. This is why the clean layer exists.
5. Stairs, doors and windows are noisy blobs, not clean shapes.
6. Textures: 8 × 4096² = too heavy for a phone browser. Needs 2048² and Draco.

## P0 pipeline results (2026-09-02, `scan/pipeline.py` + `scan/compress.ps1`)

| step | result |
|---|---|
| de-rotate | 1.79 deg |
| junk cut | 76,015 faces in pieces under 200 tris removed, 9,216 black faces removed, 343,444 kept |
| clean export | `level/scan.clean.glb` 12.8 MB, textures intact (checked in `scan/clean_plan.png`) |
| compress | textures 2048, simplify to 137k tris, Draco: `level/scan.glb` **2.3 MB** |
| level draft | `level/level.draft.json`: 2 levels, 15 walls, facing sides correct (normals point into the room) |

Levels from the draft: ground floor y −5.50, ground ceiling y −2.29 (height 3.21 m);
first floor y −2.14, ceiling y 0.84 (height 2.98 m). Slab 0.15 m.

Textures: the raw file has 4 textures shared by 8 meshes, so 4 in the output is correct.

Seen in `scan/clean_plan.png`: a first-floor corridor east of the room (x 1 … 6, z 0 … 2)
that the wall table did not list as walls, its sides are short. Hand work in `level` mode.
Courtyard wisps remain by decision (keep).

Not done in P0 (per spec): hole fill (step 4), openings (6), stairs (7). Stairs are visible
in the scan at x −7 … −6, treads intact.
