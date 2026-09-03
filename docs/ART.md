# P4 Art: spec (2026-09-03)

Owner's words, 2026-09-03: "we have a library of paintings we upload with sizes and we have the ability to swap which one
we're holding and choose where to place them". Sizes: "we upload the image and put in its h w d measurements". Placing:
"snaps to wall, we can guide it saying which height we want it to be". Saving: "yes, Yozo can use this to work out his
layout". Sculptures: "place these sculptures on a plinth" (YOZO vol 2.obj); "recolour them, texture them, then place them";
"the plinth and sculpture colour can be changed with a picker and the sculpture can have texture choices".

Everything below is his sentence built through the app's existing grammar (docs/SPEC-v1.md §5.4-5.7, §6, §7: cards,
chips, cm fields, layouts, save paths). Where v1 said cursor-and-drag, v3 says hold-walk-look-click: it is a game.

## 1. The library (INVENTORY card)

- Two kinds of work: **painting** (an image) and **sculpture** (an OBJ or GLB).
- Add: drop files on the card. A row opens under the thumbnail: title, **h, w, d in cm** (his order), and for a
  painting `edge` (wrap / white / hex, default wrap). Enter commits.
- A sculpture dropped as OBJ is prepared offline first (§5); the library holds the prepared GLB. The row shows the
  model's own size in cm from its bounds; typing h/w/d scales it uniformly to the height typed (aspect kept).
- Grid of thumbnails, `120 × 90` under each, placed works carry an `on wall` / `on floor` chip. Click = hold it.
- Source of truth: `art/index.json` (`koan-hang-art/2`: v1 fields + `kind`, `model`, `colour`, `texture`, `plinth`).
- Saving new art: the save path (§4). Without a token the card downloads the files and the updated index for him.

## 2. Holding and placing (mode `hang`, pointer-locked, WASD as in walk)

- **Held work**: one at a time. `scroll` or `[` `]` swaps to the previous / next library item; `1..9` picks by
  position; `Q` drops the hold. The HUD strip shows `holding: Tengu 120 × 90`.
- **Painting**: it previews on the wall under the crosshair at true size, ghosted 60 %, flat to the wall (snapped:
  flush, no tilt). Height comes from the HANG widget (§3). Over an opening, a no-hang strip, another work, or off the
  hang walls: red tint, click does nothing, the HUD says why.
- **Click = place.** `E` on a placed work = pick it back up (it becomes the held work). `Delete` while looking at a
  placed work removes it. Arrow keys nudge the work you look at 1 cm (Shift 10 cm). `Ctrl+Z` / `Ctrl+Shift+Z`.
- **Sculpture**: it previews on the floor under the crosshair, standing on its plinth, both ghosted. Click = place.
  Same pick-up, delete, nudge, undo. It faces you when placed; `R` rotates it 15° while held or looked at.
- **Plinth**: a box under the sculpture. Fields on the HANG card when a sculpture is held or looked at: plinth w, d,
  h in cm (default 40 × 40 × 100), plinth colour (picker, default white), or `no plinth`.
- **Sculpture look**: colour picker (tints the model), and a texture chip row from the app's tiles (none · concrete ·
  plaster · plywood · steel · corten · slate · checker) plus `upload` for his own image; tile size in cm. Both live on
  the HANG card while the sculpture is held or looked at, and are saved per placed work.
- Every placement writes the layout (autosave, §4).

## 3. The HANG widget (HANG card)

| row | control |
|---|---|
| snap line | chips `top` · `centre` · `bottom` · `free`, one active |
| height | number field in cm + slider 0 … ceiling, readout paired. Default top 200, centre 150, bottom 100 |
| gap | number field cm, default 10: while placing, the work snaps its edge `gap` cm from a neighbour on the same wall and to the wall's centre; ghost ticks show it |
| show guide | toggle, on: the active line drawn dashed on every hang wall at that height |
| apply | `snap all on this wall` · `snap all` |
| plinth / sculpture rows | §2, shown only for a sculpture |

"We can guide it saying which height we want it to be": the height field is the guide; `free` hangs it where the
crosshair is, height from the crosshair.

## 4. Layouts (FILE card): Yozo lays it out, the owner gets it back

- `layouts/<name>.json`, `koan-hang-layout/2`: v1 fields + per item `kind`, `pos` [x, y, z] and `yaw` for sculptures,
  `plinth` {w, d, h, colour | null}, `colour`, `texture` {name | url, cm}.
- Paths as v1 §7: **browser** autosave (draft), **file** `save file` / drop a .json to load, **github** token save for
  the owner. `?layout=<name>` opens a repo layout: the share link.
- Yozo's path: open the site, add nothing or his own images, hang, `save file`, send the .json. The owner drops it on
  the FILE card, sees it, `save to repo`. Images Yozo added travel inside the .json as data URLs when under 2 MB each,
  else the card lists what is missing.
- Repo copy is truth; loading over a draft asks with counts.

## 5. Sculpture prep (offline, `art/sculpt/prep.py`)

- `YOZO vol 2.obj` is 457 MB, 4.28 M quads, 32 groups, 6 materials (sphere, cylinder, cone in Japanese), no UVs,
  no normals, 0.95 × 1.77 × 1.09 m, floor at y −1.30. Far too heavy for the web as it is.
- prep.py: load, triangulate, decimate per group to a budget (200k triangles total, pyfqmr), recompute normals,
  generate box-projected UVs (so tiles and the picker work), origin to the base centre, metres, write
  `art/sculpt/<id>.glb` (draco or meshopt when the toolchain is present; plain glb otherwise) + a thumbnail.
- Groups become named meshes; the picker tints all, a later step can tint per group (OPEN).
- Every prepared sculpture is listed in `art/index.json` with its bounds; the audit checks the glb is under 15 MB
  and its bounds match the index.

## 6. Render

- Paintings: a box w × h × d, image on the front, edge per `edge`, a soft contact shadow on the wall.
- Sculptures: the glb, MeshStandardMaterial with `color` from the picker and `map` from the texture chip (world
  UVs from the box projection, tile size from the field); plinth a box with the plinth colour, matte.
- Preview ghosts at 60 %, red tint when refused. Guide lines dashed in the accent colour.

## 7. Audit, stage 9 (docs/AUDIT.md grows)

- every placed painting lies on a hang wall, inside it, not over an opening or no-hang strip, not overlapping another
- every sculpture stands on a floor cell of its level; plinth on the floor, sculpture on the plinth (no float, no sink)
- the layout file round-trips: save → load → identical placements
- index.json: every file present, sizes positive, every glb under budget

## 8. Order and gates

1. Library + painting hold/place/snap + HANG widget + browser autosave + file save/load. He hangs one show. GO.
2. Sculpture prep (YOZO vol 2) + plinth + colour picker + texture chips. He places it. GO.
3. Yozo's path end to end: file out, file in, share link. GO.
4. Token save to repo. GO.

## Open

- Painting `edge` default and the contact shadow look: his call when he sees them.
- Per-group tint on sculptures (the OBJ's sphere / cylinder / cone parts): later.
- Whether Yozo needs the walk controls explained on first load: a `?` card line.
