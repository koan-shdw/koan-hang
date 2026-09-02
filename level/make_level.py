"""Writes level/level.json (format koan-hang-level/2) from the scan measurements and the owner's walk-through
answers of 2026-09-02. Metres, y up, the de-rotated scan frame.
Wall a->b runs left->right as seen from the room. Openings: u from a, w width, bottom/h from the wall base.
 door: {type: slide|swing|metal, open: bool, toggle: bool}   window: {grid: {cols, bars:[heights], cross:[col..]}, frame}
Owner facts (2026-09-02): back wall ground = two same-size doors, left slides (under the stairs), right at the bottom
of the stairs, both open in the game, slide function. Glass fronts: ground = cross-bar window | door | three frames;
second floor = cross-bar window | closed metal door | two windows. West window second floor = one grid six across,
Tokyo street outside. South wall second floor: the glass carries on at the window end. Second floor: no rail, the same
flight again up to an unused third floor. Plinth + desk removed."""
import json

G0, G1 = -5.50, -2.29   # ground floor, ground ceiling
F0, F1 = -2.14, 0.84    # second floor (id "first"), its ceiling
T0 = 0.99               # third floor level (unused): F1 + 0.15 slab
E, S, N, SW = 0.22, -2.42, 2.72, -5.89
W = -7.06               # west face, both floors (scan)
WG = W
SWH = -6.04             # hallway face of the stair wall (0.15 thick); on the second floor the same slab carries on as flight 2's side wall
STAIR_X = round((W + SWH) / 2, 3); STAIR_W = round(SWH - W - 0.02, 2)
GH, FH = G1 - G0, F1 - F0
GREY, BLACK = "steel-grey", "steel-black"

def wall(id, name, level, a, b, facing, baseY, topY, openings=(), noHang=(), hang=True, material="wall-white", note=None):
    d = dict(id=id, name=name, level=level, a=a, b=b, baseY=baseY, topY=topY, thickness=0.15, facing=facing,
             openings=list(openings), noHang=list(noHang), hang=hang, material=material)
    if note: d["note"] = note
    return d
def door(u, w, h, type, open, toggle=True, leaf=True, face="steel", swingOut=False):
    return dict(kind="door", u=u, w=w, bottom=0, h=h, door=dict(type=type, open=open, toggle=toggle, leaf=leaf, face=face, swingOut=swingOut))
def window(u, w, bottom, h, cols, bars, frame, cross=()):
    return dict(kind="window", u=u, w=w, bottom=bottom, h=h, grid=dict(cols=cols, bars=list(bars), cross=list(cross)), frame=frame)

