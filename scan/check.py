"""Measure every listed item against the scan (level/scan.clean.glb, de-rotated). Prints 5 cm rasters of each wall
face plus detected uprights / bars / gaps, so level.json can be checked number by number."""
import trimesh, numpy as np, sys
s = trimesh.load("level/scan.clean.glb", force="scene"); m = s.to_geometry()
C = m.triangles_center; Nn = m.face_normals; A = m.area_faces
CELL = 0.05

from PIL import Image, ImageDraw
T = m.triangles
def raster(mask, along, label, thresh=0.5, y0=None, y1=None, a0=None, a1=None):
    tri = T[mask]
    if len(tri) == 0: print(f"\n## {label}: no faces"); return None
    p = tri.reshape(-1, 3)
    a0 = np.floor(p[:, along].min() * 20) / 20 if a0 is None else a0
    a1 = np.ceil(p[:, along].max() * 20) / 20 if a1 is None else a1
    y0 = np.floor(p[:, 1].min() * 20) / 20 if y0 is None else y0
    y1 = np.ceil(p[:, 1].max() * 20) / 20 if y1 is None else y1
    na = int(round((a1 - a0) / CELL)); ny = int(round((y1 - y0) / CELL))
    SUB = 4  # 1.25 cm pixels, then coverage fraction per 5 cm cell
    im = Image.new("L", (na * SUB, ny * SUB), 0); d = ImageDraw.Draw(im)
    for t in tri:
        d.polygon([((v[along] - a0) / CELL * SUB, (v[1] - y0) / CELL * SUB) for v in t], fill=255)
    arr = (np.asarray(im) > 0).astype(float)
    g = arr.reshape(ny, SUB, na, SUB).mean(axis=(1, 3))
    print(f"\n## {label}\n   cols = {'xyz'[along]} from {a0:.2f} to {a1:.2f} (5 cm), rows = y from {y1:.2f} down to {y0:.2f}")
    hdr = "        " + "".join("|" if abs((a0 + k * CELL) * 2 - round((a0 + k * CELL) * 2)) < 1e-6 else " " for k in range(na))
    print(hdr + "   (| every 0.5 m)")
    for r in range(ny - 1, -1, -1):
        y = y0 + r * CELL
        print(f"{y:7.2f} " + "".join("#" if g[r, k] > thresh else "." for k in range(na)))
    filled = g > thresh
    colcov = filled.mean(axis=0); rowcov = filled.mean(axis=1)
    ups = [(round(a0 + k * CELL, 2), round(float(colcov[k]), 2)) for k in range(na) if colcov[k] > 0.6]
    bars = [(round(y0 + r * CELL, 2), round(float(rowcov[r]), 2)) for r in range(ny) if rowcov[r] > 0.6]
    gaps = [(round(a0 + k * CELL, 2)) for k in range(na) if colcov[k] < 0.15]
    print("   columns filled >60% (uprights / solid):", ups)
    print("   rows filled >60% (bars / solid):", bars)
    print("   columns filled <15% (open):", gaps)
    return g

def band(axis, pos, tol, nmin=0.9):
    return (np.abs(C[:, axis] - pos) < tol) & (np.abs(Nn[:, axis]) > nmin)

G0, G1, F0, F1 = -5.50, -2.29, -2.14, 0.84
# ---- back wall, room side and hallway side ----
raster(band(0, -5.89, 0.12) & (C[:, 2] > -2.7) & (C[:, 2] < 3.0), 2, "BACK WALL x~-5.89 (room face), ground rows", y0=G0, y1=G1 + 0.1)
raster(band(0, -6.04, 0.10) & (C[:, 2] > -2.7) & (C[:, 2] < 3.0), 2, "BACK WALL hallway face x~-6.04, ground rows", y0=G0, y1=G1 + 0.1)
# ---- front wall ----
raster(band(0, 0.22, 0.14, 0.85) & (C[:, 2] > -2.6) & (C[:, 2] < 2.9), 2, "FRONT GLASS x~0.22, ground rows", y0=G0, y1=G1 + 0.1, thresh=0.0005)
# the open door leaf outside the front: vertical faces just east of the front, low, near the door
leaf = (C[:, 0] > 0.3) & (C[:, 0] < 1.6) & (np.abs(Nn[:, 1]) < 0.2) & (C[:, 1] > G0 + 0.1) & (C[:, 1] < G0 + 2.4) & (C[:, 2] > -1.0) & (C[:, 2] < 2.0)
p = C[leaf]; w = A[leaf]
if len(p):
    print("\n## FRONT DOOR LEAF outside (x 0.3..1.6): area by z (0.1 m):")
    h, e = np.histogram(p[:, 2], bins=np.arange(-1.0, 2.05, 0.1), weights=w)
    print("   " + " ".join(f"{z:+.1f}:{v:.2f}" for z, v in zip(e[:-1], h) if v > 0.02))
    h2, e2 = np.histogram(p[:, 0], bins=np.arange(0.3, 1.65, 0.1), weights=w)
    print("   by x: " + " ".join(f"{x:.1f}:{v:.2f}" for x, v in zip(e2[:-1], h2) if v > 0.02))
