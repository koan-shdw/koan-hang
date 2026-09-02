"""KOAN.hang scan pipeline. raw GLB -> level/scan.clean.glb + level/level.draft.json + scan/report.md
Steps (SPEC s3): load, de-rotate, cut junk, planes -> level draft, write.
Compression is step 9 (gltf-transform, run by scan/compress.ps1).
Never writes level/level.json."""
import json, glob, os, numpy as np, trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

RAW = sorted(glob.glob("scan/raw/*.glb"))[-1]
MIN_FACES = 200          # pieces smaller than this are junk
BLACK_LUM = 12           # texture luminance below this = black patch
PLANE_MIN_AREA = 1.0     # m2
BIN = 0.05               # m, plane position bin
rep = []
def log(s): print(s); rep.append(s)

log(f"# pipeline report\n\nsource `{RAW}`")
scene = trimesh.load(RAW, force='scene')
geoms = list(scene.geometry.items())
merged = trimesh.util.concatenate([g for _, g in geoms])
log(f"raw: {len(geoms)} chunks, {len(merged.faces)} faces, {len(merged.vertices)} verts")

# --- step 2: de-rotate ---------------------------------------------------------
n = merged.face_normals; a = merged.area_faces
v = np.abs(n[:, 1]) < 0.1
ang = np.degrees(np.arctan2(n[v, 2], n[v, 0])) % 90
h, e = np.histogram(ang, bins=180, range=(0, 90), weights=a[v])
peak = e[np.argmax(h)] + 0.25
sel = np.abs(((ang - peak) + 45) % 90 - 45) < 3
rot = float(np.average(((ang[sel] - peak + 45) % 90 - 45), weights=a[v][sel]) + peak)
if rot > 45: rot -= 90
th = np.radians(-rot)
R = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
log(f"de-rotate: {rot:.2f} deg")

# --- step 3: cut junk, per chunk (keeps textures) -------------------------------
out_scene = trimesh.Scene()
kept_faces = 0; cut_small = 0; cut_black = 0
for name, g in geoms:
    V = g.vertices @ R.T
    F = g.faces
    img = np.asarray(g.visual.material.baseColorTexture.convert('L'))
    uv = g.visual.uv; fc = uv[F].mean(axis=1)
    px = (fc[:, 0] * (img.shape[1] - 1)).astype(int).clip(0, img.shape[1] - 1)
    py = ((1 - fc[:, 1]) * (img.shape[0] - 1)).astype(int).clip(0, img.shape[0] - 1)
    black = img[py, px] < BLACK_LUM
    tmp = trimesh.Trimesh(V, F, process=False)
    adj = tmp.face_adjacency
    m = coo_matrix((np.ones(len(adj)), (adj[:, 0], adj[:, 1])), shape=(len(F), len(F)))
    _, lab = connected_components(m, directed=False)
    cnt = np.bincount(lab)
    small = cnt[lab] < MIN_FACES
    keep = ~small & ~black
    cut_small += int(small.sum()); cut_black += int((black & ~small).sum()); kept_faces += int(keep.sum())
    F2 = F[keep]
    used = np.unique(F2); remap = np.full(len(V), -1); remap[used] = np.arange(len(used))
    g2 = trimesh.Trimesh(V[used], remap[F2], process=False,
                         visual=trimesh.visual.TextureVisuals(uv=uv[used], material=g.visual.material))
    out_scene.add_geometry(g2, node_name=name, geom_name=name)
log(f"cut junk: -{cut_small} faces in pieces < {MIN_FACES}, -{cut_black} black faces, kept {kept_faces}")
out_scene.export("level/scan.clean.glb")
log(f"wrote level/scan.clean.glb ({os.path.getsize('level/scan.clean.glb') / 1e6:.1f} MB, before compression)")

# --- step 5: planes -------------------------------------------------------------
M = trimesh.util.concatenate([g for g in out_scene.geometry.values()])
n = M.face_normals; a = M.area_faces; c = M.triangles_center
def planes(mask, axis):
    idx = np.where(mask)[0]
    pos = c[idx, axis]; w = a[idx]
    lo, hi = pos.min(), pos.max()
    bins = np.arange(lo, hi + BIN, BIN)
    h, _ = np.histogram(pos, bins=bins, weights=w)
    out = []; i = 0
    while i < len(h):
        if h[i] > 0:
            j = i
            while j + 1 < len(h) and h[j + 1] > 0.3: j += 1
            tot = h[i:j + 1].sum()
            if tot > PLANE_MIN_AREA:
                pick = idx[(pos >= bins[i]) & (pos < bins[j + 1])]
                p = np.average(c[pick, axis], weights=a[pick])
                ext = {}
                for k in (0, 1, 2):
                    if k == axis: continue
                    q = np.percentile(c[pick, k], [2, 98]); ext["xyz"[k]] = [round(float(q[0]), 2), round(float(q[1]), 2)]
                nsign = float(np.sign(np.average(n[pick, axis], weights=a[pick])))
                out.append(dict(pos=round(float(p), 2), area=round(float(tot), 2), ext=ext, nsign=nsign))
            i = j + 1
        else:
            i += 1
    return out
