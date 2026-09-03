"""Writes level/level.json (format koan-hang-level/3) from docs/CHECK-SHEET.md + the owner's answers (2026-09-02).
Metres, y up, de-rotated scan frame. z south(-) to north(+), x west(-) to east(+).
Wall a->b runs left->right as seen from the room. Opening u from a, w width, bottom/h from the wall base.
Owner answers folded in: both back doors 85x200, open, sliders on the stair side sliding under the flight in the 15 cm gap
between wall and stringer; the whole back (west) wall is ONE window grid on every floor, six columns, a bar a metre up;
ground floor south end of that wall = steel street door (recessed, metal panel above) + corrugated panel with the gas meter;
front glass: 4 panes | door 85 hinged north open | fixed pane | 2 panes, X in pane 2, bars 0.9 and 1.65;
second floor east: X window 2 panes | wall | steel door + panel | wall | 2-pane window; side walls plain;
third floor = copy of the second, no stairs up; stairs: checker-plate treads, plywood risers, blue stringers."""
import json
YARD = json.load(open("scan/measured.json"))["yard"]   # the courtyard floor, measured (scan/yard_grid.py)
YH = YARD["heights"]

G0, G1 = -5.54, -2.30
F0, F1 = -2.14, 0.84
T0, T1 = 0.99, 3.97
W = -7.08                 # back wall of the building (the big window), all floors
SW, SWH = -5.87, -6.01    # gallery back wall: room face, hallway face
E = 0.22
SG, NG = -2.37, 2.72      # ground floor south / north
SF, NF = -2.44, 2.69      # second + third floor south / north
GH, FH, TH = G1 - G0, F1 - F0, T1 - T0
WALL_T = 0.14              # wall thickness everywhere
GAP = 0.15                # slider gap between the hallway face and the stringer
STAIR_W = round(SWH - GAP - W, 2)          # 0.92
STAIR_X = round(W + STAIR_W / 2, 3)        # centre
STAIR_E = round(W + STAIR_W, 3)            # east edge of the flight: the upper floors run up to it
PITCH = round((NG - SG) / 6, 3)            # six columns across the back window
GREY, BLACK = "steel-grey", "steel-black"

def wall(id, name, level, a, b, facing, baseY, topY, openings=(), noHang=(), hang=True, material="wall-white", note=None, src="docs/CHECK-SHEET.md + owner notes"):
    d = dict(id=id, name=name, level=level, a=a, b=b, baseY=baseY, topY=topY, thickness=0.14, facing=facing,
             openings=list(openings), noHang=list(noHang), hang=hang, material=material)
    if note: d["note"] = note
    d["src"] = src
    return d
def door(u, w, h, type, open, toggle=True, leaf=True, face="steel", swingOut=False, frame=True, hinge="a", leafSide="front",
         jambW=0.05, frameMaterial=None, panelAbove=0.0, recess=0.0, leafH=None):
    return dict(kind="door", u=u, w=w, bottom=0, h=h, door=dict(type=type, open=open, toggle=toggle, leaf=leaf, face=face,
                swingOut=swingOut, frame=frame, hinge=hinge, leafSide=leafSide, jambW=jambW, frameMaterial=frameMaterial, panelAbove=panelAbove,
                recess=recess, leafH=leafH))
def window(u, w, bottom, h, frame, uprights=(), bars=(), cross=(), crossAll=False):
    return dict(kind="window", u=u, w=w, bottom=bottom, h=h, frame=frame,
                grid=dict(uprights=list(uprights), bars=list(bars), cross=list(cross), crossAll=crossAll))
def panel(u, w, bottom, h, material):
    return dict(kind="panel", u=u, w=w, bottom=bottom, h=h, material=material)

def back_window(base, top, u0, u1, origin_u):
    """the big back window: uprights on the shared pitch measured from the south corner (origin_u = u of the ground south corner)"""
    ups = []
    k = 1
    while origin_u - k * PITCH > u0 + 0.05 or origin_u + k * PITCH < u1 - 0.05:
        for u in (origin_u - k * PITCH, origin_u + k * PITCH):
            if u0 + 0.05 < u < u1 - 0.05: ups.append(round(u - u0, 3))
        k += 1
        if k > 12: break
    return window(u0, round(u1 - u0, 3), 0.10, round(top - base - 0.20, 3), BLACK, uprights=sorted(ups), bars=[1.0])

