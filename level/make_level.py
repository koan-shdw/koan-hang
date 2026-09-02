"""Writes level/level.json from the measured scan (scan/report.md, scan/measure.py, SCAN-REPORT.md).
Numbers are in the de-rotated scan frame, metres, y up. The scan.glb already carries the rotation.
Wall a->b runs left->right as seen from the room (hang u increases left to right).
Openings: door = walker passes, window = no hang, both = no hang."""
import json

G0, G1 = -5.50, -2.29   # ground floor, ground ceiling
F0, F1 = -2.14, 0.84    # first floor, first ceiling
W, E, S, N, SW = -7.06, 0.22, -2.42, 2.72, -5.89  # west, east, south, north, stair wall

def wall(id, name, level, a, b, facing, baseY, topY, openings=(), noHang=(), hang=True, note=None):
    d = dict(id=id, name=name, level=level, a=a, b=b, baseY=baseY, topY=topY, thickness=0.15, facing=facing,
             openings=list(openings), noHang=list(noHang), hang=hang)
    if note: d["note"] = note
    return d
def door(u, w, h=2.10): return dict(kind="door", u=u, w=w, bottom=0, h=h)
def window(u, w, bottom, h): return dict(kind="window", u=u, w=w, bottom=bottom, h=h)

GH, FH = G1 - G0, F1 - F0
walls = [
    # ground
    wall("g-west", "hallway west", "ground", [W, N], [W, S], "+x", G0, G1, hang=False,
         note="street side; scan sees little here, glass likely; hand-check in level mode"),
    # doorway room <-> hallway at the north end of the stair wall: scan shows no wall z 1.8..2.6 below 2.0 m
    wall("g-stair-room", "room west (stair wall)", "ground", [SW, N], [SW, S], "+x", G0, G1,
         openings=[door(0.12, 0.80, 2.00)], note="doorway to the hallway at the north end (scan + first-person check)"),
    wall("g-stair-hall", "hallway east (stair wall)", "ground", [SW, S], [SW, N], "-x", G0, G1, hang=False,
         openings=[door(4.22, 0.80, 2.00)]),
    wall("g-east", "room east (courtyard glass + door)", "ground", [E, S], [E, N], "-x", G0, G1,
         openings=[window(0.00, 2.32, 0, GH), door(2.32, 1.15), window(3.47, 1.67, 0, GH)],
         note="door measured z -0.10..1.05 (closed leaf in scan); rest is glass"),
    wall("g-south", "south", "ground", [W, S], [E, S], "+z", G0, G1,
         openings=[door(0.00, 1.17)], note="hallway end = street entrance door (floorplan)"),
    wall("g-north", "north", "ground", [E, N], [W, N], "-z", G0, G1,
         openings=[window(6.11, 1.17, 0, GH)], note="hallway north end open in scan; kind unknown"),
    # courtyard (scan-only, no hanging: user decision 2026-09-02)
    wall("c-1", "courtyard wall x4.49", "ground", [4.49, -4.49], [4.49, -0.32], "-x", G0, -2.37, hang=False),
    wall("c-2", "courtyard wall x6.84", "ground", [6.84, 0.66], [6.84, 4.94], "-x", G0, -0.54, hang=False),
    wall("c-3", "courtyard low wall z3.62", "ground", [5.53, 3.62], [-0.21, 3.62], "-z", G0, -3.97, hang=False),
    wall("c-4", "courtyard wall z-0.40", "ground", [4.49, -0.40], [7.03, -0.40], "+z", G0, -1.16, hang=False),
    wall("c-5", "courtyard wall z-3.12", "ground", [0.60, -3.12], [4.39, -3.12], "+z", G0, -2.30, hang=False),
    # first
    wall("f-west", "west", "first", [W, N], [W, S], "+x", F0, F1,
         openings=[window(0.00, 3.32, 0, FH)], note="scan shows no wall z -0.6..2.72: glass; check"),
    wall("f-east", "east", "first", [E, S], [E, N], "-x", F0, F1,
         openings=[window(0.00, 1.12, 0, FH)], note="scan shows no wall z -2.42..-1.30: glass; check"),
    wall("f-south", "south", "first", [W, S], [E, S], "+z", F0, F1,
         note="scan gaps: x -5.9..-4.4 below 2.1 m, x -0.7..0.2 at 1.1..2.9 m; left solid, check"),
    wall("f-north", "north", "first", [E, N], [W, N], "-z", F0, F1),
]
level = dict(
    format="koan-hang-level/1",
    scan=dict(file="scan.glb", rotationDeg=-1.79, rotationApplied=True, offset=[0, 0, 0]),
    eyeHeight=1.60,
    spawn=dict(level="ground", x=-2.8, z=0.1, yawDeg=90),
    levels=[dict(id="ground", name="ground", floorY=G0, ceilY=G1),
            dict(id="first", name="first", floorY=F0, ceilY=F1)],
    floors=[dict(level="ground", name="room + hallway", poly=[[W, S], [E, S], [E, N], [W, N]]),
            dict(level="ground", name="courtyard", poly=[[E, -4.49], [6.84, -4.49], [6.84, 3.62], [E, 3.62]]),
            dict(level="first", name="room + landing", poly=[[SW, S], [E, S], [E, N], [W, N], [W, 1.7], [SW, 1.7]])],
    walls=walls,
    stairs=[dict(id="s1", level="ground", to="first", **{"from": [-6.475, -1.9]}, dir="+z", width=1.17, run=3.6,
                 bottomY=G0, topY=F0, treads=16, riser=0.198, tread=0.225)],
    blockers=[],
    patches=[dict(level="first", name="floor gap in scan", poly=[[-5.7, 0.8], [-2.5, 0.8], [-2.5, -1.0], [-5.7, -1.0]],
                  note="scan has no floor here (dark floor or the hole he saw); flat patch at floor height")],
    source=dict(made="level/make_level.py 2026-09-02", from_="scan/report.md + scan/measure.py + Polycam floorplan"),
)
json.dump(level, open("level/level.json", "w"), indent=1)
print("wrote level/level.json:", len(walls), "walls")
