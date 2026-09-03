# Owner's notes ledger

Every note the owner has given, his words, one line. `check` = the audit line that proves it. `status`: built / open / dropped by him.
A note without a check, or with a failing check, fails the audit. Repeated notes are marked `xN`.

| date | note (his words) | check | status |
|---|---|---|---|
| 09-02 | there's stairs, windows and doors which need a clean up | file: stairs, openings | built |
| 09-02 | browser, GitHub for data and site, public repo, name KOAN.hang, keep the courtyard | app | built |
| 09-02 | the scan is not the level, remake with our own geometry, scan = reference and textures | level.ts builds from level.json, no glb | built |
| 09-02 | textures generated or expanded from the scan, on my ComfyUI | P3 | open |
| 09-02 | recreate every object: stairs, window frames, doors, ceiling, lights, courtyard tiles, red wall, plants, fences | file: objects | built, plants rough (forget for now) |
| 09-02 | the back windows are not divided by walls, they are ONE big window divided into frames x4 (09-02, 09-03 x3) | file: one back grid ground to roof, one skin | built 09-03 |
| 09-02 | both back doorways are doors, two of them, one under the stairs, one to the stairs, both open, slide on E | file: 2 sliders, leaves hallway side | built |
| 09-02 | on the 2nd floor there is no rail; a stair to a third floor same as the first, third floor not used | file: stairs s2, no rail | built |
| 09-02 | the front door is steel, not glass; hinge on the far side; full height | file: g-east door | built |
| 09-02 | second-to-third stairs busted; stairs don't connect, gap; ceiling and floor two planes should be solid | mesh: stairs, slabs | built |
| 09-02 | door at the bottom of the stairs flush with the wall end; tubes wrong; stairs blocking | file: street door in the corner; meter wall | built |
| 09-02 | courtyard has paths and a red rusted wall with plants | measured.json yard, c-5 | built |
| 09-02 | scan through the entire thing as if it's a game; stairs should never have passed your QC; audit yourself from fresh eyes | AUDIT.md | rebuilt 09-03 |
| 09-02 | get the geometry right, then compress the chat, then textures | plan | in progress |
| 09-02 | make sure all measurements are exact; stairs don't point up over the floor | mesh: stairs | built |
| 09-02 | third floor has no door, just windows; why another floor on the outside | file: t-east windows only | built |
| 09-02 | the poor way you made these shapes is causing clipping | mesh: no coplanar faces | partly (stairs); generic check open |
| 09-02 | red intro wall: step out the front door, immediate left; signage wall; measurements must be perfect | measured.json red_intro_wall, audit 5c | built |
| 09-02 | the upstairs door has a corridor bridge into the next building, straight, door-sized, inaccessible | file: bridge slabs | built |
| 09-02 | stop using compass words; use the stairs and door as reference | replies | rule |
| 09-02 | all the places where the wall and floor don't touch | sky audit, floors to flight edge | built |
| 09-03 | red intro wall too big; note the blue lines; too long | measured.json x 0.60..3.50, 1.75 | built |
| 09-03 | light rails are a square, not two parallel lines; light models broken | file: track rectangles, one-piece spots | built |
| 09-03 | two red tiles, the rest slate; the grid: slate figure / slate / slate; small slate / slate / red / small slate; small slate / slate / small slate; small slate / red | measured.json yard (from the scan ortho) | built |
| 09-03 | dirt strip; yard opens to an L; passage off the far corner; far-end patch; fence-side strip | measured.json yard | built |
| 09-03 | copy it perfectly, check your work, make no mistakes | plan overlay yard-blend.jpg | built |
| 09-03 | streets and buildings around it as basic blocks as far as you can see, so it's not in a void; generic, no textures | level/context.json from OSM, audit 5h, docs/CONTEXT.md | built 09-03 |
| 09-03 | the back is one big glass wall three floors; no white bar; the other side too? | one skin (audit 5e, mesh window checks) | back built 09-03; front as the scan showed it, OPEN for his call |
| 09-03 | why are the side walls different blocks | one skin | built 09-03 |
| 09-03 | the audit checks the entire map and file; define its purpose; research the best audit | AUDIT.md | written |
| 09-03 | forget the plant | hedge unchanged | dropped by him |
| 09-03 | back grid rows | street photo estimate: frosted to 1.74, bar 2.58, thirds above | OPEN, not measured |
| 09-03 | the notch inside by the front glass | counter box 0.98 m, what it is | OPEN, his answer |
| 09-03 | yard is 10 cm above the gallery floor in the scan; walker stands low out there | walk | OPEN |
| 09-03 | glitching around the street door, the stair door and the upper door (striped flicker) | mesh: no two faces share a plane (0 pairs) | built 09-03 |
| 09-03 | off the top of the stairs you drop to the floor below, 2nd and 3rd floor | walk: 90 cm steps land on the upper floor; dt capped | built 09-03 |
| 09-03 | geometry overlaps outside, block by the yard; "all you did was cross these two shapes"; "I thought you said you audited" | blocks dissolved (no overlaps), 3 cm apart, 1 m off the plot; audit 5h cell grid | built 09-03 |
| 09-03 | only the courtyard and the building, the rest a smokey void; do it now, before textures | level.fog + sky grey + no blocks; void-views sheet | built 09-03 |
| 09-03 | drop the walls opposite the entrance door, the one behind the red intro wall, and these ones (the yard boundary) | c-1 c-2 c-3 c-4 c-6 c-8 removed; c-5 red wall + hedge stay; open-yard-views sheet | built 09-03 |
| 09-03 | just remove this bar (the strip at the fence's foot) and I believe you've finally got it | fence_gap slab removed; open-yard-strip-gone.jpg | built 09-03 |