# ---------------- ground ----------------
# back wall of the building (west), hallway side. a at NG (north) so u = NG - z. Column origin = the south corner (u = NG - SG).
DOOR_N = round(SG + 0.80, 3)         # north edge of the street door (flush in the corner)
STAIR_Z0 = round(DOOR_N + 0.02, 3)   # first riser just past the door edge
STAIR_TOP = round(STAIR_Z0 + 3.77, 3)
def back_grid(u0, u1, bottom, top_y, bars, frost=None):
    """one piece of the back grid: uprights on the shared pitch from the south corner, bars at absolute heights above G0"""
    win = back_window(G0, G0 + 1, u0, u1, round(NG - SG, 3))
    win["bottom"] = bottom; win["h"] = round(top_y - G0 - bottom, 3)
    win["grid"]["bars"] = [round(b_, 3) for b_ in bars]
    if frost: win["grid"]["frostBelow"] = frost
    return win
# rows: ground = frosted panes to 1.74 then a bar at 2.58 (street photo, estimate); upper floors = thirds; a bar at each slab
ROWS_UP = [1.0, 2.0]
g_west_openings = [
    back_grid(0.0, round(NG - DOOR_N, 3), 0.10, F0, [1.74, 2.58], frost=1.74),                                    # ground: north corner to the door, up to the slab
    door(round(NG - DOOR_N, 3), 0.80, 2.05, "metal", False, toggle=False, face="steel", recess=0.10, panelAbove=round(GH - 2.05, 3)),
    back_grid(0.0, round(NG - SG, 3), round(F0 - G0, 3), T1, [F0 - G0 + r for r in ROWS_UP] + [T0 - G0] + [T0 - G0 + r for r in ROWS_UP]),  # upper floors: full width, one grid
]
walls = [
    wall("g-west", "back wall of the building, ground (window, street door, meter panel)", "ground", [W, NG], [W, SG], "+x", G0, G1,
         hang=False, openings=g_west_openings),
    wall("g-stair-room", "gallery back wall (one wall, both faces): room face hangs, leaves slide on the hallway face", "ground", [SW, NG], [SW, SG], "+x", G0, G1,
         openings=[door(round(NG - 2.60, 3), 0.85, 2.00, "slide", True, frame=False, leafSide="back"),
                   door(round(NG - (-1.52), 3), 0.85, 2.00, "slide", True, frame=False, leafSide="back")],
         note="two identical doors 85x200: left (north) and right (south, at the stair foot); leaves live on the hallway face"),
    wall("g-east", "glass front", "ground", [E, SG], [E, NG], "-x", G0, G1, hang=False,
         openings=[window(0.07, round(0.25 - SG - 0.07, 3), 0, GH, GREY, uprights=[round(-1.55 - SG - 0.07, 3), round(-0.87 - SG - 0.07, 3), round(-0.15 - SG - 0.07, 3)], bars=[0.9], cross=[1]),
                   door(round(0.40 - SG, 3), 0.85, round(GH - 0.05, 3), "swing", True, toggle=True, face="steel", swingOut=True, hinge="b",
                        jambW=0.10, frameMaterial="wood-dark", leafH=round(GH - 0.05, 3)),
                   window(round(1.35 - SG, 3), round(NG - 1.35, 3), 0, GH, GREY, uprights=[round(1.85 - 1.35, 3), round(2.40 - 1.35, 3)], bars=[1.7])],
         note="4 panes | jamb post | door 85 hinged north, open, full height | fixed pane | 2 panes; X in pane 2"),
    wall("g-south", "south", "ground", [W, SG], [E, SG], "+z", G0, G1,
         openings=[panel(0.0, round(SW - W, 3), 0.0, GH, "corrugated")], note="hallway end wall: corrugated, gas meter, boxes, pipes"),
    wall("g-north", "north", "ground", [E, NG], [W, NG], "-z", G0, G1),
    # courtyard (plain for now, textures later)
    wall("c-1", "courtyard fence, straight ahead of the door", "ground", [4.49, -4.49], [4.49, -0.32], "-x", G0, -2.37, hang=False, material="corrugated"),
    wall("c-2", "courtyard fence east", "ground", [6.84, 0.66], [6.84, 4.94], "-x", G0, -0.54, hang=False, material="corrugated"),
    wall("c-3", "courtyard low wall, far end", "ground", [5.53, 3.62], [-0.21, 3.62], "-z", G0, -3.97, hang=False, material="concrete"),
    wall("c-4", "courtyard wall", "ground", [4.63, -0.40], [7.03, -0.40], "+z", G0, -1.16, hang=False, material="concrete"),
    wall("c-5", "red intro wall (measured: z -3.12, x 0.60..3.50, 1.75 m)", "ground",
         [0.60, -3.12], [3.50, -3.12], "+z", G0, round(G0 + 1.75, 3), hang=True, material="corten", note="signage wall"),
    wall("c-8", "white corrugated building behind the red intro wall (measured z -3.50)", "ground", [E, -3.50], [YARD["building_end_x"], -3.50], "+z", G0, 0.15, hang=False, material="corrugated-white"),
    wall("c-6", "neighbour wall, far end", "ground", [3.71, 4.25], [-0.56, 4.25], "-z", -3.87, -0.81, hang=False, material="render"),
]
# ---------------- second + third (identical) ----------------
def upper(level, base, top, tag, with_door=True):
    H = top - base
    if with_door:
        east = [window(0.05, 1.40, 0, H, BLACK, uprights=[0.70], bars=[1.0], crossAll=True),
                door(2.05, 0.90, 2.05, "metal", False, toggle=False, face="mesh", panelAbove=round(H - 2.05, 3)),
                window(3.55, 1.40, 0, H, BLACK, uprights=[0.70], bars=[1.0])]
        east_note = "X window 2 panes | wall | steel door + mesh strip + panel above | wall | 2-pane window"
    else:
        east = [window(0.05, round(NG - SG - 0.10, 3), 0, H, BLACK, uprights=[round(0.719 * k, 3) for k in range(1, 7)], bars=[1.0])]
        east_note = "owner: third floor east = windows all the way across, no door"
    return [
        wall(f"{tag}-west", "back window wall", level, [W, NG], [W, SG], "+x", base, top, hang=False, openings=[]),   # the one grid lives on g-west
        wall(f"{tag}-east", "east glass", level, [E, SG], [E, NG], "-x", base, top, hang=False, openings=east, note=east_note),
        wall(f"{tag}-south", "south (stair side wall)", level, [W, SG], [E, SG], "+z", base, top),
        wall(f"{tag}-north", "north", level, [E, NG], [W, NG], "-z", base, top),
    ]
