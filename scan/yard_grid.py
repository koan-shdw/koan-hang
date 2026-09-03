"""The courtyard floor as measured from the raw scan (scan/yard.py ortho + cell-gap profiles, 2026-09-03), written into
scan/measured.json["yard"]. Every number below is a profile edge or a box edge from that run; heights are medians of the
scan height map relative to the gallery floor G0. make_level.py builds the yard from this file only."""
import json
# ---- door patch: rows parallel to the red intro wall (z -3.12), columns from the glass (x 0.22) --------------------
# x gaps (<35% cell): 0.25..0.42, 1.99..2.15, 3.10..3.22, 3.46..3.70 ; narrow/col1 split from the row-4 boxes 0.83/0.93
COLS = dict(n1=(0.42, 0.80), c1=(0.94, 1.99), c2=(2.15, 3.10), n2=(3.22, 3.46))
# z gaps per column profile: -3.12 wall, -2.40..-2.27, -1.63..-1.54, -0.91..-0.80, -0.17 apron
ROWS = dict(r1=(-3.12, -2.40), r2=(-2.27, -1.63), r3=(-1.54, -0.91), r4=(-0.80, -0.17))
def cell(col, row, material):
    (x0, x1), (z0, z1) = COLS[col], ROWS[row]
    return dict(box=[[x0, z0], [x1, z1]], material=material)
door_cells = [
    cell("n1", "r1", "slate"), cell("c1", "r1", "slate"), cell("c2", "r1", "slate"),                         # row 1: figure cell | slate | slate
    cell("n1", "r2", "slate"), cell("c1", "r2", "slate"), cell("c2", "r2", "red-tile"), cell("n2", "r2", "slate"),  # row 2: small | slate | red | small
    cell("n1", "r3", "slate"), cell("c1", "r3", "slate"), cell("c2", "r3", "slate"), cell("n2", "r3", "slate"),     # row 3: small | slate | slate | small
    cell("n1", "r4", "slate"), cell("c1", "r4", "red-tile"),                                                   # row 4: small | red, concrete beyond
]
# ---- far patch against the far low wall (z 3.62): x gaps 0.65..0.75, 1.72..1.86, 2.87..2.99, 3.95..4.06 ; z gaps 2.16, 2.79..2.92, 3.59
FCOLS = [(0.30, 0.65), (0.75, 1.72), (1.86, 2.87), (2.99, 3.95), (4.06, 4.81)]
FROWS = dict(mid=(2.16, 2.79), wall=(2.92, 3.59))
far_cells = [dict(box=[[x0, FROWS["wall"][0]], [x1, FROWS["wall"][1]]], material="slate") for x0, x1 in FCOLS]
far_cells += [dict(box=[[FCOLS[i][0], FROWS["mid"][0]], [FCOLS[i][1], FROWS["mid"][1]]], material=m) for i, m in ((0, "slate"), (1, "slate"), (2, "red-tile"), (3, "slate"))]
# ---- side strip in the wide part: red x 4.93..5.38 z 0.32..2.30 ; slates x 5.41..6.27, z 0.10..0.70 / 0.81..1.44 / 1.53..2.19
side_cells = [dict(box=[[4.93, 0.32], [5.38, 2.30]], material="red-tile")] + [dict(box=[[5.41, z0], [6.27, z1]], material="slate") for z0, z1 in ((0.10, 0.70), (0.81, 1.44), (1.53, 2.19))]

yard = dict(
    source="scan/yard.py ortho 1 cm + cell-gap profiles, 2026-09-03; heights = scan height map medians above G0",
    heights=dict(apron=0.10, paving=0.075, slate=0.08, red=0.085, dirt=-0.08, passage=0.04, rack=0.125),
    patches=[
        dict(name="door patch", zone=[[0.32, -3.12], [3.70, -0.85]], cells=[c for c in door_cells if c["box"][0][1] < -0.85]),
        dict(name="door patch row 4", zone=[[0.32, -0.85], [2.05, -0.10]], cells=[c for c in door_cells if c["box"][0][1] > -0.85]),
        dict(name="far patch", zone=[[0.22, 2.16], [4.84, 3.62]], cells=far_cells),
        dict(name="side strip", zone=[[4.84, 0.00], [6.35, 2.30]], cells=side_cells),
    ],
    apron=[  # concrete at +0.10 everywhere the floor outline is not paving, dirt or passage
        dict(name="apron by the glass", box=[[0.22, -0.10], [2.05, 2.16]]),
        dict(name="apron beside row 4", box=[[2.05, -0.85], [3.70, -0.45]]),
        dict(name="apron middle", box=[[2.05, -0.45], [4.84, 2.16]]),
        dict(name="apron wide part top", box=[[4.84, -0.45], [6.84, 0.00]]),
        dict(name="apron beside the side strip", box=[[6.35, 0.00], [6.84, 2.30]]),
        dict(name="apron wide part bottom", box=[[4.84, 2.30], [6.84, 3.62]]),
    ],
    dirt=dict(box=[[3.70, -4.49], [4.40, -0.45]]),                 # floor outline: dirt bed x 3.70..4.40 from behind the red wall to the wide part
    fence_gap=dict(box=[[4.40, -4.49], [4.49, -0.45]]),            # sliver between the dirt and the fence line, concrete
    passage=dict(box=[[5.53, 3.62], [6.84, 5.00]]),                # floor outline: opening in the far low wall, floor at +0.04
    rack=dict(box=[[0.42, -2.36], [0.77, -1.48]]),                 # dark grating on the door step
    figure=dict(x=0.45, z=-2.75, height=1.25),                     # scan/measure3.py
    counter=dict(box=[[-1.25, -2.30], [0.13, -1.46]], height=0.98, note="inside, by the front glass; the notch in the plan; what it is: OPEN"),
    outline=[[0.22, -4.49], [4.49, -4.49], [4.49, -0.45], [6.84, -0.45], [6.84, 5.00], [5.53, 5.00], [5.53, 3.62], [0.22, 3.62]],
    building_end_x=3.70,                                          # the white corrugated building ends where the dirt passes it
)
m = json.load(open("scan/measured.json"))
m["yard"] = yard
json.dump(m, open("scan/measured.json", "w"), indent=1)
reds = sum(1 for p in yard["patches"] for c in p["cells"] if c["material"] == "red-tile")
print("yard written:", sum(len(p["cells"]) for p in yard["patches"]), "cells,", reds, "red")
