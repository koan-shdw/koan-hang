# Context blocks: the streets and buildings around the gallery

Owner (2026-09-03): "recreate them as basic blocks for as far as you can see from any part of the game so we have
background and it's not in a void ... generic will do."

## Source

OpenStreetMap via Overpass, 2026-09-03, 260 m around 35.66629 N 139.70549 E (14-16 Jingumae 6-chome). ODbL.
Raw: `scan/osm/raw.json`. Converter: `scan/osm/blocks.py` -> `level/context.json` -> merged into `level/level.json`
by `make_level.py` (kinds `block`, `road`, `ground`). 588 blocks, 172 roads.

## Alignment of the map to the level

- OSM way 138960255 is the gallery's plot: 3 levels, 12.5 m long, 4.4 m street face. Our building + the narrow yard = 11.7 m.
- Our +x (glass -> yard) = bearing 316.5 deg. Our +z = bearing 46.5 deg (NE). Origin (level 0,0) = map east -3.76, north 4.26.
- Which end is the street: the street-view photo of the back shows the 2-storey balcony house on the LEFT and the tall
  brick building tight on the RIGHT. OSM: 2-level hipped apartments (138960211) on the SW side, 3-level retail (138960270)
  tight on the NE side. Left = SW only if the viewer stands at the SE end looking NW. So the street is at the SE end,
  the yard runs NW. The red intro wall is "immediate left stepping out the front door" = -z = SW. Both agree.
- The back street itself is not mapped in OSM (nearest mapped road is a service lane 4 m past the yard's far end, where
  our passage leads). It is cut manually: a 5 m lane along our back face, x -12.8..-7.8, from the street-view photo.

## Heights

`height` tag when present, else `building:levels` x 3.2 m, else 3 levels. 107 of 718 buildings carried a tag.

## What is generic

Everything: one grey for blocks, a darker grey for roads, a plate under all of it. No textures (owner: "forget it, generic will do").

## Audit

`level/audit.py` 5h: no block on the gallery plot, ground plate present, roads present, every block has a height.
`meshAudit`: every block stands on the ground. `docs/sheet/context-plan-small.jpg`: the built blocks from above.