walls += upper("first", F0, F1, "f") + upper("third", T0, T1, "t", with_door=False)
def merge_lines(walls):
    """ONE SKIN (owner): walls on the same line across floors become one drawn wall from the lowest base to the highest top,
    openings of the upper floors lifted onto it; the upper-floor entries stay for walking only (draw=False)."""
    groups = {}
    for w_ in walls: groups.setdefault((tuple(w_["a"]), tuple(w_["b"]), w_["facing"]), []).append(w_)
    for grp in groups.values():
        if len(grp) < 2: continue
        grp.sort(key=lambda w_: w_["baseY"])
        base = grp[0]
        for up_ in grp[1:]:
            lift = round(up_["baseY"] - base["baseY"], 3)
            for o in up_["openings"]:
                o2 = dict(o); o2["bottom"] = round(o["bottom"] + lift, 3); base["openings"].append(o2)
            up_["openings"] = []; up_["draw"] = False
            base["topY"] = max(base["topY"], up_["topY"])
        base["note"] = (base.get("note", "") + " | one skin: ground to roof").strip(" |")
    return walls
walls = merge_lines(walls)

def strip_polys(level, floor_name, room_s, room_n, has_foot, has_landing):
    # the room floor runs right up to the flight's edge; landing and stair foot fill the flight strip at its ends
    out = [dict(level=level, name=f"{floor_name} room", poly=[[STAIR_E, room_s], [E, room_s], [E, room_n], [STAIR_E, room_n]], material="concrete-bare")]
    if has_landing: out.append(dict(level=level, name=f"{floor_name} landing", poly=[[W, STAIR_TOP], [STAIR_E, STAIR_TOP], [STAIR_E, room_n], [W, room_n]], material="concrete-bare"))
    if has_foot: out.append(dict(level=level, name=f"{floor_name} stair foot", poly=[[W, room_s], [STAIR_E, room_s], [STAIR_E, STAIR_Z0], [W, STAIR_Z0]], material="concrete-bare"))
    return out