floors = planes(n[:, 1] > 0.95, 1); ceils = planes(n[:, 1] < -0.95, 1)
wx = planes(np.abs(n[:, 0]) > 0.97, 0); wz = planes(np.abs(n[:, 2]) > 0.97, 2)
log("\n## floors (up-facing)\n" + "\n".join(f"- y={f['pos']} area={f['area']} x={f['ext']['x']} z={f['ext']['z']}" for f in floors))
log("\n## ceilings (down-facing)\n" + "\n".join(f"- y={f['pos']} area={f['area']} x={f['ext']['x']} z={f['ext']['z']}" for f in ceils))
log("\n## walls x\n" + "\n".join(f"- x={f['pos']} area={f['area']} y={f['ext']['y']} z={f['ext']['z']} facing={'+x' if f['nsign'] > 0 else '-x'}" for f in wx))
log("\n## walls z\n" + "\n".join(f"- z={f['pos']} area={f['area']} y={f['ext']['y']} x={f['ext']['x']} facing={'+z' if f['nsign'] > 0 else '-z'}" for f in wz))

# --- step 8: level draft ---------------------------------------------------------
big = [f for f in sorted(floors, key=lambda f: f['pos']) if f['area'] > 10]
names = ["ground", "first", "second", "third"]
levels = []
for i, f in enumerate(big):
    above = [cc for cc in ceils if cc['pos'] > f['pos'] + 1.5]
    ceil = min(above, key=lambda cc: cc['pos'])['pos'] if above else f['pos'] + 3.0
    levels.append(dict(id=names[i], name=names[i], floorY=f['pos'], ceilY=ceil))
def level_of(y0, y1):
    ids = [L['id'] for L in levels if y1 > L['floorY'] + 0.5 and y0 < L['ceilY'] - 0.5]
    return "both" if len(ids) > 1 else (ids[0] if ids else levels[0]['id'])
walls = []; k = 0
for f in wx:
    k += 1; z0, z1 = f['ext']['z']; y0, y1 = f['ext']['y']
    walls.append(dict(id=f"w{k}", name=f"x{f['pos']:+.2f}", level=level_of(y0, y1), a=[f['pos'], z0], b=[f['pos'], z1],
                      baseY=y0, topY=y1, thickness=0.15, facing="+x" if f['nsign'] > 0 else "-x", openings=[], noHang=[], area=f['area']))
for f in wz:
    k += 1; x0, x1 = f['ext']['x']; y0, y1 = f['ext']['y']
    walls.append(dict(id=f"w{k}", name=f"z{f['pos']:+.2f}", level=level_of(y0, y1), a=[x0, f['pos']], b=[x1, f['pos']],
                      baseY=y0, topY=y1, thickness=0.15, facing="+z" if f['nsign'] > 0 else "-z", openings=[], noHang=[], area=f['area']))
floor_polys = []
for L, f in zip(levels, big):
    x0, x1 = f['ext']['x']; z0, z1 = f['ext']['z']
    floor_polys.append(dict(level=L['id'], poly=[[x0, z0], [x1, z0], [x1, z1], [x0, z1]], note="draft: bounding rectangle of the floor plane"))
b = M.bounds
draft = dict(format="koan-hang-level/1",
             scan=dict(file="scan.glb", rotationDeg=round(-rot, 2), offset=[0, 0, 0],
                       bounds=[[round(float(x), 2) for x in b[0]], [round(float(x), 2) for x in b[1]]]),
             eyeHeight=1.60, levels=levels, floors=floor_polys, walls=walls, stairs=[], blockers=[],
             draft=dict(generated="pipeline.py", note="auto draft; openings, stairs, blockers are hand work (SPEC s5.7)"))
json.dump(draft, open("level/level.draft.json", "w"), indent=1)
log(f"\nwrote level/level.draft.json: {len(levels)} levels, {len(walls)} walls")
open("scan/report.md", "w", encoding="utf-8").write("\n".join(rep) + "\n")
