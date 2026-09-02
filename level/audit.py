"""Geometry audit of level/level.json, fresh eyes: corners closed, openings inside their walls, floors meeting walls and
stairs, stairs meeting landings and floors, slabs solid, sliders clear of stairs, every level reachable from the spawn.
Prints PASS / FAIL lines. Exit code 1 on any FAIL."""
import json, math, sys
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
    if w["id"].startswith("c-"): continue
    for end in ("a", "b"):
        p = w[end]
        touch = any(o is not w and o["level"] == w["level"] and not o["id"].startswith("c-") and seg_dist(p, o["a"], o["b"]) < 0.16 for o in walls)
        ok(touch, f"corner closed: {w['id']} {end} {p}")

# 2. openings inside their wall, not overlapping each other, heights inside the wall
for w in walls:
    L = wall_len(w); H = w["topY"] - w["baseY"]
    ops = sorted(w["openings"], key=lambda o: o["u"])
    for o in ops:
        ok(o["u"] >= -TOL and o["u"] + o["w"] <= L + TOL, f"opening inside wall: {w['id']} {o['kind']} u {o['u']}..{round(o['u']+o['w'],3)} of {round(L,3)}")
        ok(o["bottom"] >= -TOL and o["bottom"] + o["h"] <= H + TOL, f"opening height inside wall: {w['id']} {o['kind']} {o['bottom']}..{round(o['bottom']+o['h'],3)} of {round(H,3)}")
    for a, b in zip(ops, ops[1:]):
        ok(a["u"] + a["w"] <= b["u"] + TOL, f"openings do not overlap: {w['id']} {a['kind']}/{b['kind']}")

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
    hall = next((w for w in walls if w["id"] == "g-stair-hall"), None)
    if hall and s["level"] == "ground":
        leaf_x = hall["a"][0] - 0.05 - 0.02
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
            if d["type"] == "slide": ok((w["id"] == "g-stair-hall") == d["leaf"], f"slider leaf on the hallway side only: {w['id']} u {o['u']} leaf={d['leaf']}")

print(f"\n{fails} FAIL" if fails else "\nALL PASS")
sys.exit(1 if fails else 0)