level = dict(
    format="koan-hang-level/3",
    eyeHeight=1.60,
    spawn=dict(level="ground", x=-2.8, z=0.1, yawDeg=90),
    levels=[dict(id="ground", name="ground", floorY=G0, ceilY=G1, slab=0.20),
            dict(id="first", name="second", floorY=F0, ceilY=F1, slab=round(F0 - G1, 3)),
            dict(id="third", name="third", floorY=T0, ceilY=T1, slab=round(T0 - F1, 3), roof=0.15)],
    floors=[
        dict(level="ground", name="gallery", poly=[[SW, SG], [E, SG], [E, NG], [SW, NG]], material="concrete-polished"),
        dict(level="ground", name="hallway", poly=[[W, SG], [SW, SG], [SW, NG], [W, NG]], material="concrete-grey"),
        dict(level="ground", name="courtyard", poly=YARD["outline"], material="gravel", draw=False),   # walk only; the yard floor is drawn from the measured boxes below
    ] + strip_polys("first", "second", SF, NF, True, True) + strip_polys("third", "third", SF, NF, False, True),
    ceilings=[
        # ceilings under a slab are the slab's underside (draw=False keeps them for the rib layout only)
        dict(level="ground", poly=[[SW, SG], [E, SG], [E, NG], [SW, NG]], material="corrugated-ceiling", draw=False),
        dict(level="ground", poly=[[W, SG], [SW, SG], [SW, STAIR_Z0], [W, STAIR_Z0]], material="corrugated-ceiling", draw=False),
        dict(level="first", poly=[[SW, SF], [E, SF], [E, NF], [SW, NF]], material="corrugated-ceiling", draw=False),
        dict(level="first", poly=[[W, SF], [SW, SF], [SW, STAIR_Z0], [W, STAIR_Z0]], material="corrugated-ceiling", draw=False),
        dict(level="first", poly=[[W, STAIR_TOP], [SW, STAIR_TOP], [SW, NF], [W, NF]], material="corrugated-ceiling", draw=False),
        dict(level="third", poly=[[W - 0.14, SF - 0.14], [E + 0.14, SF - 0.14], [E + 0.14, NF + 0.14], [W - 0.14, NF + 0.14]], material="corrugated-ceiling"),  # roof covers the wall tops
    ],
    walls=walls,
    stairs=[
        dict(id="s1", level="ground", to="first", **{"from": [STAIR_X, STAIR_Z0]}, dir="+z", width=STAIR_W, run=3.77,
             bottomY=G0, topY=F0, treads=16, riser=round((F0 - G0) / 17, 3), tread=0.222, nosing=0.0,
             treadMaterial="checker", riserMaterial="plywood", stringers=dict(height=0.25, thickness=0.03, material="stringer-blue")),
        dict(id="s2", level="first", to="third", **{"from": [STAIR_X, STAIR_Z0]}, dir="+z", width=STAIR_W, run=3.77,
             bottomY=F0, topY=T0, treads=16, riser=round((T0 - F0) / 17, 3), tread=0.222, nosing=0.0,
             treadMaterial="checker", riserMaterial="plywood", stringers=dict(height=0.25, thickness=0.03, material="stringer-blue")),
    ],
    blockers=[],
    objects=[
        dict(kind="ribs", level="ground", dir="+z", pitch=0.15, depth=0.05, width=0.06),
        dict(kind="ribs", level="first", dir="+z", pitch=0.15, depth=0.05, width=0.06),
        dict(kind="ribs", level="third", dir="+z", pitch=0.15, depth=0.05, width=0.06),
    ] + [dict(kind="track", level=lv, rect=[[-5.4, -1.5], [-0.2, 1.8]],
              spots=[[-5.1, 1.8], [-4.2, 1.8], [-3.6, 1.8], [-2.4, 1.8], [-1.5, 1.8], [-0.3, 1.8],
                     [-4.5, -1.5], [-3.9, -1.5], [-3.0, -1.5], [-1.8, -1.5], [-0.9, -1.5],
                     [-5.4, 0.0], [-0.2, -0.3], [-0.2, 0.9]]) for lv in ("ground", "first", "third")] + [
        dict(kind="light", level="ground", at=[STAIR_X, -2.1], size=[0.6, 0.08]),
        dict(kind="light", level="ground", at=[STAIR_X, 0.6], size=[0, 0], y=-3.4),
        dict(kind="light", level="ground", at=[STAIR_X, 2.3], size=[0, 0], y=-2.6),
        dict(kind="light", level="first", at=[STAIR_X, 0.6], size=[0, 0], y=-0.1),
        dict(kind="slab", name="bridge floor", box=[[E + WALL_T, F0 - 0.12, round(SF + 2.05, 3)], [4.2, F0, round(SF + 2.95, 3)]], material="concrete"),
        dict(kind="slab", name="bridge roof", box=[[E + WALL_T, F0 + 2.05, round(SF + 2.05, 3)], [4.2, F0 + 2.20, round(SF + 2.95, 3)]], material="concrete"),
        dict(kind="slab", name="bridge wall a", box=[[E + WALL_T, F0 - 0.12, round(SF + 2.05 - 0.10, 3)], [4.2, F0 + 2.20, round(SF + 2.05, 3)]], material="render"),
        dict(kind="slab", name="bridge wall b", box=[[E + WALL_T, F0 - 0.12, round(SF + 2.95, 3)], [4.2, F0 + 2.20, round(SF + 2.95 + 0.10, 3)]], material="render"),
        dict(kind="slab", name="bridge end", box=[[4.2, F0 - 0.12, round(SF + 2.05 - 0.10, 3)], [4.3, F0 + 2.20, round(SF + 2.95 + 0.10, 3)]], material="render"),
        dict(kind="aircon", level="ground", at=[-2.25, 0.25], size=[0.95, 0.25, 0.95]),
        dict(kind="aircon", level="first", at=[-2.75, 0.25], size=[0.95, 0.25, 0.95]),
        dict(kind="aircon", level="third", at=[-2.75, 0.25], size=[0.95, 0.25, 0.95]),
        # gas meter, boxes, pipes on the corrugated end wall of the hallway (wall g-south, u from the west corner)
        dict(kind="wallbox", wall="g-south", u=0.55, y=2.05, w=0.30, h=0.40, d=0.18, material="meter-box"),
        dict(kind="wallbox", wall="g-south", u=0.40, y=1.50, w=0.22, h=0.18, d=0.10, material="junction-box"),
        dict(kind="wallbox", wall="g-south", u=0.78, y=1.45, w=0.10, h=0.14, d=0.06, material="junction-box"),
        dict(kind="pipe", wall="g-south", u=0.62, y0=0.05, y1=1.85, r=0.012, d=0.04, material="pipe-white"),
        dict(kind="pipe", wall="g-south", u=0.30, y0=0.05, y1=2.60, r=0.010, d=0.04, material="pipe-white"),
        # ---- courtyard floor, every box measured (scan/measured.json yard) ----
        *[dict(kind="slab", name=a_["name"], box=[[max(a_["box"][0][0], E + WALL_T), G0 - 0.20, a_["box"][0][1]], [a_["box"][1][0], round(G0 + YH["apron"], 3), a_["box"][1][1]]], material="concrete-path") for a_ in YARD["apron"]],
        *[dict(kind="paving", name=p_["name"], zone=p_["zone"], zoneTop=round(G0 + YH["paving"], 3), base=G0 - 0.20,
               cells=[dict(box=c_["box"], material=c_["material"], top=round(G0 + (YH["red"] if c_["material"] == "red-tile" else YH["slate"]), 3)) for c_ in p_["cells"]]) for p_ in YARD["patches"]],
        dict(kind="slab", name="dirt bed along the fence", box=[[YARD["dirt"]["box"][0][0], G0 - 0.20, YARD["dirt"]["box"][0][1]], [YARD["dirt"]["box"][1][0], round(G0 + YH["dirt"], 3), YARD["dirt"]["box"][1][1]]], material="dirt"),
        dict(kind="slab", name="sliver between the dirt and the fence", box=[[YARD["fence_gap"]["box"][0][0], G0 - 0.20, YARD["fence_gap"]["box"][0][1]], [YARD["fence_gap"]["box"][1][0], round(G0 + YH["apron"], 3), YARD["fence_gap"]["box"][1][1]]], material="concrete"),
        dict(kind="slab", name="passage floor off the far corner", box=[[YARD["passage"]["box"][0][0], G0 - 0.20, YARD["passage"]["box"][0][1]], [YARD["passage"]["box"][1][0], round(G0 + YH["passage"], 3), YARD["passage"]["box"][1][1]]], material="concrete"),
        dict(kind="slab", name="grating on the door step", box=[[YARD["rack"]["box"][0][0], round(G0 + YH["paving"], 3), YARD["rack"]["box"][0][1]], [YARD["rack"]["box"][1][0], round(G0 + YH["rack"], 3), YARD["rack"]["box"][1][1]]], material="steel-black"),
        dict(kind="slab", name="counter inside by the front glass (measured; what it is: OPEN)", box=[[YARD["counter"]["box"][0][0], G0, YARD["counter"]["box"][0][1]], [YARD["counter"]["box"][1][0], round(G0 + YARD["counter"]["height"], 3), YARD["counter"]["box"][1][1]]], material="plywood"),
        dict(kind="hedge", name="plants behind the red intro wall, spilling over its top", along=[[0.75, -3.28], [3.40, -3.28]], y=round(G0 + 1.75, 3), r=0.42, step=0.38, material="foliage"),
        dict(kind="hedge", name="plants, front fringe over the wall top", along=[[0.95, -3.08], [3.30, -3.08]], y=round(G0 + 1.62, 3), r=0.28, step=0.45, material="foliage"),
        dict(kind="slab", name="stone figure (measured x 0.45 z -2.75, 1.25 tall)", box=[[round(YARD["figure"]["x"] - 0.17, 3), round(G0 + YH["slate"], 3), round(YARD["figure"]["z"] - 0.17, 3)], [round(YARD["figure"]["x"] + 0.17, 3), round(G0 + YARD["figure"]["height"], 3), round(YARD["figure"]["z"] + 0.17, 3)]], material="stone"),

    ],
    sky=dict(file="sky-tokyo.jpg", fallback="#bfd9f2"),
    source=dict(made="level/make_level.py v3 2026-09-02", from_="docs/CHECK-SHEET.md + owner answers"),
)
CTX = json.load(open("level/context.json", encoding="utf-8")) if __import__("os").path.exists("level/context.json") else None
if CTX:
    level["objects"] += CTX["blocks"] + CTX["roads"] + [CTX["ground"]]
    level["context"] = dict(source=CTX["source"], blocks=len(CTX["blocks"]), roads=len(CTX["roads"]))
SRC = dict(ribs="docs/CHECK-SHEET.md ceiling", track="scan/measure2.py lights", light="docs/CHECK-SHEET.md", aircon="scan/measure2.py hanging boxes",
           wallbox="docs/CHECK-SHEET.md meter wall", pipe="docs/CHECK-SHEET.md meter wall", hedge="owner photos 2026-09-03 (plants: forget for now)",
           paving="scan/measured.json yard", slab="scan/measured.json yard", block="osm", road="osm")
for o in level["objects"]:
    if "src" not in o:
        o["src"] = "owner note 2026-09-02 (bridge)" if "bridge" in (o.get("name") or "") else SRC.get(o["kind"], "UNSOURCED")
json.dump(level, open("level/level.json", "w"), indent=1)
print("wrote level/level.json:", len(walls), "walls,", len(level["objects"]), "objects; stair width", STAIR_W, "centre", STAIR_X, "pitch", PITCH)
