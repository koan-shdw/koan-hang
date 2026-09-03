"""P3 step A: bake every level surface from the scan's own texture (docs/TEXTURES.md).

For every surface in the table, walk its face at PPC px per cm, cast a ray from 15 cm in front of the face along the
inward normal into the de-rotated raw scan, take the hit's UV, read the atlas colour. No hit within 30 cm = hole
(black, mask 0). One image per material, faces shelf-packed with a 4 px gutter. scan/bake/index.json says which face
went where, in metres. Prints coverage per material.

usage: python scan/bake.py [ppc]   (default 1 px/cm; the spec's 2 px/cm once the tracer is fast enough)
"""
import json, sys, os, time
import numpy as np, trimesh
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
PPC = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
ROT = 1.79
NEAR, REACH = 0.15, 0.30
os.makedirs("scan/bake", exist_ok=True)
lv = json.load(open("level/level.json", encoding="utf-8"))
levels = {L["id"]: L for L in lv["levels"]}

# ---- the scan, de-rotated, one mesh with a face -> (atlas, uv) map
t0 = time.time()
scene = trimesh.load("scan/raw/9_2_2026.glb", force="scene")
th = np.radians(-ROT); R = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
V_all, F_all, UV_all, atlas_of, atlases = [], [], [], [], []
off = 0
for gi, (name, g) in enumerate(scene.geometry.items()):
    V = np.asarray(g.vertices) @ R.T; F = np.asarray(g.faces); UV = np.asarray(g.visual.uv)
    atlases.append(np.asarray(g.visual.material.baseColorTexture.convert("RGB")))
    V_all.append(V); F_all.append(F + off); UV_all.append(UV); atlas_of.append(np.full(len(F), gi)); off += len(V)
V = np.vstack(V_all); F = np.vstack(F_all); UV = np.vstack(UV_all); atlas_of = np.concatenate(atlas_of)
mesh = trimesh.Trimesh(V, F, process=False)
print(f"scan: {len(F)} faces, {len(atlases)} atlases, tracer {type(mesh.ray).__name__}, {time.time()-t0:.1f}s")

def sample(points, normals, near=None, reach=None):
    """colour + hit mask for world points with outward normals: ray from NEAR in front, back through the surface"""
    near = NEAR if near is None else near; reach = REACH if reach is None else reach
    origins = points + normals * near
    dirs = -normals
    loc, iray, itri = mesh.ray.intersects_location(origins, dirs, multiple_hits=False)
    col = np.zeros((len(points), 3), np.uint8); hit = np.zeros(len(points), bool)
    if len(iray) == 0: return col, hit
    d = np.linalg.norm(loc - origins[iray], axis=1)
    # only the scan's front faces count: a floor must not pick up the ceiling below it through a missing slab
    facing = (mesh.face_normals[itri] * dirs[iray]).sum(axis=1) < 0
    keep = (d <= reach) & facing
    iray, itri, loc = iray[keep], itri[keep], loc[keep]
    if len(iray) == 0: return col, hit
    bary = trimesh.triangles.points_to_barycentric(V[F[itri]], loc)
    uv = (UV[F[itri]] * bary[:, :, None]).sum(axis=1)
    for gi, atl in enumerate(atlases):
        m = atlas_of[itri] == gi
        if not m.any(): continue
        h, w = atl.shape[:2]
        px = np.clip((uv[m, 0] * (w - 1)).astype(int), 0, w - 1); py = np.clip(((1 - uv[m, 1]) * (h - 1)).astype(int), 0, h - 1)
        col[iray[m]] = atl[py, px]
    hit[iray] = True
    return col, hit

def bake_face(origin, ua, va, nrm, w_m, h_m, inside=None, near=None, reach=None):
    """a planar face: origin (world), unit axes ua (across) and va (up), outward normal, size in metres.
    inside(u, v) -> bool mask over the grid (metres) for cut-outs. Returns image (h,w,3), mask (h,w)."""
    W, H = max(1, int(round(w_m * 100 * PPC))), max(1, int(round(h_m * 100 * PPC)))
    us = (np.arange(W) + 0.5) / (100 * PPC); vs = (np.arange(H) + 0.5) / (100 * PPC)
    gu, gv = np.meshgrid(us, vs)                       # rows = v (top row = v max), we flip at the end
    pts = origin[None, :] + gu.reshape(-1, 1) * ua[None, :] + gv.reshape(-1, 1) * va[None, :]
    nrm_b = np.repeat(nrm[None, :], len(pts), axis=0)
    keep = np.ones(len(pts), bool) if inside is None else inside(gu.reshape(-1), gv.reshape(-1))
    col = np.zeros((len(pts), 3), np.uint8); hit = np.zeros(len(pts), bool)
    idx = np.nonzero(keep)[0]
    for s in range(0, len(idx), 200000):
        sel = idx[s:s + 200000]
        c, h = sample(pts[sel], nrm_b[sel], near, reach); col[sel] = c; hit[sel] = h
    img = col.reshape(H, W, 3)[::-1]; msk = hit.reshape(H, W)[::-1]; ins = keep.reshape(H, W)[::-1]
    return img, msk, ins