# ---- hallway west wall ----
raster(band(0, -7.06, 0.14) & (C[:, 2] > -2.7) & (C[:, 2] < 3.0), 2, "HALLWAY WEST x~-7.06, ground rows", y0=G0, y1=G1 + 0.1, thresh=0.0005)
raster(band(0, -7.06, 0.14) & (C[:, 2] > -2.7) & (C[:, 2] < 3.0), 2, "WEST x~-7.06, second floor rows", y0=F0, y1=F1 + 0.1, thresh=0.0005)
# ---- east second floor ----
raster(band(0, 0.22, 0.14, 0.85) & (C[:, 2] > -2.6) & (C[:, 2] < 2.9), 2, "EAST x~0.22, second floor rows", y0=F0, y1=F1 + 0.1, thresh=0.0005)
# ---- south / north second floor ----
raster(band(2, -2.42, 0.14) & (C[:, 0] > -7.3) & (C[:, 0] < 0.5), 0, "SOUTH z~-2.42, second floor rows", y0=F0, y1=F1 + 0.1)
raster(band(2, 2.72, 0.14) & (C[:, 0] > -7.3) & (C[:, 0] < 0.5), 0, "NORTH z~2.72, second floor rows", y0=F0, y1=F1 + 0.1)
raster(band(2, -2.42, 0.14) & (C[:, 0] > -7.3) & (C[:, 0] < 0.5), 0, "SOUTH z~-2.42, ground rows", y0=G0, y1=G1 + 0.1)
raster(band(2, 2.72, 0.14) & (C[:, 0] > -7.3) & (C[:, 0] < 0.5), 0, "NORTH z~2.72, ground rows", y0=G0, y1=G1 + 0.1)
# ---- stairs ----
for name, ylo, yhi in [("FLIGHT 1", G0 - 0.05, F0 - 0.05), ("FLIGHT 2", F0 + 0.05, 1.3)]:
    st = (Nn[:, 1] > 0.9) & (C[:, 0] > -7.2) & (C[:, 0] < -5.85) & (C[:, 1] > ylo) & (C[:, 1] < yhi)
    p = C[st]; w = A[st]
    print(f"\n## {name} treads: y bins (2 cm) with area > 0.04, z range and x range")
    h, e = np.histogram(p[:, 1], bins=np.arange(ylo, yhi, 0.02), weights=w)
    for k in range(len(h)):
        if h[k] > 0.04:
            sel = (p[:, 1] >= e[k]) & (p[:, 1] < e[k + 1])
            print(f"   y={e[k]:6.2f} area={h[k]:5.2f} z=[{np.percentile(p[sel,2],5):.2f},{np.percentile(p[sel,2],95):.2f}] x=[{np.percentile(p[sel,0],5):.2f},{np.percentile(p[sel,0],95):.2f}]")
# ---- plane positions (re-measure) ----
def plane_pos(axis, lo, hi, other_lims):
    mask = (np.abs(Nn[:, axis]) > 0.97) & (C[:, axis] > lo) & (C[:, axis] < hi)
    for ax, (l, h) in other_lims.items(): mask &= (C[:, ax] > l) & (C[:, ax] < h)
    if mask.sum() == 0: return None
    return round(float(np.average(C[mask, axis], weights=A[mask])), 3), round(float(A[mask].sum()), 2)
print("\n## PLANES (area-weighted mean position, area)")
print("  back wall room face  ", plane_pos(0, -6.0, -5.75, {1: (G0, G1), 2: (-2.4, 2.7)}))
print("  back wall hall face  ", plane_pos(0, -6.2, -5.95, {1: (G0, G1), 2: (-2.4, 2.7)}))
print("  hallway west ground  ", plane_pos(0, -7.3, -6.9, {1: (G0, G1), 2: (-2.4, 2.7)}))
print("  west second floor    ", plane_pos(0, -7.3, -6.9, {1: (F0, F1), 2: (-2.4, 2.7)}))
print("  east ground          ", plane_pos(0, 0.05, 0.45, {1: (G0, G1), 2: (-2.4, 2.7)}))
print("  east second          ", plane_pos(0, 0.05, 0.45, {1: (F0, F1), 2: (-2.4, 2.7)}))
print("  south ground / second", plane_pos(2, -2.6, -2.25, {1: (G0, G1), 0: (-7.1, 0.3)}), plane_pos(2, -2.6, -2.25, {1: (F0, F1), 0: (-7.1, 0.3)}))
print("  north ground / second", plane_pos(2, 2.55, 2.9, {1: (G0, G1), 0: (-7.1, 0.3)}), plane_pos(2, 2.55, 2.9, {1: (F0, F1), 0: (-7.1, 0.3)}))
print("  ground floor / ceiling", plane_pos(1, -5.7, -5.3, {0: (-7.1, 0.3), 2: (-2.4, 2.7)}), plane_pos(1, -2.45, -2.2, {0: (-5.8, 0.2), 2: (-2.4, 2.7)}))
print("  second floor / ceiling", plane_pos(1, -2.2, -2.05, {0: (-5.8, 0.2), 2: (-2.4, 2.7)}), plane_pos(1, 0.7, 1.0, {0: (-7.0, 0.2), 2: (-2.4, 2.7)}))
sys.stdout.flush()
