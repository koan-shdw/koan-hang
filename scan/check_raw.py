"""Same wall rasters as check.py, but on the RAW scan (de-rotated), with black-textured faces drawn as 'B'.
A cell that is 'B' was a black patch (cut by the cleanup); '.' with nothing behind it is real glass or a real gap."""
import trimesh, numpy as np
from PIL import Image, ImageDraw
ROT = 1.79
scene = trimesh.load("scan/raw/9_2_2026.glb", force="scene")
th = np.radians(-ROT); R = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
tris = []; black = []
for name, g in scene.geometry.items():
    V = g.vertices @ R.T; F = g.faces
    img = np.asarray(g.visual.material.baseColorTexture.convert("L"))
    fc = g.visual.uv[F].mean(axis=1)
    px = (fc[:, 0] * (img.shape[1] - 1)).astype(int).clip(0, img.shape[1] - 1)
    py = ((1 - fc[:, 1]) * (img.shape[0] - 1)).astype(int).clip(0, img.shape[0] - 1)
    black.append(img[py, px] < 12)
    tris.append(V[F])
T = np.vstack(tris); B = np.concatenate(black)
C = T.mean(axis=1)
e1 = T[:, 1] - T[:, 0]; e2 = T[:, 2] - T[:, 0]; Nn = np.cross(e1, e2); ln = np.linalg.norm(Nn, axis=1) + 1e-12; Nn = Nn / ln[:, None]
CELL = 0.05

def raster(mask, along, label, y0, y1, a0=None, a1=None):
    tri = T[mask]; bl = B[mask]
    if len(tri) == 0: print(f"\n## {label}: no faces"); return
    p = tri.reshape(-1, 3)
    a0 = np.floor(p[:, along].min() * 20) / 20 if a0 is None else a0
    a1 = np.ceil(p[:, along].max() * 20) / 20 if a1 is None else a1
    na = int(round((a1 - a0) / CELL)); ny = int(round((y1 - y0) / CELL)); SUB = 4
    ims = []
    for sel in (~bl, bl):
        im = Image.new("L", (na * SUB, ny * SUB), 0); d = ImageDraw.Draw(im)
        for t in tri[sel]:
            d.polygon([((v[along] - a0) / CELL * SUB, (v[1] - y0) / CELL * SUB) for v in t], fill=255)
        ims.append((np.asarray(im) > 0).astype(float).reshape(ny, SUB, na, SUB).mean(axis=(1, 3)))
    g, gb = ims
    print(f"\n## {label}\n   cols = {'xyz'[along]} from {a0:.2f} to {a1:.2f} (5 cm), rows = y from {y1:.2f} down to {y0:.2f}; # = face, B = black patch, . = nothing")
    print("        " + "".join("|" if abs((a0 + k * CELL) * 2 - round((a0 + k * CELL) * 2)) < 1e-6 else " " for k in range(na)) + "   (| every 0.5 m)")
    for r in range(ny - 1, -1, -1):
        print(f"{y0 + r * CELL:7.2f} " + "".join("#" if g[r, k] > 0.5 else ("B" if gb[r, k] > 0.3 else ".") for k in range(na)))
    filled = (g > 0.5) | (gb > 0.3)
    cov = filled.mean(axis=0)
    def rng(vals):
        r = []
        for v in vals:
            if r and abs(v - r[-1][1] - CELL) < 1e-6: r[-1][1] = v
            else: r.append([v, v])
        return ", ".join(f"{x:.2f}..{y:.2f}" for x, y in r)
    print("   NOTHING (cols <15% anything):", rng([round(a0 + k * CELL, 2) for k in range(na) if cov[k] < 0.15]))
    print("   BLACK-heavy cols (>40% B):", rng([round(a0 + k * CELL, 2) for k in range(na) if (gb[:, k] > 0.3).mean() > 0.4]))

def band(axis, pos, tol, nmin=0.85):
    return (np.abs(C[:, axis] - pos) < tol) & (np.abs(Nn[:, axis]) > nmin)
G0, G1, F0, F1 = -5.54, -2.30, -2.14, 0.84
raster(band(2, -2.44, 0.16) & (C[:, 0] > -7.3) & (C[:, 0] < 0.5), 0, "SOUTH second floor", F0, F1 + 0.1)
raster(band(2, 2.69, 0.16) & (C[:, 0] > -7.3) & (C[:, 0] < 0.5), 0, "NORTH second floor", F0, F1 + 0.1)
raster(band(0, 0.22, 0.16) & (C[:, 2] > -2.6) & (C[:, 2] < 2.9), 2, "EAST second floor", F0, F1 + 0.1)
raster(band(0, -7.06, 0.16) & (C[:, 2] > -2.7) & (C[:, 2] < 2.9), 2, "WEST second floor", F0, F1 + 0.1)
raster(band(0, 0.22, 0.16) & (C[:, 2] > -2.6) & (C[:, 2] < 2.9), 2, "FRONT ground", G0, G1 + 0.1)
raster(band(0, -7.11, 0.18) & (C[:, 2] > -2.7) & (C[:, 2] < 2.9), 2, "HALLWAY WEST ground", G0, G1 + 0.1)
raster(band(0, -5.87, 0.12) & (C[:, 2] > -2.7) & (C[:, 2] < 2.9), 2, "BACK WALL room face ground", G0, G1 + 0.1)