faces = []   # (material, name, img, mask, inside, w_m, h_m)
def add(material, name, *args, **kw):
    img, msk, ins = bake_face(*args, **kw)
    faces.append((material, name, img, msk, ins, args[4], args[5]))
    cov = msk[ins].mean() * 100 if ins.any() else 0
    print(f"  {name:38s} {material:18s} {args[4]:.2f}x{args[5]:.2f} m  cover {cov:5.1f}%")

def facing_vec(f): return {"+x": (1, 0), "-x": (-1, 0), "+z": (0, 1), "-z": (0, -1)}[f]
def in_poly(x, z, poly):
    ins = False; n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1: ins = not ins
    return ins

print("walls")
for w in lv["walls"]:
    if w.get("draw") is False: continue
    a, b = np.array(w["a"], float), np.array(w["b"], float); d = b - a; L = np.linalg.norm(d); du = d / L
    nx, nz = facing_vec(w["facing"]); t = w["thickness"]; H = w["topY"] - w["baseY"]
    ops = w["openings"]
    def cut(u, v, ops=ops):
        keep = np.ones(len(u), bool)
        for o in ops:
            if o["kind"] == "panel": continue
            keep &= ~((u > o["u"]) & (u < o["u"] + o["w"]) & (v > o["bottom"]) & (v < o["bottom"] + o["h"]))
        return keep
    mat = w.get("material") or "wall-white"
    for side, sign in (("front", 1), ("back", -1)):
        n3 = np.array([nx * sign, 0, nz * sign], float)
        shift = 0 if sign > 0 else -t
        o3 = np.array([a[0] + nx * shift, w["baseY"], a[1] + nz * shift], float)
        # u runs a -> b for the front; for the back we look from the other side, so mirror u
        ua = np.array([du[0], 0, du[1]]) if sign > 0 else np.array([-du[0], 0, -du[1]])
        o3 = o3 if sign > 0 else o3 + np.array([du[0] * L, 0, du[1] * L])
        inside = (lambda u, v, sign=sign, L=L: cut(u if sign > 0 else L - u, v))
        add(mat, f"{w['id']} {side}", o3, ua, np.array([0, 1, 0.0]), n3, L, H, inside=inside)
        # door leaves sit in the wall plane: bake each door opening as its leaf material (both faces)
        for o in ops:
            if o["kind"] != "door" or not o.get("door", {}).get("leaf", True): continue
            dm = "door-slide" if o["door"].get("type") == "slide" else "door-metal"
            uo = o["u"] if sign > 0 else L - o["u"] - o["w"]
            add(dm, f"{w['id']} door u{o['u']} {side}", o3 + ua * uo + np.array([0, o["bottom"], 0]), ua, np.array([0, 1, 0.0]), n3, o["w"], o["h"])

print("floors and ceilings")
for f in lv["floors"]:
    if f.get("draw") is False: continue
    P = np.array(f["poly"], float); x0, z0 = P.min(axis=0); x1, z1 = P.max(axis=0); y = levels[f["level"]]["floorY"]
    if f["name"] == "courtyard": y = lv.get("yardY", y)
    add(f.get("material") or "concrete-bare", f"floor {f['level']} {f['name']}", np.array([x0, y, z0]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, 1, 0.0]), x1 - x0, z1 - z0,
        inside=lambda u, v, P=P, x0=x0, z0=z0: np.array([in_poly(x0 + uu, z0 + vv, P) for uu, vv in zip(u, v)]))
for c in lv["ceilings"]:
    if c.get("draw") is False: continue
    P = np.array(c["poly"], float); x0, z0 = P.min(axis=0); x1, z1 = P.max(axis=0); y = levels[c["level"]]["ceilY"]
    add(c.get("material") or "corrugated-ceiling", f"ceiling {c['level']}", np.array([x0, y, z0]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, -1, 0.0]), x1 - x0, z1 - z0,
        inside=lambda u, v, P=P, x0=x0, z0=z0: np.array([in_poly(x0 + uu, z0 + vv, P) for uu, vv in zip(u, v)]))

for f in lv["floors"]:
    if f.get("draw") is False or f["level"] == "ground": continue
    P = np.array(f["poly"], float); x0, z0 = P.min(axis=0); x1, z1 = P.max(axis=0); y = levels[f["level"]]["floorY"] - (levels[f["level"]].get("slab") or 0.2)
    add("corrugated-ceiling", f"ceiling under {f['level']} {f['name']}", np.array([x0, y, z0]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, -1, 0.0]), x1 - x0, z1 - z0,
        inside=lambda u, v, P=P, x0=x0, z0=z0: np.array([in_poly(x0 + uu, z0 + vv, P) for uu, vv in zip(u, v)]))