walls = [
    # ---------------- ground ----------------
    wall("g-west", "hallway west, windows behind the stair", "ground", [WG, N], [WG, S], "+x", G0, G1, hang=False, material="wall-blue",
         openings=[window(0.10, 4.12, 0.30, GH - 0.45, 5, [1.0, 2.1], GREY),
                   door(4.22, 0.80, 2.10, "metal", False, toggle=False),
                   window(4.22, 0.80, 2.15, GH - 2.20, 1, [], GREY)],
         note="owner: one big grey-framed window from the north corner to the steel street door opposite the south doorway, pane over the door"),
    wall("g-stair-room", "back wall (stair wall), room side", "ground", [SW, N], [SW, S], "+x", G0, G1,
         openings=[door(0.12, 0.80, 2.00, "slide", True, leaf=False), door(4.34, 0.80, 2.00, "slide", True, leaf=False)],
         note="two same-size doors: left (north) slides, goes under the stairs; right (south) at the bottom of the stairs; leaves live on the hallway side (g-stair-hall)"),
    wall("g-stair-hall", "back wall, hallway side", "ground", [SWH, S], [SWH, N], "-x", G0, G1, hang=False, material="wall-blue",
         openings=[door(0.00, 0.80, 2.00, "slide", True), door(4.22, 0.80, 2.00, "slide", True)]),
    wall("g-east", "glass front", "ground", [E, S], [E, N], "-x", G0, G1, hang=False,
         openings=[window(0.10, 2.17, 0, GH, 3, [1.0], GREY, cross=[1]),
                   door(2.32, 1.15, 2.30, "swing", True, toggle=True, face="steel", swingOut=True),
                   window(3.52, 1.57, 0, GH, 3, [1.0], GREY)],
         note="owner: cross-bar window | grey steel door standing open into the courtyard | three frames; one grey steel grid, bar at ~1 m"),
    wall("g-south", "south", "ground", [WG, S], [E, S], "+z", G0, G1,
         openings=[door(0.00, 1.17, 2.10, "swing", False, toggle=False)], note="hallway end = street door, closed"),
    wall("g-north", "north", "ground", [E, N], [WG, N], "-z", G0, G1),
    # courtyard: scan-only in v1, rebuilt plain in v2; no hanging
    wall("c-1", "courtyard fence south", "ground", [4.49, -4.49], [4.49, -0.32], "-x", G0, -2.37, hang=False, material="corrugated"),
    wall("c-2", "courtyard fence east", "ground", [6.84, 0.66], [6.84, 4.94], "-x", G0, -0.54, hang=False, material="corrugated"),
    wall("c-3", "courtyard low wall north", "ground", [5.53, 3.62], [-0.21, 3.62], "-z", G0, -3.97, hang=False, material="concrete"),
    wall("c-4", "courtyard wall", "ground", [4.49, -0.40], [7.03, -0.40], "+z", G0, -1.16, hang=False, material="concrete"),
    wall("c-5", "courtyard low wall south", "ground", [0.60, -3.12], [4.39, -3.12], "+z", G0, -2.30, hang=False, material="concrete"),
    wall("c-6", "neighbour wall north", "ground", [3.71, 4.25], [-0.56, 4.25], "-z", -3.87, -0.81, hang=False, material="render"),
    # ---------------- second floor (id "first") ----------------
    wall("f-west", "west, big window", "first", [W, N], [W, S], "+x", F0, F1, hang=False,
         openings=[window(0.17, 4.80, 0.25, 2.45, 6, [1.0, 2.1], BLACK)],
         note="one black grid six across, Tokyo street outside"),
    wall("f-east", "east glass", "first", [E, S], [E, N], "-x", F0, F1, hang=False,
         openings=[window(0.10, 1.20, 0, FH, 1, [1.0, 2.1], BLACK, cross=[0]),
                   door(2.00, 0.90, 2.10, "metal", False, toggle=False, face="mesh"),
                   window(3.35, 1.69, 0, FH, 2, [1.0, 2.1], BLACK)],
         note="owner: cross-bar window | closed metal door | two windows"),
    wall("f-south", "south", "first", [W, S], [E, S], "+z", F0, F1),
    wall("f-north", "north", "first", [E, N], [W, N], "-z", F0, F1),
]

