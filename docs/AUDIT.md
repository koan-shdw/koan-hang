# The audit

## Purpose

The audit proves the level is right and whole before anyone says done. Every wall, floor, object and face, inside
and out, against the whole truth: the scan, the owner's notes, the owner's photos. It is not a list of past bugs.
Anything it does not cover it names as not audited. A fail blocks the push.

## Stage 0. Truth

- `docs/NOTES.md`: the owner's notes ledger. Every note, one line, date, his words, check id, status. Notes go in before any build.
- `docs/ref/`: the owner's photos and scan screenshots, named by what they show. Ledger lines point at them.
- `scan/raw/*.glb`: the scan, de-rotated 1.79 deg. The only geometry source.
- `scan/measured.json`: every number the level uses, each with its source (script, faces, note, photo).
- Rule: a number in `level.json` with no line in `measured.json` or a note id fails. Every wall and object carries `src`.

## Stage 1. File audit: `python level/audit.py`

- schema: every entry has every field the builder reads; format version right
- provenance: every wall and object has a `src`; `UNSOURCED` fails
- coverage: every `measured.json` entry is used by the level
- corners closed, openings inside walls, no overlaps, heights inside walls
- slabs solid, floors touch walls, stairs meet floors, sliders clear, reachability
- yard: every measured box present, red counts, dirt end, passage, outline
- one skin: one drawn wall per line, lowest base to highest top; upper-floor entries walk-only
- materials: every name exists in the palette
- output: `docs/audit/file.txt`

## Stage 2. Fit to the scan: `python scan/fit.py`

- plan: level rendered straight down per floor and yard over the scan ortho at 1 cm; difference image; score per floor
- elevation: every wall line, both faces, built raster over the scan raster; openings within 3 cm
- section: floor, ceiling, slab, sill, head heights, stair pitch within 2 cm
- objects: every object against its scan cluster within 5 cm, or marked owner-specified with its photo
- output: `docs/audit/fit/*.png`, `docs/audit/fit.txt`

## Stage 3. Mesh audit: `koanHang.meshAudit()` in the browser

- every mesh sits on a floor, wall, ceiling or listed parent within 1 cm; floating fails
- no mesh penetrates another unless listed as intended; no coplanar faces between meshes
- one skin: exterior walls continuous ground to roof, no seam faces
- every opening complete: frame, glass or leaf, sill, threshold, posts at ends
- doors open and close clear; sliders clear the stringer
- stairs: body, plates, stringers, top tread flush, headroom over every step
- floors and ceilings: thickness, level, no gap
- lights: every spot on its track, aimed inside
- minimap and plan match the walk floors
- output: `docs/audit/mesh.txt` via the dev server

## Stage 4. Sky and walk: `koanHang.skyLeakAudit()`, `koanHang.walkAudit()`

- sky: rays from every 20 cm cell of every floor; no sky through a wall; front-door exit excluded
- flood walk from spawn on a 10 cm grid, every level, stairs both ways, doors both states
- eye never inside a mesh anywhere reachable; a floor under every reachable cell
- output: `docs/audit/walk.txt`, reachability map per floor

## Stage 5. Visual pass, every push, every frame looked at

- shot list `docs/audit/shots.json`: outside every face from street, yard, corners, three heights; inside every room
  from four corners plus ceiling and floor; every stair top and bottom; every door; every yard patch, red wall, figure, passage
- each shot paired with its reference photo where one exists, side by side on one sheet
- taken on my own tab, the owner's pane reloaded clean after
- one line per sheet in the report: what it shows, pass or what is wrong. No sheet unread.

## Stage 6. Notes ledger

- every line in `docs/NOTES.md` has a check id and a status
- a note without a check, or with a failing check, fails the run
- a note the owner repeated and that is still open is listed first

## Stage 7. Report and gate

- `docs/audit/REPORT.md` per run: date, commit, pass or fail per stage, every fail, the not-audited list, the shot index
- any fail blocks the push; the push script runs the chain first
- after push: live `level.json` compared to the repo file

## Stage 8. Grows with the phases

- textures: seams, scale, bake matches the scan
- hang: hang walls, no-hang zones, snap accuracy in cm
- app: load time, frame rate, console clean, no 404s

## Status

| stage | state |
|---|---|
| 0 truth | ledger + measured.json + src on every wall and object: IN. Photos folder: waiting on the owner's files. |
| 1 file | IN: audit.py incl. one skin, provenance, back grid, yard, context blocks |
| 2 fit | plan overlay IN (yard, docs/sheet/yard-blend.jpg); elevations, sections, objects: NOT YET |
| 3 mesh | IN: stairs, floors, slabs, every window built and uncovered, blocks on the ground, NO TWO FACES ON ONE PLANE (every axis-aligned box pair). NOT YET: generic floating, angled faces, doors clear |
| 4 sky + walk | sky from 35 points IN; stair exit at any frame size IN (walk.ts); grid sky, flood walk: NOT YET |
| 5 visual | shot sheets in docs/sheet, looked at by hand; fixed shot list + photo pairing: NOT YET |
| 6 ledger | IN (docs/NOTES.md) |
| 9 art | NOT YET: placed works on hang walls / off openings / no overlap, plinths on floors, layout round trip (docs/ART.md §7). The app refuses bad placements live; the file check comes with gate 2. |
| 7 report + gate | level/run_audit.py writes docs/audit/REPORT.md; push gate script: NOT YET |

Run: `python level/run_audit.py` after the browser audits have posted mesh.txt and sky.txt (koanHang.meshAudit / skyLeakAudit -> /__audit).
