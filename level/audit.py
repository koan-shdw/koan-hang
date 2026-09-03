"""Geometry audit of level/level.json, fresh eyes: corners closed, openings inside their walls, floors meeting walls and
stairs, stairs meeting landings and floors, slabs solid, sliders clear of stairs, every level reachable from the spawn.
Prints PASS / FAIL lines. Exit code 1 on any FAIL."""
import json, math, sys
sys.stdout.reconfigure(encoding='utf-8')
lv = json.load(open("level/level.json"))
TOL = 0.011
fails = 0
def ok(cond, msg):
    global fails
    print(("PASS  " if cond else "FAIL  ") + msg)
    if not cond: fails += 1
levels = {l["id"]: l for l in lv["levels"]}
walls = lv["walls"]; floors = lv["floors"]; stairs = lv["stairs"]

def wall_len(w): return math.hypot(w["b"][0]-w["a"][0], w["b"][1]-w["a"][1])
def seg_dist(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx-ax, bz-az; L2 = dx*dx+dz*dz
    t = 0 if L2 == 0 else max(0, min(1, ((px-ax)*dx+(pz-az)*dz)/L2))
    return math.hypot(px-(ax+t*dx), pz-(az+t*dz))

# 1. every room-wall endpoint touches another wall of the same level (corners closed); courtyard walls exempt
for w in walls:
    if w["id"].startswith("c-") or w["id"].endswith("-band"): continue
    for end in ("a", "b"):
        p = w[end]
        touch = any(o is not w and o["level"] == w["level"] and not o["id"].startswith("c-") and not o["id"].endswith("-band") and seg_dist(p, o["a"], o["b"]) < 0.16 for o in walls)
        ok(touch, f"corner closed: {w['id']} {end} {p}")

# 2. openings inside their wall, not overlapping each other, heights inside the wall
for w in walls:
    L = wall_len(w); H = w["topY"] - w["baseY"]
    ops = sorted(w["openings"], key=lambda o: o["u"])
    for o in ops:
        ok(o["u"] >= -TOL and o["u"] + o["w"] <= L + TOL, f"opening inside wall: {w['id']} {o['kind']} u {o['u']}..{round(o['u']+o['w'],3)} of {round(L,3)}")
        ok(o["bottom"] >= -TOL and o["bottom"] + o["h"] <= H + TOL, f"opening height inside wall: {w['id']} {o['kind']} {o['bottom']}..{round(o['bottom']+o['h'],3)} of {round(H,3)}")
    for i_, a in enumerate(ops):
        for b in ops[i_ + 1:]:
            # stacked openings on one skin may share u; they overlap only if both u and height ranges intersect
            u_ov = min(a["u"] + a["w"], b["u"] + b["w"]) - max(a["u"], b["u"]) > TOL
            h_ov = min(a["bottom"] + a["h"], b["bottom"] + b["h"]) - max(a["bottom"], b["bottom"]) > TOL
            ok(not (u_ov and h_ov), f"openings do not overlap: {w['id']} {a['kind']} u{a['u']} y{a['bottom']} / {b['kind']} u{b['u']} y{b['bottom']}")

# 3. slabs: upper floors thick enough to reach the ceiling below
order = sorted(lv["levels"], key=lambda l: l["floorY"])
for lo, hi in zip(order, order[1:]):
    ok(abs(hi["floorY"] - hi.get("slab", 0) - lo["ceilY"]) < TOL, f"slab solid: {hi['id']} floor {hi['floorY']} - slab {hi.get('slab')} = ceiling of {lo['id']} {lo['ceilY']}")

# 4. stairs: bottom end on a floor poly of its level, top end on a floor poly of its target; width inside the strip
def poly_edge_near(poly, x, z, tol=TOL):
    return any(seg_dist((x, z), poly[i], poly[(i+1) % len(poly)]) < tol for i in range(len(poly)))
def in_poly(x, z, poly):
    inside = False; n = len(poly)
    for i in range(n):
        xi, zi = poly[i]; xj, zj = poly[(i-1) % n]
        if (zi > z) != (zj > z) and x < (xj-xi)*(z-zi)/(zj-zi)+xi: inside = not inside
    return inside
for s in stairs:
    fx, fz = s["from"]; hw = s["width"]/2
    zb = fz; zt = fz + s["run"]
    bottom_floor = [f for f in floors if f["level"] == s["level"] and (in_poly(fx, zb - 0.05, f["poly"]) or poly_edge_near(f["poly"], fx, zb))]
    ok(bool(bottom_floor), f"stair {s['id']} bottom meets a floor of {s['level']} at z {zb}")
    if s["to"]:
        top_floor = [f for f in floors if f["level"] == s["to"] and (in_poly(fx, zt + 0.05, f["poly"]) or poly_edge_near(f["poly"], fx, zt))]
        ok(bool(top_floor), f"stair {s['id']} top meets a floor of {s['to']} at z {round(zt,3)}")
        ok(abs(s["bottomY"] - levels[s["level"]]["floorY"]) < TOL and abs(s["topY"] - levels[s["to"]]["floorY"]) < TOL, f"stair {s['id']} heights match its floors")
    # no wall crosses the flight footprint
    for w in walls:
        if w["level"] != s["level"] or w["id"].startswith("c-"): continue
        (ax, az), (bx, bz) = w["a"], w["b"]
        # walls parallel to z at x inside the footprint, or parallel to x at z inside the run
        if abs(ax - bx) < 1e-6 and fx - hw + TOL < ax < fx + hw - TOL and max(az, bz) > zb and min(az, bz) < zt:
            ok(False, f"wall {w['id']} crosses stair {s['id']}")
        if abs(az - bz) < 1e-6 and zb + TOL < az < zt - TOL and max(ax, bx) > fx - hw and min(ax, bx) < fx + hw:
            ok(False, f"wall {w['id']} crosses stair {s['id']}")
    # slider leaves clear of the stringer: leaves sit 5 cm off the hallway face; stringer at the flight edge
    hall = next((w for w in walls if w["id"] == "g-stair-room"), None)
    if hall and s["level"] == "ground":
        leaf_x = hall["a"][0] - hall["thickness"] - 0.05 - 0.02   # leaves on the back (hallway) face of the one wall
        ok(leaf_x > fx + hw + 0.02, f"slider leaf ({round(leaf_x,3)}) clear of the stringer edge ({round(fx+hw,3)})")

# 5. floors of a level share edges with each other or with walls (no islands)
for f in floors:
    if f.get("name") == "courtyard": continue
    others = [g for g in floors if g is not f and g["level"] == f["level"]]
    wl = [w for w in walls if w["level"] == f["level"]]
    touching = False
    for i in range(len(f["poly"])):
        p = f["poly"][i]
        if any(poly_edge_near(g["poly"], p[0], p[1]) for g in others) or any(seg_dist(p, w["a"], w["b"]) < 0.16 for w in wl): touching = True
    ok(touching, f"floor '{f.get('name')}' ({f['level']}) touches walls or other floors")

# 5b. upper room floors run to the flight edge
for s_ in stairs:
    if not s_["to"]: continue
    edge = round(s_["from"][0] + s_["width"]/2, 3)
    rooms = [f for f in floors if f["level"] == s_["to"] and "room" in (f.get("name") or "")]
    ok(any(abs(min(p[0] for p in f["poly"]) - edge) < TOL for f in rooms), f"room floor of {s_['to']} starts at the flight edge {edge}")

# 5c. courtyard items against the scan measurements (scan/measured.json)
import os
mz = json.load(open("scan/measured.json")) if os.path.exists("scan/measured.json") else {}
if mz:
    rw = next((w for w in walls if w["id"] == "c-5"), None); m = mz["red_intro_wall"]
    if rw:
        xs = sorted([rw["a"][0], rw["b"][0]])
        ok(abs(xs[0] - m["x0"]) < 0.05 and abs(xs[1] - m["x1"]) < 0.05, f"red intro wall ends {xs} = scan {m['x0']}..{m['x1']}")
        ok(abs(rw["a"][1] - m["z"]) < 0.05, f"red intro wall line z {rw['a'][1]} = scan {m['z']}")
        ok(abs((rw["topY"] - rw["baseY"]) - m["height"]) < 0.05, f"red intro wall height {round(rw['topY']-rw['baseY'],3)} = scan {m['height']}")
    fig = next((o for o in lv["objects"] if o["kind"] == "slab" and "figure" in (o.get("name") or "")), None); f_ = mz["figure"]
    if fig:
        cx = (fig["box"][0][0] + fig["box"][1][0]) / 2; cz = (fig["box"][0][2] + fig["box"][1][2]) / 2; h = fig["box"][1][1] - levels["ground"]["floorY"]   # top above the yard floor (the figure stands on a cell)
        ok(abs(cx - f_["x"]) < 0.05 and abs(cz - f_["z"]) < 0.05 and abs(h - f_["height"]) < 0.05, f"stone figure at {cx:.2f},{cz:.2f} h {h:.2f} = scan {f_['x']},{f_['z']} h {f_['height']}")

# 5d. courtyard floor: every measured cell, apron box, dirt, passage present in the level, red counts right
if os.path.exists("scan/measured.json") and "yard" in mz:
    Y = mz["yard"]; objs = lv["objects"]
    def same(b1, b2): return all(abs(b1[i][k] - b2[i][k]) < 0.011 for i in (0, 1) for k in (0, 1))
    pav = [o for o in objs if o["kind"] == "paving"]
    for p_ in Y["patches"]:
        got = next((o for o in pav if same(o["zone"], p_["zone"])), None)
        ok(got is not None, f"paving zone '{p_['name']}' {p_['zone']} in level")
        if got:
            for c_ in p_["cells"]:
                ok(any(same(c["box"], c_["box"]) and c["material"] == c_["material"] for c in got["cells"]), f"cell {c_['material']} {c_['box']} in '{p_['name']}'")
            ok(len(got["cells"]) == len(p_["cells"]), f"'{p_['name']}' has {len(got['cells'])} cells = measured {len(p_['cells'])}")
    reds = [c for o in pav for c in o["cells"] if c["material"] == "red-tile"]
    ok(len(reds) == 4, f"red tiles: {len(reds)} = 4 (door 2, far 1, side 1)")
    door = next((o for o in pav if o["name"] == "door patch"), None); row4 = next((o for o in pav if o["name"] == "door patch row 4"), None)
    if door and row4:
        dr = [c for c in door["cells"] if c["material"] == "red-tile"] + [c for c in row4["cells"] if c["material"] == "red-tile"]
        ok(len(dr) == 2 and sorted(round(c["box"][0][1], 2) for c in dr) == [-2.27, -0.8], f"door patch reds in row 2 and row 4: {[c['box'] for c in dr]}")
    slabs = [o for o in objs if o["kind"] == "slab"]
    def slab_xz(o): return [[o["box"][0][0], o["box"][0][2]], [o["box"][1][0], o["box"][1][2]]]
    def clamped(b): return [[max(b[0][0], 0.22 + 0.14), b[0][1]], b[1]]   # an apron starts at the front wall's outer face, never inside the wall body
    for a_ in Y["apron"]: ok(any(same(slab_xz(o), clamped(a_["box"])) for o in slabs), f"apron '{a_['name']}' {a_['box']} in level (x0 clamped to the wall face)")
    ok(any(same(slab_xz(o), Y["dirt"]["box"]) and o["material"] == "dirt" for o in slabs), f"dirt bed {Y['dirt']['box']} in level")
    ok(any(same(slab_xz(o), Y["passage"]["box"]) for o in slabs), f"passage floor {Y['passage']['box']} in level")
    ok(any(same(slab_xz(o), Y["rack"]["box"]) for o in slabs), f"door step grating {Y['rack']['box']} in level")
    ok(not any(same(slab_xz(o), Y["counter"]["box"]) for o in slabs), f"counter {Y['counter']['box']} is OFF (owner 2026-09-03: desk option later, white)")
    yard_floor = next((f for f in floors if f.get("name") == "courtyard"), None)
    ok(yard_floor is not None and yard_floor["poly"] == Y["outline"], "courtyard walk outline = measured outline")
    # no two drawn yard boxes overlap in plan (cells inside their zone excepted)
    tops = [(o["name"], slab_xz(o)) for o in slabs if o["box"][0][1] < levels["ground"]["floorY"] - 0.1] + [(o["name"], o["zone"]) for o in pav]
    for i in range(len(tops)):
        for j in range(i + 1, len(tops)):
            (na, A_), (nb, B_) = tops[i], tops[j]
            ov = min(A_[1][0], B_[1][0]) - max(A_[0][0], B_[0][0]) > 0.011 and min(A_[1][1], B_[1][1]) - max(A_[0][1], B_[0][1]) > 0.011
            if ov: ok(False, f"yard boxes overlap: '{na}' and '{nb}'")
    b8 = next((w for w in walls if w["id"] == "c-8"), None)   # dropped by the owner 2026-09-03; the check stays for the day it comes back
    if b8: ok(abs(max(b8["a"][0], b8["b"][0]) - Y["building_end_x"]) < 0.011, f"corrugated building ends at the dirt {Y['building_end_x']}")

# 5e. one skin: walls on one line = exactly one drawn, from the lowest base to the highest top; upper entries walk-only
groups = {}
for w in walls: groups.setdefault((tuple(w["a"]), tuple(w["b"]), w["facing"]), []).append(w)
for key, grp in groups.items():
    drawn = [w for w in grp if w.get("draw", True)]
    ok(len(drawn) == 1, f"one skin: line {key[0]}->{key[1]} has {len(drawn)} drawn wall(s) of {len(grp)}: {[w['id'] for w in drawn]}")
    if len(drawn) == 1 and len(grp) > 1:
        d = drawn[0]
        ok(abs(d["baseY"] - min(w["baseY"] for w in grp)) < TOL and abs(d["topY"] - max(w["topY"] for w in grp)) < TOL, f"one skin: {d['id']} spans {d['baseY']}..{d['topY']} = the line's full height")
ok(not any(w["id"].endswith("-band") for w in walls), "no slab bands left")
# 5f. provenance: every wall and object names its source
for w in walls: ok(w.get("src") not in (None, "", "UNSOURCED"), f"source on wall {w['id']}: {w.get('src')}")
for o in lv["objects"]: ok(o.get("src") not in (None, "", "UNSOURCED"), f"source on object {o['kind']} '{o.get('name', '')}': {o.get('src')}")
# 5g. the back grid: one window run ground to roof on g-west (owner x4), frosted low panes
gw = next((w for w in walls if w["id"] == "g-west"), None)
if gw:
    wins = sorted([o for o in gw["openings"] if o["kind"] == "window"], key=lambda o: o["bottom"])
    ok(len(wins) >= 2 and abs(wins[0]["bottom"] + wins[0]["h"] - wins[-1]["bottom"]) < TOL, "back grid: ground piece meets the upper piece at the slab, no wall between")
    ok(bool(wins) and abs(gw["baseY"] + wins[-1]["bottom"] + wins[-1]["h"] - max(l["ceilY"] for l in lv["levels"])) < 0.11, "back grid: reaches the top floor ceiling")
    ok(bool(wins) and wins[0].get("grid", {}).get("frostBelow"), "back grid: frosted low panes on the ground floor")

# 5h. context blocks: none on our plot (building + yard), a ground plate, roads present
blocks = [o for o in lv["objects"] if o["kind"] == "block"]
if blocks:
    PX0, PZ0, PX1, PZ1 = -7.30, -4.60, 7.00, 5.20
    def pt_in_plot(p): return PX0 + 0.25 < p[0] < PX1 - 0.25 and PZ0 + 0.25 < p[1] < PZ1 - 0.25
    bad = [b for b in blocks if any(pt_in_plot(p) for p in b["poly"]) or any(in_poly(x, z, b["poly"]) for x, z in ((-3.4, 0.2), (3.0, 1.0), (-6.5, 0.0), (5.5, 1.5)))]
    ok(not bad, f"no context block on the gallery plot ({len(bad)} do: {[b.get('src') for b in bad][:3]})")
    ok(any(o["kind"] == "ground" for o in lv["objects"]), "ground plate under the context")
    ok(sum(1 for o in lv["objects"] if o["kind"] == "road") > 0, f"roads present: {sum(1 for o in lv['objects'] if o['kind'] == 'road')}")
    ok(all(b["h"] > 2.5 for b in blocks), "every block has a height")

# 6. reachability: spawn level -> every level via stairs with matching floors
reach = {lv["spawn"]["level"]}; changed = True
while changed:
    changed = False
    for s in stairs:
        if s["level"] in reach and s["to"] and s["to"] not in reach: reach.add(s["to"]); changed = True
for l in lv["levels"]: ok(l["id"] in reach, f"level reachable: {l['id']}")

# 7. doors: walkable doors have h >= 1.9; sliders have leaves on the hallway wall only
for w in walls:
    for o in w["openings"]:
        if o["kind"] == "door":
            d = o["door"]
            if d["open"] and d.get("toggle", True): ok(o["h"] >= 1.9, f"door tall enough to walk: {w['id']} u {o['u']} h {o['h']}")
            if d["type"] == "slide": ok(d["leaf"] and d.get("leafSide") == "back", f"slider leaf on the hallway face: {w['id']} u {o['u']} leafSide={d.get('leafSide')}")

print(f"\n{fails} FAIL" if fails else "\nALL PASS")
sys.exit(1 if fails else 0)