level = dict(
    format="koan-hang-level/2",
    eyeHeight=1.60,
    spawn=dict(level="ground", x=-2.8, z=0.1, yawDeg=90),
    levels=[dict(id="ground", name="ground", floorY=G0, ceilY=G1),
            dict(id="first", name="second", floorY=F0, ceilY=F1)],
    floors=[
        dict(level="ground", name="room", poly=[[SW, S], [E, S], [E, N], [SW, N]], material="concrete-polished"),
        dict(level="ground", name="hallway", poly=[[WG, S], [SW, S], [SW, N], [WG, N]], material="concrete-polished"),  # runs to the room face so the doorways have floor
        dict(level="ground", name="courtyard", poly=[[E, -4.49], [6.84, -4.49], [6.84, 3.62], [E, 3.62]], material="stone-tiles"),
        dict(level="first", name="room", poly=[[SW, S], [E, S], [E, N], [SW, N]], material="concrete-bare"),
        dict(level="first", name="landing", poly=[[W, 1.7], [SW, 1.7], [SW, N], [W, N]], material="concrete-bare"),
        dict(level="first", name="stair foot", poly=[[W, S], [SW, S], [SW, -1.9], [W, -1.9]], material="concrete-bare"),
    ],
    ceilings=[
        dict(level="ground", poly=[[SW, S], [E, S], [E, N], [SW, N]], material="corrugated-ceiling"),
        dict(level="ground", poly=[[WG, S], [SWH, S], [SWH, -1.9], [WG, -1.9]], material="corrugated-ceiling"),  # only over the stair foot; the flight's underside is the ceiling beyond
        dict(level="first", poly=[[SW, S], [E, S], [E, N], [SW, N]], material="corrugated-ceiling"),
        dict(level="first", poly=[[W, S], [SW, S], [SW, -1.9], [W, -1.9]], material="corrugated-ceiling"),
        dict(level="first", poly=[[W, 1.2], [SW, 1.2], [SW, 1.7], [W, 1.7]], material="corrugated-ceiling"),  # third-floor slab over the blocked top of flight 2
        dict(level="first", poly=[[W, 1.7], [SW, 1.7], [SW, N], [W, N]], material="corrugated-ceiling"),
    ],
    walls=walls,
    stairs=[
        dict(id="s1", level="ground", to="first", **{"from": [STAIR_X, -1.9]}, dir="+z", width=STAIR_W, run=3.6,
             bottomY=G0, topY=F0, treads=16, riser=round((F0 - G0) / 17, 3), tread=0.225, nosing=0.03,
             material="stair-wood"),
        dict(id="s2", level="first", to=None, topBlocked=0.9, **{"from": [STAIR_X, -1.9]}, dir="+z", width=STAIR_W, run=3.6,
             bottomY=F0, topY=T0, treads=16, riser=round((T0 - F0) / 17, 3), tread=0.225, nosing=0.03,
             material="stair-wood", sideWall=dict(side="+x", height=0.9, thickness=0.15, material="wall-white"),
             note="same flight again, up to the unused third floor; blocked near the top; the blue side wall is the diagonal band in the west window photo"),
    ],
    blockers=[],
    objects=[
        dict(kind="ribs", level="ground", dir="+x", pitch=0.15, depth=0.05, width=0.06),
        dict(kind="ribs", level="first", dir="+x", pitch=0.15, depth=0.05, width=0.06),
        dict(kind="light", level="ground", at=[-4.6, -1.2], size=[1.2, 0.08]), dict(kind="light", level="ground", at=[-2.6, -1.2], size=[1.2, 0.08]),
        dict(kind="light", level="ground", at=[-0.8, -1.2], size=[1.2, 0.08]), dict(kind="light", level="ground", at=[-4.6, 1.4], size=[1.2, 0.08]),
        dict(kind="light", level="ground", at=[-2.6, 1.4], size=[1.2, 0.08]), dict(kind="light", level="ground", at=[-0.8, 1.4], size=[1.2, 0.08]),
        dict(kind="light", level="first", at=[-4.6, -1.2], size=[1.2, 0.08]), dict(kind="light", level="first", at=[-2.6, -1.2], size=[1.2, 0.08]),
        dict(kind="light", level="first", at=[-0.8, -1.2], size=[1.2, 0.08]), dict(kind="light", level="first", at=[-4.6, 1.4], size=[1.2, 0.08]),
        dict(kind="light", level="first", at=[-2.6, 1.4], size=[1.2, 0.08]), dict(kind="light", level="first", at=[-0.8, 1.4], size=[1.2, 0.08]),
        dict(kind="aircon", level="ground", at=[-2.4, 0.4], size=[0.95, 0.25, 0.95]),
        dict(kind="aircon", level="first", at=[-3.2, 0.2], size=[0.95, 0.25, 0.95]),
        dict(kind="slab", name="corridor over the courtyard", box=[[E, F0 - 0.15, 0.0], [6.0, F0, 2.0]], material="concrete"),
        dict(kind="slab", name="courtyard roof edge", box=[[E, F1, -4.49], [6.84, F1 + 0.15, 3.62]], material="corrugated"),
    ],
    source=dict(made="level/make_level.py 2026-09-02 v2", from_="scan measurements + owner walk-through answers"),
)
json.dump(level, open("level/level.json", "w"), indent=1)
print("wrote level/level.json:", len(walls), "walls,", len(level["objects"]), "objects")
