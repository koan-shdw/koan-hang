# Audit report

2026-09-03 15:16, commit 4a11e7d

**PASS** (0 fails)

## Stage 1 file audit (level/audit.py)

PASS: 223 pass, 0 fail


## Stage 2 fit to the scan

NOT AUDITED except the yard plan overlay (docs/sheet/yard-blend.jpg, checked by eye). Elevations, sections, objects: not built yet.

## Stage 3 mesh audit (koanHang.meshAudit)

PASS: 42 pass, 0 fail


## Stage 4 sky audit (koanHang.skyLeakAudit)

PASS: 35 pass, 0 fail


## Stage 4 walk audit

NOT AUDITED: flood walk not built yet.

## Stage 5 visual pass

Sheets to look at by hand (one line each goes in the commit message):

- docs/sheet\back-views-1.jpg
- docs/sheet\back-views-2.jpg
- docs/sheet\ceil-views.jpg
- docs/sheet\context-plan-small.jpg
- docs/sheet\context-views-1.jpg
- docs/sheet\context-views-2.jpg
- docs/sheet\fix-views.jpg
- docs/sheet\front-fix-views.jpg
- docs/sheet\open-yard-views.jpg
- docs/sheet\skin-views-1.jpg
- docs/sheet\skin-views-2.jpg
- docs/sheet\void-views.jpg
- docs/sheet\yard-blend.jpg
- docs/sheet\yard-views.jpg

## Stage 6 notes ledger

40 notes, 11 open:

- there's stairs, windows and doors which need a clean up -> built
- textures generated or expanded from the scan, on my ComfyUI -> open
- both back doorways are doors, two of them, one under the stairs, one to the stairs, both open, slide on E -> built
- the poor way you made these shapes is causing clipping -> partly (stairs); generic check open
- dirt strip; yard opens to an L; passage off the far corner; far-end patch; fence-side strip -> built
- the back is one big glass wall three floors; no white bar; the other side too? -> back built 09-03; front as the scan showed it, OPEN for his call
- back grid rows -> OPEN, not measured
- the notch inside by the front glass -> OPEN, his answer
- yard is 10 cm above the gallery floor in the scan; walker stands low out there -> OPEN
- drop the walls opposite the entrance door, the one behind the red intro wall, and these ones (the yard boundary) -> built 09-03
- just remove this bar (the strip at the fence's foot) and I believe you've finally got it -> built 09-03

## Not audited

- fit: elevations, sections, objects vs the scan
- mesh: generic floating, overlap, coplanar faces, opening frames, door clearance, lights on tracks, minimap
- walk: flood walk, eye inside mesh
- visual: fixed shot list, photo pairing