print("yard, slabs, stairs")
for o in lv["objects"]:
    if o["kind"] == "paving":
        (zx0, zz0), (zx1, zz1) = o["zone"]
        add("concrete", f"paving zone {o.get('name','')}", np.array([zx0, o["zoneTop"], zz0]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, 1, 0.0]), zx1 - zx0, zz1 - zz0)
        for i, c in enumerate(o["cells"]):
            (x0, z0), (x1, z1) = c["box"]
            add(c["material"], f"cell {o.get('name','')} {i}", np.array([x0, c["top"], z0]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, 1, 0.0]), x1 - x0, z1 - z0)
    elif o["kind"] == "slab":
        p0, p1 = o["box"]; m = o.get("material") or "concrete"
        top = np.array([p0[0], p1[1], p0[2]])
        add(m, f"slab {o.get('name','')} top", top, np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, 1, 0.0]), p1[0] - p0[0], p1[2] - p0[2])
        if "bridge" in (o.get("name") or ""):
            add(m, f"slab {o.get('name','')} bottom", np.array([p0[0], p0[1], p0[2]]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, -1, 0.0]), p1[0] - p0[0], p1[2] - p0[2])
for s in lv["stairs"]:
    fx, fz = s["from"]; wdt = s["width"]; n = s["treads"]; tr = s["tread"]; rs = s["riser"]
    # the blue stringer plates: a strip along the flight's outer side, 25 cm deep, sampled from the room side
    rise = s["topY"] - s["bottomY"]; run = s["run"]; L = float(np.hypot(rise, run))
    ua = np.array([0, rise / L, run / L]); va = np.array([0, run / L, -rise / L])
    for side_x, nrm in ((fx + wdt / 2, np.array([1, 0, 0.0])), (fx - wdt / 2, np.array([-1, 0, 0.0]))):
        add("stringer-blue", f"{s['id']} stringer x{side_x:.2f}", np.array([side_x, s["bottomY"] + 0.05, fz]) - va * 0.25, ua, va, nrm, L, 0.25, near=0.30, reach=0.60)
    for i in range(n):
        y = s["bottomY"] + rs * (i + 1); z = fz + i * tr
        add(s.get("treadMaterial") or "checker", f"{s['id']} tread {i}", np.array([fx - wdt / 2, y, z]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, 1, 0.0]), wdt, tr, near=0.30, reach=0.60)
        add(s.get("riserMaterial") or "plywood", f"{s['id']} riser {i}", np.array([fx - wdt / 2, y - rs, z]), np.array([1, 0, 0.0]), np.array([0, 1, 0.0]), np.array([0, 0, -1.0]), wdt, rs, near=0.30, reach=0.60)

# ---- pack per material
index = {}; report = {}
for m in sorted(set(f[0] for f in faces)):
    fs = sorted([f for f in faces if f[0] == m], key=lambda f: -f[2].shape[0] * f[2].shape[1])
    G = 4; W = max(2048, max(f[2].shape[1] for f in fs) + 2 * G)
    x = y = G; rowh = 0; places = []
    for f in fs:
        h, w = f[2].shape[:2]
        if x + w + G > W: x = G; y += rowh + G; rowh = 0
        places.append((x, y)); x += w + G; rowh = max(rowh, h)
    Hh = y + rowh + G
    img = np.zeros((Hh, W, 3), np.uint8); msk = np.zeros((Hh, W), np.uint8)
    cov_n = cov_d = 0; entries = []
    for f, (px, py) in zip(fs, places):
        h, w = f[2].shape[:2]; img[py:py + h, px:px + w] = f[2]; msk[py:py + h, px:px + w] = (f[3] & f[4]) * 255
        cov_n += (f[3] & f[4]).sum(); cov_d += f[4].sum()
        entries.append(dict(face=f[1], x=px, y=py, w=w, h=h, metres=[round(f[5], 3), round(f[6], 3)]))
    Image.fromarray(img).save(f"scan/bake/{m}.png"); Image.fromarray(msk).save(f"scan/bake/{m}.mask.png")
    cov = 100 * cov_n / max(1, cov_d); report[m] = round(cov, 1); index[m] = dict(ppc=PPC, size=[W, Hh], coverage=round(cov, 1), faces=entries)
    print(f"{m:18s} {W}x{Hh}  {len(fs)} faces  coverage {cov:5.1f}%")
json.dump(index, open("scan/bake/index.json", "w"), indent=1)
json.dump(report, open("scan/bake/coverage.json", "w"), indent=1)
print(f"done {time.time()-t0:.0f}s")
